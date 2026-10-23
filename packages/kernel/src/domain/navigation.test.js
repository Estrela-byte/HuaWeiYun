import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pageRoutes, navItems, navigation, statusLabel, newIdempotencyKey,
  createIdempotencyIntent,
  formatAmountMinor, yuanToMinor, formatMetric, formatRate, errorText,
  isPendingJob, asItems,
} from './navigation.js'

test('idempotency intent reuses a key only for unchanged request content until confirmation', () => {
  let sequence = 0
  const intent = createIdempotencyIntent(() => `key-${++sequence}`)
  assert.equal(intent.keyFor({ name: 'first', amountMinor: '100' }), 'key-1')
  assert.equal(intent.keyFor({ name: 'first', amountMinor: '100' }), 'key-1')
  assert.equal(intent.keyFor({ name: 'first', amountMinor: '200' }), 'key-2')
  intent.clear()
  assert.equal(intent.keyFor({ name: 'first', amountMinor: '200' }), 'key-3')
})

// U+2212 MINUS SIGN is the glyph formatAmountMinor uses for negative amounts.
const MINUS = '\u2212'

test('pageRoutes maps every page key to its route path', () => {
  assert.deepEqual(pageRoutes, {
    landing: '/',
    login: '/login',
    onboarding: '/onboarding',
    overview: '/app/overview',
    ingestion: '/app/ingestion',
    ledger: '/app/ledger',
    analytics: '/app/analytics',
    assistant: '/app/assistant',
    alerts: '/app/alerts',
    settings: '/app/settings',
    receipt: '/app/ingestion/receipts',
  })
})

test('navItems lists the seven primary pages with labels, icons and descriptions', () => {
  assert.equal(navItems.length, 7)
  assert.deepEqual(navItems.map((item) => item.key), [
    'overview', 'ingestion', 'ledger', 'analytics', 'assistant', 'alerts', 'settings',
  ])
  for (const item of navItems) {
    assert.ok(typeof item.label === 'string' && item.label.length > 0, `${item.key} has a label`)
    assert.ok(typeof item.icon === 'string' && item.icon.length > 0, `${item.key} has an icon`)
    assert.ok(typeof item.description === 'string' && item.description.length > 0, `${item.key} has a description`)
  }
  assert.equal(navigation, navItems)
})

test('statusLabel returns the Chinese label for known keys', () => {
  assert.equal(statusLabel('completed'), '已完成')
  assert.equal(statusLabel('queued'), '排队中')
  assert.equal(statusLabel('failed'), '失败')
  assert.equal(statusLabel('inflow'), '收入')
  assert.equal(statusLabel('currency_minor'), '金额（分）')
  assert.equal(statusLabel('owner'), '老板')
})

test('statusLabel falls back to the raw value for unknown keys and an em dash for empties', () => {
  assert.equal(statusLabel('unknown_status'), 'unknown_status')
  assert.equal(statusLabel(undefined), '—')
  assert.equal(statusLabel(null), '—')
  assert.equal(statusLabel(''), '—')
})

test('newIdempotencyKey returns a unique UUID on every call', () => {
  const key = newIdempotencyKey()
  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  const second = newIdempotencyKey()
  assert.match(second, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.notEqual(key, second)
})

test('formatAmountMinor converts minor units to a grouped currency string', () => {
  assert.equal(formatAmountMinor(0), '¥0.00')
  assert.equal(formatAmountMinor(1), '¥0.01')
  assert.equal(formatAmountMinor(99), '¥0.99')
  assert.equal(formatAmountMinor(100), '¥1.00')
  assert.equal(formatAmountMinor(123456), '¥1,234.56')
  assert.equal(formatAmountMinor(100000000), '¥1,000,000.00')
  assert.equal(formatAmountMinor('123456'), '¥1,234.56')
})

test('formatAmountMinor renders negatives with a true minus sign and supports other currencies', () => {
  assert.equal(formatAmountMinor(-123456), `${MINUS}¥1,234.56`)
  assert.equal(formatAmountMinor(-50), `${MINUS}¥0.50`)
  assert.equal(formatAmountMinor(123456, 'USD'), 'USD 1,234.56')
  assert.equal(formatAmountMinor(123456, 'EUR'), 'EUR 1,234.56')
})

test('formatAmountMinor returns an em dash for empty or unparseable input', () => {
  assert.equal(formatAmountMinor(null), '—')
  assert.equal(formatAmountMinor(undefined), '—')
  assert.equal(formatAmountMinor(''), '—')
  assert.equal(formatAmountMinor('abc'), '—')
  assert.equal(formatAmountMinor(NaN), '—')
})

test('yuanToMinor converts a yuan string to a minor-unit string', () => {
  assert.equal(yuanToMinor('1'), '100')
  assert.equal(yuanToMinor('1.5'), '150')
  assert.equal(yuanToMinor('1.50'), '150')
  assert.equal(yuanToMinor('1.05'), '105')
  assert.equal(yuanToMinor('0.01'), '1')
  assert.equal(yuanToMinor('0.5'), '50')
  assert.equal(yuanToMinor('123.45'), '12345')
  assert.equal(yuanToMinor(' 123.45 '), '12345')
  assert.equal(yuanToMinor(123.45), '12345')
})

test('yuanToMinor rejects zero, negatives and malformed amounts with null', () => {
  assert.equal(yuanToMinor('0'), null)
  assert.equal(yuanToMinor('-1'), null)
  assert.equal(yuanToMinor('1.234'), null)
  assert.equal(yuanToMinor('1.'), null)
  assert.equal(yuanToMinor('01'), null)
  assert.equal(yuanToMinor(''), null)
  assert.equal(yuanToMinor(null), null)
  assert.equal(yuanToMinor(undefined), null)
  assert.equal(yuanToMinor('abc'), null)
})

test('formatMetric formats by unit: currency, ratio, percentage point and count', () => {
  assert.equal(formatMetric({ value: '123456', unit: 'currency_minor', currency: 'CNY' }), '¥1,234.56')
  assert.equal(formatMetric({ value: '123456', unit: 'minor_currency' }), '¥1,234.56')
  assert.equal(formatMetric({ value: '0.3602', unit: 'ratio' }), '36.0%')
  assert.equal(formatMetric({ value: '0.5', unit: 'ratio' }), '50.0%')
  assert.equal(formatMetric({ value: 0, unit: 'ratio' }), '0.0%')
  assert.equal(formatMetric({ value: '-3.1', unit: 'percentage_point' }), '-3.1 个百分点')
  assert.equal(formatMetric({ value: 12345, unit: 'count' }), '12,345')
  assert.equal(formatMetric({ value: 0, unit: 'count' }), '0')
  assert.equal(formatMetric({ value: '123', unit: 'unknown' }), '123')
})

test('formatMetric returns an em dash for missing values and non-finite numbers', () => {
  assert.equal(formatMetric(null), '—')
  assert.equal(formatMetric({ value: null }), '—')
  assert.equal(formatMetric({ value: undefined }), '—')
  assert.equal(formatMetric({ value: 'abc', unit: 'count' }), '—')
})

test('formatRate renders a signed percentage change', () => {
  assert.equal(formatRate(0.3602), '+36.0%')
  assert.equal(formatRate(0.5), '+50.0%')
  assert.equal(formatRate(0), '+0.0%')
  assert.equal(formatRate(-0.031), '-3.1%')
  assert.equal(formatRate(-1), '-100.0%')
  assert.equal(formatRate('0.1'), '+10.0%')
})

test('formatRate returns an em dash for empty or non-finite input', () => {
  assert.equal(formatRate(null), '—')
  assert.equal(formatRate(undefined), '—')
  assert.equal(formatRate(''), '—')
  assert.equal(formatRate('abc'), '—')
})

test('errorText maps known error codes and statuses to Chinese guidance', () => {
  assert.equal(errorText({ code: 'NETWORK_ERROR' }), '无法连接服务端，请检查网络和接口地址后重试。')
  assert.equal(errorText({ code: 'REQUEST_TIMEOUT' }), '请求超时。若刚提交了写入，请先刷新查询结果，再决定是否重试。')
  assert.equal(errorText({ code: 'MISSING_BUSINESS_ID' }), '尚未选择经营主体，请先完成主体初始化。')
  assert.equal(errorText({ code: 'FEATURE_NOT_AVAILABLE' }), '这项服务尚未接入，请与负责该接口的队友确认。')
  assert.equal(errorText({ code: 'INVALID_RESPONSE' }), '服务端返回格式与接口约定不一致，请检查 data/meta 结构。')
  assert.equal(errorText({ code: 'INVALID_REQUEST' }), '请求参数不符合接口约定，请检查当前输入。')
  assert.equal(errorText({ status: 403 }), '当前账号没有执行此操作的权限。')
  assert.equal(errorText({ status: 409 }), '数据已被更新，请刷新后核对再试。')
  assert.equal(errorText({ status: 412 }), '数据已被更新，请刷新后核对再试。')
  assert.equal(errorText({ status: 401 }), '会话已失效，请重新登录。')
  assert.equal(errorText({ status: 500 }), '服务暂时不可用，请稍后重试。')
  assert.equal(errorText({ status: 503 }), '服务暂时不可用，请稍后重试。')
})

test('errorText stays silent for aborted requests and empty input', () => {
  assert.equal(errorText(null), '')
  assert.equal(errorText(undefined), '')
  assert.equal(errorText({ name: 'AbortError' }), '')
  assert.equal(errorText({ code: 'REQUEST_ABORTED' }), '')
})

test('errorText surfaces the first field error and Chinese messages before generic fallbacks', () => {
  assert.equal(errorText({ fieldErrors: { name: ['名称不能为空'] } }), '名称不能为空')
  assert.equal(errorText({ fieldErrors: { name: [], email: ['邮箱无效'] } }), '邮箱无效')
  assert.equal(errorText({ message: '发生错误' }), '发生错误')
  assert.equal(errorText({ message: 'error occurred' }), '请求失败，请检查输入后重试。')
  assert.equal(errorText({ status: 400 }), '请求失败，请检查输入后重试。')
})

test('errorText prefers an explicit code over a status code', () => {
  assert.equal(errorText({ code: 'NETWORK_ERROR', status: 500 }), '无法连接服务端，请检查网络和接口地址后重试。')
  assert.equal(errorText({ status: 403, fieldErrors: { a: ['x'] } }), '当前账号没有执行此操作的权限。')
})

test('isPendingJob reports the in-flight job statuses', () => {
  for (const status of ['queued', 'running', 'parsing', 'committing', 'recognizing']) {
    assert.equal(isPendingJob(status), true)
  }
  for (const status of ['completed', 'failed', 'cancelled', '']) {
    assert.equal(isPendingJob(status), false)
  }
  assert.equal(isPendingJob(undefined), false)
})

test('asItems extracts items from an envelope, returns an array directly, or defaults to empty', () => {
  assert.deepEqual(asItems({ items: [1, 2, 3] }), [1, 2, 3])
  assert.deepEqual(asItems([1, 2, 3]), [1, 2, 3])
  assert.deepEqual(asItems([]), [])
  assert.deepEqual(asItems({ data: [1, 2] }), [])
  assert.deepEqual(asItems({ items: 'nope' }), [])
  assert.deepEqual(asItems(null), [])
  assert.deepEqual(asItems(undefined), [])
})
