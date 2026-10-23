import { pageRoutes } from '../domain/navigation.js'

const monthPattern = /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/

function isValidDate(value) {
  return datePattern.test(value ?? '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function monthPeriod(month) {
  if (!monthPattern.test(month)) return null
  const [year, number] = month.split('-').map(Number)
  const nextYear = number === 12 ? year + 1 : year
  const nextMonth = number === 12 ? 1 : number + 1
  return {
    startDate: `${month}-01`,
    endDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    timezone: 'Asia/Shanghai',
    granularity: 'month',
    comparison: 'previous_period',
  }
}

export function currentShanghaiMonth(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(now)
}

export function businessToday(timezone = 'Asia/Shanghai', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function resolvePage(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const receiptPrefix = `${pageRoutes.receipt}/`
  if (normalized === pageRoutes.receipt) return { page: 'receipt', receiptId: null }
  if (normalized.startsWith(receiptPrefix)) {
    const encoded = normalized.slice(receiptPrefix.length)
    if (encoded && !encoded.includes('/')) {
      try { return { page: 'receipt', receiptId: decodeURIComponent(encoded) } } catch { /* unknown path */ }
    }
  }
  const match = Object.entries(pageRoutes).find(([key, path]) => key !== 'receipt' && path === normalized)
  return match ? { page: match[0], receiptId: null } : { page: 'overview', receiptId: null }
}

export function pathForPage(page, receiptId) {
  if (!Object.hasOwn(pageRoutes, page)) throw new Error(`Unknown page: ${page}`)
  if (page === 'receipt') {
    if (!receiptId) return pageRoutes.receipt
    return `${pageRoutes.receipt}/${encodeURIComponent(receiptId)}`
  }
  return pageRoutes[page]
}

export function monthFromSearch(search, fallbackMonth) {
  const candidate = new URLSearchParams(search).get('month')
  return monthPeriod(candidate) ? candidate : fallbackMonth
}

export function queryFromSearch(search, fallbackMonth) {
  const params = new URLSearchParams(search)
  const query = monthPeriod(monthFromSearch(search, fallbackMonth))
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')
  if (isValidDate(startDate) && isValidDate(endDate) && startDate < endDate) {
    query.startDate = startDate
    query.endDate = endDate
  }
  if (['day', 'week', 'month'].includes(params.get('granularity'))) query.granularity = params.get('granularity')
  if (['previous_period', 'previous_year'].includes(params.get('comparison'))) query.comparison = params.get('comparison')
  return query
}

export function searchForQuery(query) {
  const params = new URLSearchParams()
  const month = query.startDate?.slice(0, 7)
  const fullMonth = monthPeriod(month)
  if (query.granularity === 'month' && fullMonth && fullMonth.startDate === query.startDate && fullMonth.endDate === query.endDate) {
    params.set('month', month)
  } else {
    params.set('startDate', query.startDate)
    params.set('endDate', query.endDate)
    params.set('granularity', query.granularity)
  }
  if (query.comparison && query.comparison !== 'previous_period') params.set('comparison', query.comparison)
  return params.toString()
}
