import test from 'node:test'
import assert from 'node:assert/strict'
import { businessToday, currentShanghaiMonth, monthFromSearch, monthPeriod, pathForPage, queryFromSearch, resolvePage, searchForQuery } from './navigation.js'

test('manual ledger date follows the business timezone at the UTC day boundary', () => {
  const instant = new Date('2026-10-22T16:30:00.000Z')
  assert.equal(businessToday('Asia/Shanghai', instant), '2026-10-23')
  assert.equal(businessToday('UTC', instant), '2026-10-22')
})

test('route matching supports public, module, receipt and unknown paths', () => {
  assert.deepEqual(resolvePage('/'), { page: 'landing', receiptId: null })
  assert.deepEqual(resolvePage('/app/analytics/'), { page: 'analytics', receiptId: null })
  assert.deepEqual(resolvePage('/app/ingestion/receipts/a%2Fb'), { page: 'receipt', receiptId: 'a/b' })
  assert.deepEqual(resolvePage('/app/ingestion/receipts'), { page: 'receipt', receiptId: null })
  assert.deepEqual(resolvePage('/missing'), { page: 'overview', receiptId: null })
  assert.equal(pathForPage('receipt', 'a/b'), '/app/ingestion/receipts/a%2Fb')
  assert.equal(pathForPage('receipt'), '/app/ingestion/receipts')
})

test('month query builds an exclusive end date across year boundary', () => {
  assert.deepEqual(monthPeriod('2026-12'), {
    startDate: '2026-12-01',
    endDate: '2027-01-01',
    timezone: 'Asia/Shanghai',
    granularity: 'month',
    comparison: 'previous_period',
  })
  assert.equal(monthPeriod('2026-13'), null)
  assert.equal(monthFromSearch('?month=2026-06', '2026-10'), '2026-06')
  assert.equal(monthFromSearch('?month=invalid', '2026-10'), '2026-10')
  assert.equal(currentShanghaiMonth(new Date('2026-10-31T17:00:00Z')), '2026-11')
})

test('custom analysis range and granularity survive a URL round trip', () => {
  const query = {
    startDate: '2026-06-10', endDate: '2026-06-18',
    timezone: 'Asia/Shanghai', granularity: 'day', comparison: 'previous_year',
  }
  assert.deepEqual(queryFromSearch(`?${searchForQuery(query)}`, '2026-10'), query)
  assert.equal(searchForQuery(monthPeriod('2026-06')), 'month=2026-06')
  assert.deepEqual(queryFromSearch('?startDate=2026-02-30&endDate=2026-03-31', '2026-06'), monthPeriod('2026-06'))
})
