export const pageRoutes = {
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
}

export const navItems = [
  { key: 'overview', label: '首页', icon: '⌂', description: '工作台与待办' },
  { key: 'ingestion', label: '数据采集', icon: '⇩', description: '账单导入与核对' },
  { key: 'ledger', label: '记账', icon: '▤', description: '流水、分类与商品' },
  { key: 'analytics', label: '分析', icon: '◫', description: '指标与趋势' },
  { key: 'assistant', label: 'AI 问答', icon: '✦', description: '有依据的经营解释' },
  { key: 'alerts', label: '预警', icon: '♧', description: '扩展阶段' },
  { key: 'settings', label: '设置', icon: '⚙', description: '经营主体与系统管理' },
]
export const navigation = navItems

const statusLabels = {
  queued: '排队中', running: '处理中', parsing: '解析中', review: '待核对', committing: '入账中', completed: '已完成',
  succeeded: '已完成', failed: '失败', cancelled: '已取消', posted: '已入账', voided: '已作废',
  invalid: '无效', duplicate: '疑似重复', ready: '可确认', needs_review: '待人工确认',
  querying: '查询中', calculating: '计算中', generating: '生成中', needs_clarification: '需补充问题',
  insufficient_data: '数据不足', stopped: '已停止', recognizing: '识别中', open: '待处理', resolved: '已处理', ignored: '已忽略',
  not_configured: '未配置', delivered: '已送达', inflow: '收入', outflow: '支出',
  manual: '手工', wechat: '微信支付', alipay: '支付宝', receipt: '票据',
  sale: '销售', expense: '经营支出', refund: '退款', transfer: '转账', settlement: '结算',
  loan: '借款', owner_contribution: '业主投入', other: '其他',
  owner: '老板', accountant: '会计', clerk: '店员',
  info: '提示', warning: '警告', critical: '紧急', day: '日', week: '周', month: '月',
  gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于',
  ratio: '比率', currency_minor: '金额（分）', count: '笔数',
}
export function statusLabel(value) { return statusLabels[value] || value || '—' }

export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Reuse a key only while retrying the same write intent and request content. */
export function createIdempotencyIntent(generateKey = newIdempotencyKey) {
  let signature = null
  let key = null
  return {
    keyFor(payload) {
      const next = JSON.stringify(payload)
      if (next === undefined) throw new TypeError('An idempotent write needs a serializable payload.')
      if (next !== signature) { signature = next; key = generateKey() }
      return key
    },
    clear() { signature = null; key = null },
  }
}

export function formatAmountMinor(value, currency = 'CNY') {
  if (value === null || value === undefined || value === '') return '—'
  try {
    const minor = BigInt(String(value))
    const negative = minor < 0n
    const absolute = negative ? -minor : minor
    const whole = absolute / 100n
    const fraction = String(absolute % 100n).padStart(2, '0')
    const group = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const symbol = currency === 'CNY' ? '¥' : `${currency} `
    return `${negative ? '−' : ''}${symbol}${group}.${fraction}`
  } catch {
    return '—'
  }
}

export function yuanToMinor(value) {
  const normalized = String(value ?? '').trim()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return result > 0n ? String(result) : null
}

export function formatMetric(metric) {
  if (!metric || metric.value === null || metric.value === undefined) return '—'
  const value = String(metric.value)
  if (metric.unit === 'currency_minor' || metric.unit === 'minor_currency') return formatAmountMinor(value, metric.currency)
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (metric.unit === 'ratio') return `${(number * 100).toFixed(1)}%`
  if (metric.unit === 'percentage_point') return `${number.toFixed(1)} 个百分点`
  if (metric.unit === 'count') return new Intl.NumberFormat('zh-CN').format(number)
  return value
}

export function formatRate(value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? `${number >= 0 ? '+' : ''}${(number * 100).toFixed(1)}%` : '—'
}

export function errorText(error) {
  if (!error) return ''
  if (error.name === 'AbortError' || error.code === 'REQUEST_ABORTED') return ''
  if (error.code === 'NETWORK_ERROR') return '无法连接服务端，请检查网络和接口地址后重试。'
  if (error.code === 'REQUEST_TIMEOUT') return '请求超时。若刚提交了写入，请先刷新查询结果，再决定是否重试。'
  if (error.code === 'MISSING_BUSINESS_ID') return '尚未选择经营主体，请先完成主体初始化。'
  if (error.code === 'FEATURE_NOT_AVAILABLE') return '这项服务尚未接入，请与负责该接口的队友确认。'
  if (error.code === 'INVALID_RESPONSE') return '服务端返回格式与接口约定不一致，请检查 data/meta 结构。'
  if (error.code === 'INVALID_REQUEST') return '请求参数不符合接口约定，请检查当前输入。'
  if (error.status === 403) return '当前账号没有执行此操作的权限。'
  if (error.status === 409 || error.status === 412) return '数据已被更新，请刷新后核对再试。'
  if (error.status === 401) return '会话已失效，请重新登录。'
  const firstFieldError = Object.values(error.fieldErrors || {}).flat().find(Boolean)
  if (firstFieldError) return firstFieldError
  if (typeof error.message === 'string' && /[\u3400-\u9fff]/.test(error.message)) return error.message
  return error.status >= 500 ? '服务暂时不可用，请稍后重试。' : '请求失败，请检查输入后重试。'
}

export function isPendingJob(status) {
  return ['queued', 'running', 'parsing', 'committing', 'recognizing'].includes(status)
}

export function asItems(value) {
  return Array.isArray(value?.items) ? value.items : Array.isArray(value) ? value : []
}

/** A refresh may remove stale selections, but must never select an unchosen row. */
export function retainReadySelection(selectedIds, rows) {
  const readyIds = new Set(rows.filter(row => row.status === 'ready').map(row => row.id))
  return selectedIds.filter(id => readyIds.has(id))
}
