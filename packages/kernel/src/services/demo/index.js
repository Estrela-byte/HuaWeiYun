/**
 * Explicit, in-memory SME-I demo transport. Each call owns a fresh ledger.
 * Inject only when the application has deliberately selected demo mode:
 * createApiClient({ fetchImpl: createDemoFetch(), getBusinessId: () => 'demo-business' }).
 * Production requests must use the normal fetch implementation; there is no fallback here.
 */

const BUSINESS_ID = 'demo-business'
const NOW = '2026-06-30T10:00:00.000Z'
const DEFAULT_QUERY = { startDate: '2026-06-01', endDate: '2026-07-01', timezone: 'Asia/Shanghai', granularity: 'month' }
const MONEY = /^(?:[1-9]\d*)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const clone = (value) => structuredClone(value)
const cents = (value) => BigInt(value ?? '0')
const amount = (value) => cents(value).toString()
const iso = () => new Date().toISOString()
const entity = (id, extra = {}) => ({ ...extra, id, revision: '1', createdAt: extra.createdAt ?? NOW, updatedAt: extra.updatedAt ?? NOW })
const pick = (input, allowed) => Object.fromEntries(Object.entries(input ?? {}).filter(([field]) => allowed.includes(field)))

const categorySeeds = [
  entity('cat_sales', { name: '销售收入', parentId: null, direction: 'inflow', metricRole: 'operating_revenue', archived: false }),
  entity('cat_materials', { name: '原材料', parentId: null, direction: 'outflow', metricRole: 'operating_expense', archived: false }),
  entity('cat_labor', { name: '人工', parentId: null, direction: 'outflow', metricRole: 'operating_expense', archived: false }),
  entity('cat_rent', { name: '房租', parentId: null, direction: 'outflow', metricRole: 'operating_expense', archived: false }),
  entity('cat_other', { name: '其他经营支出', parentId: null, direction: 'outflow', metricRole: 'operating_expense', archived: false }),
]

const ledgerSeeds = [
  ['2026-05-15', 'inflow', 'sale', '6000000', 'cat_sales', '五月销售收入（一）'],
  ['2026-05-31', 'inflow', 'sale', '7520000', 'cat_sales', '五月销售收入（二）'],
  ['2026-05-12', 'outflow', 'expense', '3290000', 'cat_materials', '五月原材料采购'],
  ['2026-05-20', 'outflow', 'expense', '2150000', 'cat_labor', '五月员工工资'],
  ['2026-05-25', 'outflow', 'expense', '1480000', 'cat_rent', '五月房租'],
  ['2026-05-29', 'outflow', 'expense', '1313680', 'cat_other', '五月其他经营支出'],
  ['2026-06-14', 'inflow', 'sale', '845000', 'cat_sales', '门店销售收入'],
  ['2026-06-20', 'inflow', 'sale', '6000000', 'cat_sales', '六月销售收入（一）'],
  ['2026-06-30', 'inflow', 'sale', '5995000', 'cat_sales', '六月销售收入（二）'],
  ['2026-06-15', 'outflow', 'expense', '3690000', 'cat_materials', '六月原材料采购'],
  ['2026-06-14', 'outflow', 'expense', '2200000', 'cat_labor', '六月员工工资'],
  ['2026-06-13', 'outflow', 'expense', '1480000', 'cat_rent', '六月房租'],
  ['2026-06-13', 'outflow', 'expense', '845000', 'cat_other', '六月其他经营支出'],
  // A real-looking transfer is intentionally excluded from all operating metrics.
  ['2026-06-16', 'outflow', 'transfer', '500000', null, '账户之间转账'],
]

function seedTransactions() {
  return ledgerSeeds.map(([businessDate, direction, kind, amountMinor, categoryId, summary], index) => entity(`txn_demo_${String(index + 1).padStart(3, '0')}`, {
    businessId: BUSINESS_ID, businessDate, direction, kind, amountMinor, currency: 'CNY', categoryId, summary,
    status: 'posted', categoryStatus: categoryId ? 'confirmed' : 'unclassified', source: { platform: 'manual' },
  }))
}

class DemoFailure extends Error {
  constructor(code, message, status = 400, fieldErrors = {}) {
    super(message)
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function fail(code, message, status = 400, fieldErrors) { throw new DemoFailure(code, message, status, fieldErrors) }
function assert(condition, code, message, status = 400, fieldErrors) { if (!condition) fail(code, message, status, fieldErrors) }
function response(data, meta = {}, status = 200) {
  return new Response(JSON.stringify({ data, meta }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Data-Version': meta.dataVersion ?? '' } })
}
function errorResponse(error, requestId) {
  const known = error instanceof DemoFailure
  const status = known ? error.status : 500
  return new Response(JSON.stringify({ error: {
    code: known ? error.code : 'DEMO_INTERNAL_ERROR',
    message: known ? error.message : '演示数据处理失败。',
    ...(known && Object.keys(error.fieldErrors).length ? { fieldErrors: error.fieldErrors } : {}),
  }, meta: { requestId } }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}
function bump(record) { record.revision = String(Number(record.revision) + 1); record.updatedAt = iso(); return record }
function getRecord(collection, id) {
  const record = collection.find((item) => item.id === id)
  assert(record, 'NOT_FOUND', '找不到这条记录。', 404)
  return record
}
function checkRevision(record, headers) {
  const received = headers.get('If-Match')?.replace(/^"|"$/g, '')
  assert(received !== undefined, 'REVISION_REQUIRED', '请先读取最新记录版本。', 428)
  assert(received === record.revision, 'REVISION_CONFLICT', '记录已变化，请刷新后核对。', 412)
}
function page(items, query) {
  const limit = Math.max(1, Math.min(100, Number(query.get('limit') ?? query.get('pageSize') ?? 20) || 20))
  const offset = query.has('cursor') ? Number(query.get('cursor')) : (Math.max(1, Number(query.get('page') ?? 1)) - 1) * limit
  assert(Number.isInteger(offset) && offset >= 0, 'INVALID_CURSOR', '分页位置无效。', 422)
  return { items: clone(items.slice(offset, offset + limit)), nextCursor: offset + limit < items.length ? String(offset + limit) : null, total: items.length }
}
function validBusinessDate(value) {
  if (!DATE.test(value ?? '')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
function validateTransaction(input) {
  const errors = {}
  if (!validBusinessDate(input.businessDate)) errors.businessDate = ['请输入有效日期。']
  if (!['inflow', 'outflow'].includes(input.direction)) errors.direction = ['请选择收入或支出。']
  if (!['sale', 'expense', 'refund', 'transfer', 'settlement', 'loan', 'owner_contribution', 'other'].includes(input.kind)) errors.kind = ['请选择有效业务类型。']
  if (!MONEY.test(String(input.amountMinor ?? ''))) errors.amountMinor = ['金额必须为正整数分。']
  if (input.currency !== 'CNY') errors.currency = ['演示账本仅支持人民币。']
  if (!String(input.summary ?? '').trim()) errors.summary = ['请填写摘要。']
  if (Object.keys(errors).length) fail('VALIDATION_ERROR', '请检查流水内容。', 422, errors)
  return input
}
function validateBusinessKind(input, transactions, currentId = null) {
  if (input.kind === 'sale') assert(input.direction === 'inflow', 'INVALID_KIND_DIRECTION', '销售收入必须为流入。', 422, { direction: ['销售收入必须为流入。'] })
  if (input.kind === 'expense') assert(input.direction === 'outflow', 'INVALID_KIND_DIRECTION', '经营支出必须为流出。', 422, { direction: ['经营支出必须为流出。'] })
  if (input.kind !== 'refund') return
  const original = transactions.find((item) => item.id === input.originalTransactionId && item.status === 'posted')
  assert(original && ['sale', 'expense'].includes(original.kind), 'INVALID_REFUND_LINK', '退款必须关联已入账的销售或经营支出流水。', 422, { originalTransactionId: ['请选择对应的已入账原流水。'] })
  const expectedDirection = original.kind === 'sale' ? 'outflow' : 'inflow'
  assert(input.direction === expectedDirection, 'INVALID_REFUND_DIRECTION', '退款收支方向与原流水不符。', 422, { direction: ['请核对退款方向。'] })
  const previouslyRefunded = transactions.filter((item) => item.id !== currentId && item.status === 'posted' && item.kind === 'refund' && item.originalTransactionId === original.id).reduce((sum, item) => sum + cents(item.amountMinor), 0n)
  assert(previouslyRefunded + cents(input.amountMinor) <= cents(original.amountMinor), 'REFUND_EXCEEDS_ORIGINAL', '累计退款不能超过原流水金额。', 422, { amountMinor: ['累计退款超过原流水金额。'] })
}
function postedRefundsFor(transactions, originalId) {
  return transactions.filter((item) => item.status === 'posted' && item.kind === 'refund' && item.originalTransactionId === originalId)
}
function validateRefundDependents(original, transactions) {
  const refunds = postedRefundsFor(transactions, original.id)
  if (!refunds.length) return
  const refundDirection = original.kind === 'sale' ? 'outflow' : original.kind === 'expense' ? 'inflow' : null
  assert(original.status === 'posted' && refundDirection && refunds.every((item) => item.direction === refundDirection && (item.categoryId ?? null) === (original.categoryId ?? null)),
    'ORIGINAL_HAS_REFUNDS', '这笔原流水已有退款，不能改变其业务类型、方向或作废。', 409)
  const refunded = refunds.reduce((sum, item) => sum + cents(item.amountMinor), 0n)
  assert(refunded <= cents(original.amountMinor), 'REFUND_EXCEEDS_ORIGINAL', '原流水金额不能低于累计退款。', 422,
    { amountMinor: ['原流水金额不能低于累计退款。'] })
}
function ratio(numerator, denominator, scale = 4) {
  if (denominator === 0n) return null
  const factor = 10n ** BigInt(scale)
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  const rounded = absoluteNumerator * factor * 2n / absoluteDenominator
  const fixed = (rounded + 1n) / 2n
  const sign = fixed !== 0n && (numerator < 0n) !== (denominator < 0n) ? '-' : ''
  return `${sign}${fixed / factor}.${String(fixed % factor).padStart(scale, '0')}`
}
function metric(id, label, value, unit, formula, evidenceId, quality = 'complete') {
  return { id, label, value, unit, ...(unit === 'currency_minor' ? { currency: 'CNY' } : {}),
    definition: { basis: '已入账经营流水；转账、借款和资金划转不计入。', formula }, quality, ...(evidenceId ? { evidenceId } : {}) }
}
function rangeTransactions(transactions, query) {
  return transactions.filter((item) => item.status === 'posted' && item.businessDate >= query.startDate && item.businessDate < query.endDate)
}
function totals(transactions, query) {
  const selected = rangeTransactions(transactions, query)
  let revenue = 0n; let expense = 0n
  for (const item of selected) {
    if (item.kind === 'sale' && item.direction === 'inflow') revenue += cents(item.amountMinor)
    else if (item.kind === 'expense' && item.direction === 'outflow') expense += cents(item.amountMinor)
    else if (item.kind === 'refund' && item.originalTransactionId) {
      const original = transactions.find((entry) => entry.id === item.originalTransactionId)
      if (original?.kind === 'sale' && item.direction === 'outflow') revenue -= cents(item.amountMinor)
      if (original?.kind === 'expense' && item.direction === 'inflow') expense -= cents(item.amountMinor)
    }
  }
  return { revenue, expense, surplus: revenue - expense, surplusRate: ratio(revenue - expense, revenue), selected }
}
function queryFrom(search) {
  const query = { ...DEFAULT_QUERY }
  for (const key of ['startDate', 'endDate', 'timezone', 'granularity', 'comparison', 'compareStartDate', 'compareEndDate', 'metricBasis', 'storeId', 'categoryId', 'dataVersion', 'snapshotId']) {
    if (search.has(key)) query[key] = search.get(key)
  }
  assert(DATE.test(query.startDate) && DATE.test(query.endDate) && query.startDate < query.endDate, 'INVALID_PERIOD', '日期范围无效。', 422)
  assert(['day', 'week', 'month'].includes(query.granularity), 'INVALID_PERIOD', '统计粒度无效。', 422)
  return query
}
function previousPeriod(query) {
  if (query.comparison === 'custom' && query.compareStartDate && query.compareEndDate) return { ...query, startDate: query.compareStartDate, endDate: query.compareEndDate }
  if (query.comparison === 'previous_year') return { ...query, startDate: `${Number(query.startDate.slice(0, 4)) - 1}${query.startDate.slice(4)}`, endDate: `${Number(query.endDate.slice(0, 4)) - 1}${query.endDate.slice(4)}` }
  if (query.granularity === 'month' && query.startDate.endsWith('-01') && query.endDate.endsWith('-01')) {
    const start = new Date(`${query.startDate}T00:00:00Z`)
    const end = new Date(`${query.endDate}T00:00:00Z`)
    const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
    const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - months, 1))
    return { ...query, startDate: previousStart.toISOString().slice(0, 10), endDate: query.startDate }
  }
  const length = Date.parse(`${query.endDate}T00:00:00Z`) - Date.parse(`${query.startDate}T00:00:00Z`)
  return { ...query, startDate: new Date(Date.parse(`${query.startDate}T00:00:00Z`) - length).toISOString().slice(0, 10), endDate: query.startDate }
}
function metricList(values, evidenceIds = {}) {
  return [
    metric('sales_revenue', '销售收入', values.revenue.toString(), 'currency_minor', '经营销售流入减去对应销售退款', evidenceIds.sales_revenue),
    metric('operating_expense', '经营支出', values.expense.toString(), 'currency_minor', '经营支出减去对应支出退款', evidenceIds.operating_expense),
    metric('operating_surplus', '经营结余', values.surplus.toString(), 'currency_minor', '销售收入－经营支出；不等于会计净利润或毛利', evidenceIds.operating_surplus),
    metric('operating_surplus_rate', '经营结余率', values.surplusRate, 'ratio', '经营结余÷销售收入', evidenceIds.operating_surplus_rate, values.surplusRate === null ? 'unavailable' : 'complete'),
  ]
}
function splitCsv(text) {
  const lines = []; let row = []; let field = ''; let quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char === '"' && quoted && input[i + 1] === '"') { field += '"'; i++ }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field); if (row.some((value) => value.trim())) lines.push(row); row = []; field = ''
    } else field += char
  }
  assert(!quoted, 'INVALID_IMPORT', 'CSV 引号未闭合。', 422)
  row.push(field); if (row.some((value) => value.trim())) lines.push(row)
  assert(lines.length >= 2, 'INVALID_IMPORT', 'CSV 需要表头和至少一行交易。', 422)
  return lines
}
function matchColumn(header, names) { return header.find((name) => names.some((alias) => name.toLowerCase().includes(alias.toLowerCase()))) }
function inferMapping(header) {
  return {
    businessDate: matchColumn(header, ['businessDate', '交易时间', '交易日期', '日期', 'time', 'date']),
    direction: header.find((name) => /^(direction|收支|收\/支|收支类型|资金方向|income\/expense)$/i.test(name.trim())) ?? matchColumn(header, ['收支方向', '收/支']),
    kind: header.find((name) => /^(kind|transactiontype|transaction_type|交易类型|业务类型|订单类型)$/i.test(name.trim())),
    amountMinor: matchColumn(header, ['amountMinor', '金额(分)', '金额（分）']),
    amountYuan: matchColumn(header, ['amount', '金额(元)', '金额（元）', '交易金额']),
    summary: matchColumn(header, ['summary', '商品', '备注', '交易对方', '说明']),
    sourceTransactionId: header.find((name) => !/^原|original/i.test(name) && ['sourceTransactionId', '交易单号', '交易订单号', '流水号'].some((alias) => name.toLowerCase().includes(alias.toLowerCase()))),
    originalTransactionId: header.find((name) => /^(originalTransactionId|原流水ID|原记录ID|关联流水ID)$/i.test(name.trim())),
    originalSourceTransactionId: header.find((name) => /^(原交易单号|原订单号|originalSourceTransactionId)$/i.test(name.trim())),
  }
}
function yuanToMinor(value) {
  const clean = String(value ?? '').replace(/[¥￥,\s]/g, '')
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(clean)) return null
  const [whole, decimal = ''] = clean.split('.')
  return (BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'))).toString()
}
function classify(summary, direction) {
  if (direction === 'inflow') return ['cat_sales', 0.9]
  if (/原材料|进货|采购|咖啡豆|奶茶粉/.test(summary)) return ['cat_materials', 0.9]
  if (/工资|薪资|人工/.test(summary)) return ['cat_labor', 0.9]
  if (/房租|租金/.test(summary)) return ['cat_rent', 0.9]
  return [null, null]
}
function detectKind(rawKind, summary, direction) {
  const declared = String(rawKind ?? '').trim().toLowerCase()
  const details = `${declared} ${summary}`
  const refundSignal = /refund|退款|退货|退单|订单撤销/.test(details)
  const transferSignal = /transfer|转账|划转|提现|充值|转入|转出/.test(details)
  if (refundSignal && transferSignal) return { kind: 'other', needsReview: true, reason: '退款与转账描述冲突，请人工确认业务类型。' }
  if (refundSignal) return { kind: 'refund', needsReview: true, reason: '退款需关联原销售或支出流水。' }
  if (transferSignal) {
    const unambiguous = /^(transfer)$/.test(declared) || /账户互转|账户间转账|本人账户转账|自有账户转账|内部划转|同名账户划转/.test(details)
    return { kind: 'transfer', needsReview: !unambiguous, reason: unambiguous ? null : '转账用途不明确，请核对是否属于经营支出。' }
  }
  if (/^(sale|sales|销售|商户收款|营业收入)$/.test(declared)) return { kind: 'sale', needsReview: direction !== 'inflow', reason: direction === 'inflow' ? null : '销售方向异常，请核对。' }
  if (/^(expense|经营支出|商户消费|采购|工资|房租)$/.test(declared)) return { kind: 'expense', needsReview: direction !== 'outflow', reason: direction === 'outflow' ? null : '支出方向异常，请核对。' }
  if (/^(settlement|结算)$/.test(declared)) return { kind: 'settlement', needsReview: false, reason: null }
  if (/^(loan|借款|贷款)$/.test(declared)) return { kind: 'loan', needsReview: false, reason: null }
  if (/^(owner_contribution|业主投入|老板投入)$/.test(declared)) return { kind: 'owner_contribution', needsReview: false, reason: null }
  if (declared && !/^(收入|支出|收款|付款)$/.test(declared)) return { kind: 'other', needsReview: true, reason: '无法可靠识别业务类型，请人工确认。' }
  if (direction === 'inflow' && /销售|营业收入|订单收入|商户收款/.test(summary)) return { kind: 'sale', needsReview: false, reason: null }
  if (direction === 'outflow' && /原材料|采购|进货|工资|薪资|人工|房租|租金|经营支出|货款/.test(summary)) return { kind: 'expense', needsReview: false, reason: null }
  return { kind: 'other', needsReview: true, reason: '流水用途不明确，请人工确认业务类型。' }
}
function makeImportRow(raw, index, mapping, platform, transactions) {
  const value = (key) => mapping[key] ? raw[mapping[key]] : undefined
  const businessDate = String(value('businessDate') ?? '').slice(0, 10).replaceAll('/', '-')
  const directionText = String(value('direction') ?? '').toLowerCase()
  const direction = /收入|收款|inflow|income|\+|^收$/.test(directionText) ? 'inflow' : /支出|付款|outflow|expense|\-|^支$/.test(directionText) ? 'outflow' : undefined
  const amountMinor = value('amountMinor') !== undefined ? String(value('amountMinor')).replace(/[,\s]/g, '') : yuanToMinor(value('amountYuan'))
  const summary = String(value('summary') ?? '账单导入').trim()
  const detected = detectKind(value('kind'), summary, direction)
  const [suggestedCategoryId, categoryConfidence] = ['sale', 'expense'].includes(detected.kind) ? classify(summary, direction) : [null, null]
  const mappedCategoryId = String(value('categoryId') ?? '').trim()
  const sourceOriginalId = String(value('originalSourceTransactionId') ?? '').trim()
  const matches = sourceOriginalId ? transactions.filter((item) => item.source.platform === platform && item.source.sourceTransactionId === sourceOriginalId && item.status === 'posted') : []
  const originalTransactionId = String(value('originalTransactionId') ?? '').trim() || (matches.length === 1 ? matches[0].id : '')
  const original = transactions.find((item) => item.id === originalTransactionId && item.status === 'posted')
  const categoryId = mappedCategoryId || (detected.kind === 'refund' ? original?.categoryId : suggestedCategoryId) || null
  const sourceTransactionId = String(value('sourceTransactionId') ?? '').trim()
  const duplicate = sourceTransactionId && transactions.find((txn) => txn.source.platform === platform && txn.source.sourceTransactionId === sourceTransactionId)
  const fieldErrors = {}
  if (!validBusinessDate(businessDate)) fieldErrors.businessDate = ['无法识别日期。']
  if (!direction) fieldErrors.direction = ['无法识别收支方向。']
  if (!MONEY.test(String(amountMinor ?? ''))) fieldErrors.amountMinor = ['无法识别有效金额。']
  const draft = { businessDate, direction, kind: detected.kind, amountMinor, currency: 'CNY', categoryId, summary, ...(originalTransactionId ? { originalTransactionId } : {}) }
  const reviewReasons = []
  if (detected.needsReview) reviewReasons.push(detected.reason)
  if (detected.kind === 'refund') {
    try { validateTransaction(draft); validateBusinessKind(draft, transactions) }
    catch (error) { reviewReasons.push(error.message) }
  }
  if (['sale', 'expense'].includes(detected.kind) && !categoryId) reviewReasons.push('请确认经营分类。')
  const status = Object.keys(fieldErrors).length ? 'invalid' : duplicate ? 'duplicate' : reviewReasons.length ? 'needs_review' : 'ready'
  return { id: `row_${index}`, revision: '1', rowNumber: index + 1, raw, draft, status, categoryConfidence, fieldErrors, reviewReasons, ...(duplicate ? { duplicateTransactionId: duplicate.id } : {}), sourceTransactionId, categoryConfirmed: Boolean(categoryId), kindConfirmed: !detected.needsReview }
}
function batchCounts(rows) {
  const counts = { total: rows.length, invalid: 0, duplicate: 0, ready: 0, needsReview: 0, posted: 0 }
  for (const row of rows) {
    if (row.status === 'needs_review') counts.needsReview++
    else if (row.status in counts) counts[row.status]++
  }
  return counts
}

/** @returns {typeof fetch} A private, stateful fetch-compatible demo adapter. */
export function createDemoFetch() {
  const state = {
    signedIn: true, version: 1, sequence: 100, requestNumber: 0,
    profile: entity(BUSINESS_ID, { name: '悦茶饮品店', industry: '餐饮', currency: 'CNY', timezone: 'Asia/Shanghai', capabilities: { billImport: true, analytics: true, assistant: true, ocr: false, alerts: false, memberManagement: false, backup: false, export: false }, supportedImportFormats: ['csv'], supportedExportFormats: [] }),
    categories: clone(categorySeeds), transactions: seedTransactions(), products: [], allocations: [], imports: [], jobs: [], conversations: [], messages: [], evidence: new Map(), idempotency: new Map(),
  }
  const nextId = (prefix) => `${prefix}_demo_${++state.sequence}`
  const dataMeta = (requestId) => ({ requestId, dataVersion: String(state.version), generatedAt: iso() })
  const change = () => { state.version++ }

  function createEvidence(query, metrics, selected) {
    const snapshotId = `snapshot_${state.version}_${++state.sequence}`
    const ids = {}
    for (const item of metrics) ids[item.id] = `evidence_${snapshotId}_${item.id}`
    const finalMetrics = metricList(totals(state.transactions, query), ids)
    const isRevenue = (item) => item.kind === 'sale' && item.direction === 'inflow' || item.kind === 'refund' && item.direction === 'outflow' && state.transactions.find((original) => original.id === item.originalTransactionId)?.kind === 'sale'
    const isExpense = (item) => item.kind === 'expense' && item.direction === 'outflow' || item.kind === 'refund' && item.direction === 'inflow' && state.transactions.find((original) => original.id === item.originalTransactionId)?.kind === 'expense'
    for (const item of finalMetrics) state.evidence.set(item.evidenceId, {
      id: item.evidenceId, snapshotId, dataVersion: String(state.version), query: clone(query), metrics: clone(finalMetrics),
      transactions: clone(selected.filter((record) => item.id === 'sales_revenue' ? isRevenue(record) : item.id === 'operating_expense' ? isExpense(record) : isRevenue(record) || isExpense(record))),
    })
    return { metrics: finalMetrics, snapshotId }
  }
  function analytic(query) {
    const values = totals(state.transactions, query)
    const snap = createEvidence(query, metricList(values), values.selected)
    return { ...snap, values }
  }
  function entityCreate(collection, prefix, input, extra = {}) {
    const record = entity(nextId(prefix), { ...input, ...extra, createdAt: iso(), updatedAt: iso() })
    collection.push(record); change(); return record
  }
  function entityUpdate(collection, id, patch, headers) {
    const record = getRecord(collection, id); checkRevision(record, headers)
    Object.assign(record, patch); bump(record); change(); return record
  }
  function checkCategory(categoryId, direction) {
    if (!categoryId) return
    const category = getRecord(state.categories, categoryId)
    assert(!category.archived && category.direction === direction, 'INVALID_CATEGORY', '分类与收支方向不符或已归档。', 422)
  }
  function checkTransactionCategory(input) {
    if (input.kind !== 'refund') return checkCategory(input.categoryId, input.direction)
    const original = state.transactions.find(item => item.id === input.originalTransactionId && item.status === 'posted')
    assert(original && (input.categoryId ?? null) === (original.categoryId ?? null), 'INVALID_REFUND_CATEGORY', '退款分类应沿用原流水分类。', 422, { categoryId: ['请选择原流水的分类。'] })
  }
  function summaryText(current, previous) {
    const deltaRevenue = current.revenue - previous.revenue
    const deltaExpense = current.expense - previous.expense
    const deltaSurplus = current.surplus - previous.surplus
    const fmt = (value) => `${value < 0n ? '-' : ''}¥${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`
    return `本期销售收入 ${fmt(current.revenue)}，较上期变化 ${fmt(deltaRevenue)}；经营支出 ${fmt(current.expense)}，变化 ${fmt(deltaExpense)}；经营结余 ${fmt(current.surplus)}，变化 ${fmt(deltaSurplus)}。这是账目层面的变化，无法仅凭流水确认客流、售价或供应商报价的实际原因。`
  }

  /** @type {typeof fetch} */
  return async function demoFetch(input, init = {}) {
    const requestId = `demo_req_${++state.requestNumber}`
    try {
      const url = new URL(String(input), 'http://demo.local')
      assert(url.pathname.startsWith('/api/v1/'), 'NOT_FOUND', '演示接口不存在。', 404)
      const path = url.pathname.slice('/api/v1'.length)
      const method = String(init.method ?? 'GET').toUpperCase()
      const headers = new Headers(init.headers)
      assert(!init.signal?.aborted, 'REQUEST_ABORTED', '请求已取消。', 499)
      let body = null
      if (init.body instanceof FormData) body = init.body
      else if (typeof init.body === 'string' && init.body.length) {
        try { body = JSON.parse(init.body) } catch { fail('INVALID_JSON', '请求 JSON 无效。', 400) }
      }
      const key = headers.get('Idempotency-Key')
      const identity = `${headers.get('X-Business-Id') ?? 'account'} ${method} ${path} ${key}`
      const signature = body instanceof FormData
        ? JSON.stringify(await Promise.all([...body.entries()].map(async ([name, value]) => [name, value instanceof Blob ? { filename: value.name, type: value.type, content: await value.text() } : value])))
        : JSON.stringify(body)
      if (!path.startsWith('/auth/')) {
        assert(state.signedIn, 'UNAUTHENTICATED', '演示会话已退出，请重新登录。', 401)
        if (!(path === '/business/profile' && method === 'POST')) {
          assert(headers.get('X-Business-Id') === BUSINESS_ID, 'BUSINESS_FORBIDDEN', '此演示主体不可访问。', 403)
        }
      }
      if (method !== 'GET' && key && state.idempotency.has(identity)) {
        const prior = state.idempotency.get(identity)
        assert(prior.signature === signature, 'IDEMPOTENCY_CONFLICT', '同一幂等键对应不同内容。', 409)
        return response(clone(prior.data), { ...prior.meta, requestId }, prior.status)
      }
      let result; let status = 200
      const match = (...parts) => { const found = path.match(new RegExp(`^/${parts.join('/')}$`)); return found?.slice(1) }

      if (path === '/auth/me' && method === 'GET') {
        assert(state.signedIn, 'UNAUTHENTICATED', '演示会话已退出，请重新登录。', 401)
        result = { id: 'demo-user', displayName: '演示经营者', businessIds: [BUSINESS_ID], permissions: ['*'], capabilities: state.profile.capabilities }
      } else if (path === '/auth/session' && method === 'GET') {
        assert(state.signedIn, 'UNAUTHENTICATED', '演示会话已退出，请重新登录。', 401)
        result = { user: { id: 'demo-user', displayName: '演示经营者', businessIds: [BUSINESS_ID], permissions: ['*'] }, expiresAt: '2099-01-01T00:00:00.000Z' }
      } else if (path === '/auth/session' && method === 'POST') {
        state.signedIn = true; result = { user: { id: 'demo-user', displayName: '演示经营者', businessIds: [BUSINESS_ID], permissions: ['*'] }, expiresAt: '2099-01-01T00:00:00.000Z' }
      } else if (path === '/auth/session' && method === 'DELETE') {
        state.signedIn = false; result = null
      } else if (path === '/business/profile' && method === 'GET') {
        result = clone(state.profile)
      } else if (path === '/business/profile' && method === 'POST') {
        fail('BUSINESS_EXISTS', '演示主体已初始化。', 409)
      } else if (path === '/business/profile' && method === 'PATCH') {
        checkRevision(state.profile, headers)
        for (const property of ['name', 'industry', 'timezone']) if (body?.[property] !== undefined) state.profile[property] = String(body[property])
        bump(state.profile); change(); result = clone(state.profile)
      } else if (path === '/transactions' && method === 'GET') {
        let items = [...state.transactions]
        for (const field of ['direction', 'kind', 'categoryId', 'status', 'importId']) {
          const value = url.searchParams.get(field)
          if (value) items = items.filter((item) => field === 'importId' ? item.source.importId === value : String(item[field]) === value)
        }
        if (url.searchParams.has('startDate')) items = items.filter((item) => item.businessDate >= url.searchParams.get('startDate'))
        if (url.searchParams.has('endDate')) items = items.filter((item) => item.businessDate < url.searchParams.get('endDate'))
        if (url.searchParams.has('search')) items = items.filter((item) => item.summary.includes(url.searchParams.get('search')))
        items.sort((a, b) => b.businessDate.localeCompare(a.businessDate) || b.id.localeCompare(a.id))
        result = page(items, url.searchParams)
      } else if (path === '/transactions' && method === 'POST') {
        validateTransaction(body ?? {})
        validateBusinessKind(body, state.transactions)
        checkTransactionCategory(body)
        result = clone(entityCreate(state.transactions, 'txn', { ...body, businessId: BUSINESS_ID, amountMinor: amount(body.amountMinor), status: 'posted', categoryStatus: body.categoryId ? 'confirmed' : 'unclassified', source: { platform: 'manual' } }))
        status = 201
      } else if (path === '/transactions/bulk-category' && method === 'PATCH') {
        const category = getRecord(state.categories, body?.categoryId)
        assert(!category.archived, 'CATEGORY_ARCHIVED', '分类已归档。', 422)
        const items = (body?.items ?? []).map(({ id, revision }) => {
          const record = state.transactions.find((item) => item.id === id)
          if (!record) return { id, status: 'failed', error: { code: 'NOT_FOUND', message: '流水不存在。' } }
          if (record.revision !== revision) return { id, status: 'failed', error: { code: 'REVISION_CONFLICT', message: '版本冲突。' } }
          try {
            const next = { ...record, categoryId: category.id }
            checkTransactionCategory(next)
            validateRefundDependents(next, state.transactions)
          } catch (error) {
            return { id, status: 'failed', error: { code: error.code, message: error.message } }
          }
          record.categoryId = category.id; record.categoryStatus = 'confirmed'; bump(record); return { id, status: 'updated' }
        })
        if (items.some((item) => item.status === 'updated')) change()
        result = { items }
      } else if (match('transactions', '([^/]+)') && method === 'GET') {
        result = clone(getRecord(state.transactions, decodeURIComponent(path.split('/')[2])))
      } else if (match('transactions', '([^/]+)') && method === 'PATCH') {
        const id = decodeURIComponent(path.split('/')[2]); const previous = getRecord(state.transactions, id)
        const next = { ...previous, ...body }
        validateTransaction(next)
        validateBusinessKind(next, state.transactions, id)
        checkTransactionCategory(next)
        validateRefundDependents(next, state.transactions)
        const allowed = ['businessDate', 'direction', 'kind', 'amountMinor', 'currency', 'categoryId', 'summary', 'productId', 'receiptId', 'originalTransactionId', 'note']
        const patch = Object.fromEntries(Object.entries(body ?? {}).filter(([name]) => allowed.includes(name)))
        if (patch.amountMinor !== undefined) patch.amountMinor = amount(patch.amountMinor)
        patch.categoryStatus = next.categoryId ? 'confirmed' : 'unclassified'
        result = clone(entityUpdate(state.transactions, id, patch, headers))
      } else if (match('transactions', '([^/]+)', 'void') && method === 'POST') {
        const id = decodeURIComponent(path.split('/')[2]); const record = getRecord(state.transactions, id)
        checkRevision(record, headers); assert(record.status !== 'voided', 'ALREADY_VOIDED', '流水已经作废。', 409)
        assert(String(body?.reason ?? '').trim(), 'VALIDATION_ERROR', '请填写作废原因。', 422)
        assert(!postedRefundsFor(state.transactions, id).length, 'ORIGINAL_HAS_REFUNDS', '这笔原流水已有退款，不能直接作废。', 409)
        record.status = 'voided'; record.voidReason = body.reason; bump(record); change(); result = clone(record)
      } else if (path === '/categories' && method === 'GET') {
        const items = state.categories.filter((item) => (!url.searchParams.has('direction') || item.direction === url.searchParams.get('direction')) && (!url.searchParams.has('archived') || item.archived === (url.searchParams.get('archived') === 'true')))
        result = page(items, url.searchParams)
      } else if (path === '/categories' && method === 'POST') {
        assert(String(body?.name ?? '').trim() && ['inflow', 'outflow'].includes(body?.direction), 'VALIDATION_ERROR', '请填写分类名称和方向。', 422)
        result = clone(entityCreate(state.categories, 'cat', { ...pick(body, ['name', 'parentId', 'direction', 'metricRole']), archived: false })); status = 201
      } else if (match('categories', '([^/]+)') && method === 'PATCH') {
        const id = decodeURIComponent(path.split('/')[2]); result = clone(entityUpdate(state.categories, id, pick(body, ['name', 'parentId', 'direction', 'metricRole']), headers))
      } else if (match('categories', '([^/]+)', 'archive') && method === 'POST') {
        const id = decodeURIComponent(path.split('/')[2]); result = clone(entityUpdate(state.categories, id, { archived: true }, headers))
      } else if (path === '/products' && method === 'GET') {
        result = page(state.products.filter((item) => !url.searchParams.has('archived') || item.archived === (url.searchParams.get('archived') === 'true')), url.searchParams)
      } else if (path === '/products' && method === 'POST') {
        assert(String(body?.name ?? '').trim() && MONEY.test(String(body?.priceMinor ?? '')) && MONEY.test(String(body?.costMinor ?? '')), 'VALIDATION_ERROR', '请填写商品和有效的参考价格。', 422)
        result = clone(entityCreate(state.products, 'product', { ...pick(body, ['name', 'sku', 'priceMinor', 'costMinor', 'currency']), archived: false })); status = 201
      } else if (match('products', '([^/]+)') && method === 'GET') {
        result = clone(getRecord(state.products, decodeURIComponent(path.split('/')[2])))
      } else if (match('products', '([^/]+)') && method === 'PATCH') {
        result = clone(entityUpdate(state.products, decodeURIComponent(path.split('/')[2]), pick(body, ['name', 'sku', 'priceMinor', 'costMinor', 'currency']), headers))
      } else if (match('products', '([^/]+)', 'archive') && method === 'POST') {
        result = clone(entityUpdate(state.products, decodeURIComponent(path.split('/')[2]), { archived: true }, headers))
      } else if (path === '/cost-allocations' && method === 'GET') {
        result = page(state.allocations.filter((item) => !url.searchParams.has('status') || item.status === url.searchParams.get('status')), url.searchParams)
      } else if (path === '/cost-allocations' && method === 'POST') {
        assert(String(body?.name ?? '').trim() && MONEY.test(String(body?.amountMinor ?? '')), 'VALIDATION_ERROR', '请填写成本名称和金额。', 422)
        checkCategory(body.categoryId, 'outflow')
        if (body.sourceTransactionId) getRecord(state.transactions, body.sourceTransactionId)
        result = clone(entityCreate(state.allocations, 'allocation', { ...pick(body, ['name', 'amountMinor', 'currency', 'categoryId', 'periodStart', 'periodEnd', 'sourceTransactionId', 'note']), status: 'active' })); status = 201
      } else if (match('cost-allocations', '([^/]+)') && method === 'GET') {
        result = clone(getRecord(state.allocations, decodeURIComponent(path.split('/')[2])))
      } else if (match('cost-allocations', '([^/]+)') && method === 'PATCH') {
        if (body?.categoryId) checkCategory(body.categoryId, 'outflow')
        result = clone(entityUpdate(state.allocations, decodeURIComponent(path.split('/')[2]), pick(body, ['name', 'amountMinor', 'currency', 'categoryId', 'periodStart', 'periodEnd', 'sourceTransactionId', 'note']), headers))
      } else if (match('cost-allocations', '([^/]+)', 'void') && method === 'POST') {
        assert(String(body?.reason ?? '').trim(), 'VALIDATION_ERROR', '请填写作废原因。', 422)
        result = clone(entityUpdate(state.allocations, decodeURIComponent(path.split('/')[2]), { status: 'voided', voidReason: body.reason }, headers))
      } else if (path === '/imports' && method === 'POST') {
        assert(body instanceof FormData, 'VALIDATION_ERROR', '请上传 CSV 文件。', 422)
        const file = body.get('file') ?? body.get('statement') ?? [...body.values()].find((item) => item instanceof Blob)
        assert(file instanceof Blob, 'VALIDATION_ERROR', '请选择 CSV 文件。', 422)
        const filename = file.name ?? '账单.csv'
        assert(/\.csv$/i.test(filename), 'UNSUPPORTED_IMPORT_FORMAT', '演示导入仅支持 CSV。', 422)
        const platform = String(body.get('platform') ?? (/支付宝/.test(filename) ? 'alipay' : 'wechat'))
        assert(['wechat', 'alipay'].includes(platform), 'VALIDATION_ERROR', '请选择微信或支付宝账单来源。', 422)
        const rows = splitCsv(await file.text())
        const header = rows[0].map((item) => item.trim())
        const mapping = inferMapping(header)
        const rawRows = rows.slice(1).map((line) => Object.fromEntries(header.map((key, index) => [key, line[index] ?? ''])))
        const parsed = rawRows.map((raw, index) => makeImportRow(raw, index, mapping, platform, state.transactions))
        const seenSourceIds = new Set()
        for (const row of parsed) {
          if (!row.sourceTransactionId) continue
          if (seenSourceIds.has(row.sourceTransactionId)) row.status = 'duplicate'
          seenSourceIds.add(row.sourceTransactionId)
        }
        const batch = entity(nextId('import'), { status: 'review', filename, platform, parserVersion: 'demo-csv-1', counts: batchCounts(parsed), rows: parsed, rawRows, mapping, createdAt: iso(), updatedAt: iso() })
        state.imports.push(batch); result = clone(publicBatch(batch)); status = 201
      } else if (path === '/imports' && method === 'GET') {
        result = page(state.imports.filter((item) => !url.searchParams.has('status') || item.status === url.searchParams.get('status')).map(publicBatch), url.searchParams)
      } else if (match('imports', '([^/]+)') && method === 'GET') {
        result = clone(publicBatch(getRecord(state.imports, decodeURIComponent(path.split('/')[2]))))
      } else if (match('imports', '([^/]+)', 'rows') && method === 'GET') {
        const batch = getRecord(state.imports, decodeURIComponent(path.split('/')[2]))
        result = page(batch.rows.filter((item) => !url.searchParams.has('status') || item.status === url.searchParams.get('status')).map(publicRow), url.searchParams)
      } else if (match('imports', '([^/]+)', 'mapping') && method === 'PATCH') {
        const batch = getRecord(state.imports, decodeURIComponent(path.split('/')[2])); checkRevision(batch, headers)
        assert(batch.status === 'review', 'INVALID_IMPORT_STATE', '当前批次不能调整映射。', 409)
        const mapping = { ...batch.mapping }
        const columns = body?.columns ?? {}
        const targetFields = ['businessDate', 'direction', 'kind', 'amountMinor', 'amountYuan', 'summary', 'sourceTransactionId', 'originalTransactionId', 'originalSourceTransactionId', 'categoryId']
        for (const [sourceOrTarget, targetOrSource] of Object.entries(columns)) {
          if (targetFields.includes(sourceOrTarget)) mapping[sourceOrTarget] = targetOrSource
          else if (targetFields.includes(targetOrSource)) {
            const target = targetOrSource === 'amountMinor' && /元|amount/i.test(sourceOrTarget) && !/分|minor/i.test(sourceOrTarget) ? 'amountYuan' : targetOrSource
            mapping[target] = sourceOrTarget
            if (target === 'amountYuan') delete mapping.amountMinor
          }
        }
        batch.mapping = mapping
        batch.rows = batch.rawRows.map((raw, index) => {
          const existing = batch.rows[index]
          return existing?.status === 'posted' ? existing : makeImportRow(raw, index, mapping, batch.platform, state.transactions)
        })
        batch.counts = batchCounts(batch.rows); bump(batch); result = clone(publicBatch(batch))
      } else if (match('imports', '([^/]+)', 'rows', '([^/]+)') && method === 'PATCH') {
        const batch = getRecord(state.imports, decodeURIComponent(path.split('/')[2])); assert(batch.status === 'review', 'INVALID_IMPORT_STATE', '当前批次不能修改行。', 409)
        const row = getRecord(batch.rows, decodeURIComponent(path.split('/')[4])); checkRevision(row, headers)
        assert(row.status !== 'posted', 'INVALID_IMPORT_ROW_STATE', '已入账的导入行不能再修改。', 409)
        row.draft = { ...row.draft, ...(body?.draft ?? {}) }
        row.categoryConfirmed = body?.categoryConfirmed ?? row.categoryConfirmed
        row.kindConfirmed = body?.kindConfirmed ?? row.kindConfirmed
        if (body?.duplicateDecision === 'skip') row.status = 'duplicate'
        else {
          row.fieldErrors = {}
          row.reviewReasons = []
          let structurallyInvalid = false
          try { validateTransaction(row.draft) } catch (error) { row.fieldErrors = error.fieldErrors ?? {}; row.reviewReasons.push(error.message); structurallyInvalid = true }
          if (!structurallyInvalid) {
            try { validateBusinessKind(row.draft, state.transactions); checkTransactionCategory(row.draft) } catch (error) { row.fieldErrors = error.fieldErrors ?? {}; row.reviewReasons.push(error.message) }
          }
          if (!row.kindConfirmed) row.reviewReasons.push('请确认业务类型。')
          if (['sale', 'expense'].includes(row.draft.kind) && !row.categoryConfirmed) row.reviewReasons.push('请确认经营分类。')
          row.status = structurallyInvalid ? 'invalid' : row.reviewReasons.length ? 'needs_review' : 'ready'
        }
        bump(row); batch.counts = batchCounts(batch.rows); bump(batch); result = clone(publicRow(row))
      } else if (match('imports', '([^/]+)', 'commit') && method === 'POST') {
        const batch = getRecord(state.imports, decodeURIComponent(path.split('/')[2])); checkRevision(batch, headers)
        assert(['review', 'completed'].includes(batch.status), 'INVALID_IMPORT_STATE', '当前批次不能确认。', 409)
        assert(Array.isArray(body?.rows), 'VALIDATION_ERROR', '请明确选择要确认的账单行。', 422)
        const postedTransactionIds = []; const failedRowIds = []; const pendingRowIds = []
        for (const selection of body.rows) {
          const row = batch.rows.find((item) => item.id === selection.id)
          if (!row || row.revision !== selection.revision) { failedRowIds.push(selection.id); continue }
          if (row.status === 'posted') { postedTransactionIds.push(row.transactionId); continue }
          if (row.status !== 'ready') { pendingRowIds.push(row.id); continue }
          const sameImportRow = state.transactions.find((txn) => txn.source.importId === batch.id && txn.source.importRowId === row.id)
          if (sameImportRow) {
            row.status = 'posted'; row.transactionId = sameImportRow.id; bump(row); postedTransactionIds.push(sameImportRow.id); continue
          }
          try {
            validateTransaction(row.draft)
            validateBusinessKind(row.draft, state.transactions)
            checkTransactionCategory(row.draft)
            assert(row.kindConfirmed, 'KIND_UNCONFIRMED', '请先确认业务类型。', 422)
            if (['sale', 'expense'].includes(row.draft.kind)) assert(row.categoryConfirmed, 'CATEGORY_UNCONFIRMED', '请先确认经营分类。', 422)
          } catch { failedRowIds.push(row.id); continue }
          if (row.sourceTransactionId && state.transactions.some((txn) => txn.source.platform === batch.platform && txn.source.sourceTransactionId === row.sourceTransactionId)) {
            row.status = 'duplicate'; bump(row); pendingRowIds.push(row.id); continue
          }
          const txn = entity(nextId('txn'), { ...row.draft, amountMinor: amount(row.draft.amountMinor), businessId: BUSINESS_ID, status: 'posted', categoryStatus: row.draft.categoryId ? 'confirmed' : 'unclassified', source: { platform: batch.platform, importId: batch.id, importRowId: row.id, ...(row.sourceTransactionId ? { sourceTransactionId: row.sourceTransactionId } : {}) }, createdAt: iso(), updatedAt: iso() })
          state.transactions.push(txn); row.status = 'posted'; row.transactionId = txn.id; bump(row); postedTransactionIds.push(txn.id)
        }
        if (postedTransactionIds.length) change()
        batch.counts = batchCounts(batch.rows)
        batch.status = batch.rows.every((item) => ['posted', 'duplicate'].includes(item.status)) ? 'completed' : 'review'
        bump(batch)
        result = { id: nextId('job'), kind: 'import_commit', status: 'succeeded', stage: 'completed', progress: 100, result: { importId: batch.id, postedTransactionIds, failedRowIds, pendingRowIds } }
        state.jobs.push(result)
      } else if (match('imports', '([^/]+)', 'cancel') && method === 'POST') {
        const batch = getRecord(state.imports, decodeURIComponent(path.split('/')[2])); assert(batch.status === 'review', 'INVALID_IMPORT_STATE', '当前批次不能取消。', 409)
        batch.status = 'cancelled'; bump(batch); result = clone(publicBatch(batch))
      } else if (path === '/analytics/summary' && method === 'GET') {
        const query = queryFrom(url.searchParams); const snapshot = analytic(query)
        result = { query, metrics: snapshot.metrics }; result.metaSnapshotId = snapshot.snapshotId
      } else if (path === '/analytics/trends' && method === 'GET') {
        const query = queryFrom(url.searchParams); const periods = trendPeriods(query)
        const ids = ['sales_revenue', 'operating_expense', 'operating_surplus', 'operating_surplus_rate']
        const snapshots = periods.map((period) => ({ period, snapshot: analytic({ ...query, startDate: period.start, endDate: period.end }) }))
        result = ids.map((id) => ({ metricId: id, unit: id === 'operating_surplus_rate' ? 'ratio' : 'currency_minor', points: snapshots.map(({ period, snapshot }) => {
          const found = snapshot.metrics.find((item) => item.id === id)
          return { date: period.start, value: found.value, evidenceId: found.evidenceId }
        }) }))
      } else if (path === '/analytics/cost-structure' && method === 'GET') {
        const query = queryFrom(url.searchParams); const snapshot = analytic(query)
        const byCategory = new Map()
        for (const txn of snapshot.values.selected) {
          let contribution = 0n
          let key = txn.categoryId ?? 'uncategorized'
          if (txn.kind === 'expense' && txn.direction === 'outflow') contribution = cents(txn.amountMinor)
          else if (txn.kind === 'refund' && txn.direction === 'inflow') {
            const original = state.transactions.find((item) => item.id === txn.originalTransactionId)
            if (original?.kind === 'expense') { contribution = -cents(txn.amountMinor); key = original.categoryId ?? key }
          }
          if (contribution) byCategory.set(key, (byCategory.get(key) ?? 0n) + contribution)
        }
        const total = snapshot.values.expense
        result = { denominatorMetricId: 'operating_expense', totalMinor: total.toString(), items: [...byCategory].filter(([, value]) => value !== 0n).map(([categoryId, value]) => ({ categoryId, label: state.categories.find((item) => item.id === categoryId)?.name ?? '未分类', amountMinor: value.toString(), ratio: ratio(value, total), evidenceId: snapshot.metrics[1].evidenceId })) }
      } else if (path === '/analytics/comparisons' && method === 'GET') {
        const query = queryFrom(url.searchParams); const current = analytic(query); const previous = analytic(previousPeriod(query))
        result = current.metrics.map((item, index) => {
          const before = previous.metrics[index]; const isRatio = item.unit === 'ratio'
          const currentValue = item.value === null ? null : isRatio ? Number(item.value) : cents(item.value)
          const previousValue = before.value === null ? null : isRatio ? Number(before.value) : cents(before.value)
          const changeValue = currentValue === null || previousValue === null ? null : currentValue - previousValue
          const relativeChange = changeValue === null || previousValue <= 0 ? null : isRatio ? ratio(BigInt(Math.round(changeValue * 10000)), BigInt(Math.round(previousValue * 10000))) : ratio(changeValue, previousValue)
          const direction = changeValue === null ? 'unknown' : changeValue > 0 ? 'up' : changeValue < 0 ? 'down' : 'flat'
          return { metricId: item.id, current: item, previous: before, absoluteChange: changeValue === null ? null : isRatio ? null : changeValue.toString(), relativeChange,
            percentagePointChange: isRatio && changeValue !== null ? (changeValue * 100).toFixed(1) : null,
            direction, favorability: direction === 'unknown' || direction === 'flat' ? 'neutral' : item.id === 'operating_expense' ? direction === 'down' ? 'positive' : 'negative' : direction === 'up' ? 'positive' : 'negative' }
        })
      } else if (match('analytics', 'evidence', '([^/]+)') && method === 'GET') {
        const id = decodeURIComponent(path.split('/')[3]); const evidence = state.evidence.get(id)
        assert(evidence, 'NOT_FOUND', '证据快照不存在，请重新分析。', 404)
        result = { ...clone(evidence), transactions: page(evidence.transactions, url.searchParams) }
      } else if (path === '/assistant/conversations' && method === 'GET') {
        result = page(state.conversations, url.searchParams)
      } else if (path === '/assistant/conversations' && method === 'POST') {
        const query = { ...DEFAULT_QUERY, ...(body?.query ?? {}) }
        result = clone(entityCreate(state.conversations, 'conversation', { title: body?.title || '新对话', query })); status = 201
      } else if (match('assistant', 'conversations', '([^/]+)', 'messages') && method === 'GET') {
        const conversationId = decodeURIComponent(path.split('/')[3]); getRecord(state.conversations, conversationId)
        result = page(state.messages.filter((item) => item.conversationId === conversationId), url.searchParams)
      } else if (match('assistant', 'conversations', '([^/]+)', 'messages') && method === 'POST') {
        const conversationId = decodeURIComponent(path.split('/')[3]); getRecord(state.conversations, conversationId)
        assert(String(body?.text ?? '').trim(), 'VALIDATION_ERROR', '请输入问题。', 422)
        const query = { ...DEFAULT_QUERY, ...(body?.query ?? {}) }
        const current = analytic(query); const previous = analytic(previousPeriod(query))
        const userMessage = entity(nextId('message'), { role: 'user', conversationId, status: 'completed', text: String(body.text), querySnapshot: query, metricIds: [], evidenceIds: [], createdAt: iso(), updatedAt: iso() })
        state.messages.push(userMessage)
        const answer = entity(nextId('message'), { role: 'assistant', conversationId, status: 'completed', text: summaryText(current.values, previous.values), querySnapshot: query,
          snapshotId: current.snapshotId, dataVersion: String(state.version), metricIds: current.metrics.map((item) => item.id), evidenceIds: current.metrics.map((item) => item.evidenceId),
          facts: current.metrics.map((item, index) => ({ metricId: item.id, label: item.label, currentValue: item.value, previousValue: previous.metrics[index].value, unit: item.unit, evidenceId: item.evidenceId })),
          suggestions: [{ text: '核对销售流水和经营支出明细，再判断经营变化原因。', supportingEvidenceIds: current.metrics.map((item) => item.evidenceId) }],
          actions: [{ type: 'view_transactions', label: '看流水证据', payload: { startDate: query.startDate, endDate: query.endDate } }],
          limitations: ['演示回答由确定性账目计算生成；没有销量、客流和采购单价证据。'], createdAt: iso(), updatedAt: iso() })
        state.messages.push(answer); result = clone(answer); status = 201
      } else if (match('assistant', 'conversations', '([^/]+)', 'messages', '([^/]+)') && method === 'GET') {
        const conversationId = decodeURIComponent(path.split('/')[3]); const id = decodeURIComponent(path.split('/')[5])
        result = clone(state.messages.find((item) => item.id === id && item.conversationId === conversationId) ?? fail('NOT_FOUND', '消息不存在。', 404))
      } else if (match('assistant', 'conversations', '([^/]+)', 'messages', '([^/]+)', 'cancel') && method === 'POST') {
        const conversationId = decodeURIComponent(path.split('/')[3]); const id = decodeURIComponent(path.split('/')[5])
        const message = state.messages.find((item) => item.id === id && item.conversationId === conversationId)
        assert(message, 'NOT_FOUND', '消息不存在。', 404)
        assert(message.status !== 'completed', 'ALREADY_COMPLETED', '演示回答已完成。', 409)
        message.status = 'stopped'; bump(message); result = clone(message)
      } else if (match('jobs', '([^/]+)') && method === 'GET') {
        result = clone(getRecord(state.jobs, decodeURIComponent(path.split('/')[2])))
      } else if (/^\/(receipts|alerts|alert-rules|members|backups|exports|data-deletions|jobs|audit-logs)(\/|$)/.test(path)) {
        fail('FEATURE_NOT_AVAILABLE', '此扩展功能尚未接入，当前演示不提供模拟结果。', 501)
      } else {
        fail('NOT_FOUND', '演示接口不存在。', 404)
      }
      const meta = dataMeta(requestId)
      if (result?.metaSnapshotId) { meta.snapshotId = result.metaSnapshotId; delete result.metaSnapshotId }
      if (method !== 'GET' && key) state.idempotency.set(identity, { signature, data: clone(result), meta: clone(meta), status })
      return response(result, meta, status)
    } catch (error) {
      return errorResponse(error, requestId)
    }
  }
}

function publicBatch(batch) { const { rows, rawRows, mapping, ...visible } = batch; return { ...visible, ...(batch.counts.invalid ? { detectedColumns: Object.keys(rawRows[0] ?? {}) } : {}) } }
function publicRow(row) { const { sourceTransactionId, categoryConfirmed, transactionId, ...visible } = row; return visible }
function trendPeriods(query) {
  const result = []; let current = new Date(`${query.startDate}T00:00:00Z`); const end = new Date(`${query.endDate}T00:00:00Z`)
  while (current < end && result.length < 370) {
    const start = current.toISOString().slice(0, 10)
    const next = new Date(current)
    if (query.granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1)
    else next.setUTCDate(next.getUTCDate() + (query.granularity === 'week' ? 7 : 1))
    const upper = next > end ? end : next
    result.push({ start, end: upper.toISOString().slice(0, 10) }); current = upper
  }
  return result
}
