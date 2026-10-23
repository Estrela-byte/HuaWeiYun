import test from 'node:test'
import assert from 'node:assert/strict'
import {
  monthPeriod, currentShanghaiMonth, resolvePage, pathForPage,
  monthFromSearch, queryFromSearch, searchForQuery,
} from './navigation.js'

test('monthPeriod builds a month-scoped period with Shanghai timezone and previous-period comparison', () => {
  assert.deepEqual(monthPeriod('2026-06'), {
    startDate: '2026-06-01',
    endDate: '2026-07-01',
    timezone: 'Asia/Shanghai',
    granularity: 'month',
    comparison: 'previous_period',
  })
})

test('monthPeriod rolls December into January of the next year', () => {
  assert.equal(monthPeriod('2026-12').endDate, '2027-01-01')
  assert.equal(monthPeriod('2000-12').endDate, '2001-01-01')
})

test('monthPeriod accepts years from 2000 to 2199 and rejects everything else', () => {
  assert.ok(monthPeriod('2000-01'))
  assert.ok(monthPeriod('2199-12'))
  assert.equal(monthPeriod('1999-12'), null)
  assert.equal(monthPeriod('2200-01'), null)
  assert.equal(monthPeriod('2026-13'), null)
  assert.equal(monthPeriod('2026-00'), null)
  assert.equal(monthPeriod('2026-6'), null)
  assert.equal(monthPeriod('2026-06-01'), null)
  assert.equal(monthPeriod(''), null)
  assert.equal(monthPeriod(null), null)
  assert.equal(monthPeriod(undefined), null)
})

test('currentShanghaiMonth formats a Date as YYYY-MM in the Asia/Shanghai zone', () => {
  assert.equal(currentShanghaiMonth(new Date('2026-06-15T10:00:00+08:00')), '2026-06')
  assert.equal(currentShanghaiMonth(new Date('2026-06-15T00:30:00Z')), '2026-06')
  assert.equal(currentShanghaiMonth(new Date('2026-07-01T00:30:00Z')), '2026-07')
  assert.equal(currentShanghaiMonth(new Date('2026-07-01T15:30:00Z')), '2026-07')
})

test('currentShanghaiMonth rolls the calendar day forward at the UTC+8 boundary', () => {
  // 2026-06-30T16:00:00Z is 2026-07-01T00:00:00 in Shanghai.
  assert.equal(currentShanghaiMonth(new Date('2026-06-30T16:00:00Z')), '2026-07')
})

test('currentShanghaiMonth without an argument returns the current month in YYYY-MM shape', () => {
  assert.match(currentShanghaiMonth(), /^\d{4}-\d{2}$/)
})

test('resolvePage maps known paths to their page keys and strips trailing slashes', () => {
  assert.deepEqual(resolvePage('/'), { page: 'landing', receiptId: null })
  assert.deepEqual(resolvePage('/app/overview'), { page: 'overview', receiptId: null })
  assert.deepEqual(resolvePage('/app/ingestion'), { page: 'ingestion', receiptId: null })
  assert.deepEqual(resolvePage('/app/settings'), { page: 'settings', receiptId: null })
  assert.deepEqual(resolvePage('/app/overview/'), { page: 'overview', receiptId: null })
  assert.deepEqual(resolvePage(''), { page: 'landing', receiptId: null })
})

test('resolvePage parses receipt detail routes and decodes the receipt id', () => {
  assert.deepEqual(resolvePage('/app/ingestion/receipts'), { page: 'receipt', receiptId: null })
  assert.deepEqual(resolvePage('/app/ingestion/receipts/'), { page: 'receipt', receiptId: null })
  assert.deepEqual(resolvePage('/app/ingestion/receipts/abc123'), { page: 'receipt', receiptId: 'abc123' })
  assert.deepEqual(resolvePage('/app/ingestion/receipts/abc%20123'), { page: 'receipt', receiptId: 'abc 123' })
})

test('resolvePage falls back to overview for unknown paths and nested receipt segments', () => {
  assert.deepEqual(resolvePage('/unknown'), { page: 'overview', receiptId: null })
  assert.deepEqual(resolvePage('/app/ingestion/receipts/a/b'), { page: 'overview', receiptId: null })
})

test('pathForPage encodes pages back to paths and URL-encodes receipt ids', () => {
  assert.equal(pathForPage('landing'), '/')
  assert.equal(pathForPage('overview'), '/app/overview')
  assert.equal(pathForPage('receipt'), '/app/ingestion/receipts')
  assert.equal(pathForPage('receipt', 'abc123'), '/app/ingestion/receipts/abc123')
  assert.equal(pathForPage('receipt', 'abc 123'), '/app/ingestion/receipts/abc%20123')
  assert.equal(pathForPage('receipt', null), '/app/ingestion/receipts')
  assert.equal(pathForPage('receipt', undefined), '/app/ingestion/receipts')
  assert.equal(pathForPage('receipt', ''), '/app/ingestion/receipts')
})

test('pathForPage throws for unknown pages', () => {
  assert.throws(() => pathForPage('unknown'), /Unknown page: unknown/)
})

test('monthFromSearch returns the URL month when valid and falls back otherwise', () => {
  assert.equal(monthFromSearch('month=2026-06', '2026-05'), '2026-06')
  assert.equal(monthFromSearch('', '2026-05'), '2026-05')
  assert.equal(monthFromSearch('month=invalid', '2026-05'), '2026-05')
  assert.equal(monthFromSearch('month=2026-13', '2026-05'), '2026-05')
  assert.equal(monthFromSearch('foo=bar', '2026-05'), '2026-05')
})

test('queryFromSearch builds a month period and overlays valid custom ranges and enums', () => {
  assert.deepEqual(queryFromSearch('month=2026-06', '2026-05'), monthPeriod('2026-06'))
  assert.deepEqual(queryFromSearch('', '2026-05'), monthPeriod('2026-05'))
  assert.deepEqual(
    queryFromSearch('startDate=2026-06-01&endDate=2026-06-15', '2026-06'),
    { ...monthPeriod('2026-06'), startDate: '2026-06-01', endDate: '2026-06-15' },
  )
  assert.deepEqual(
    queryFromSearch('granularity=day&comparison=previous_year', '2026-06'),
    { ...monthPeriod('2026-06'), granularity: 'day', comparison: 'previous_year' },
  )
})

test('queryFromSearch ignores invalid dates, reversed ranges and unknown enums', () => {
  const base = monthPeriod('2026-06')
  assert.deepEqual(queryFromSearch('startDate=2026-06-15&endDate=2026-06-01', '2026-06'), base)
  assert.deepEqual(queryFromSearch('startDate=invalid&endDate=2026-06-15', '2026-06'), base)
  assert.deepEqual(queryFromSearch('startDate=2026-02-30&endDate=2026-03-01', '2026-06'), base)
  assert.deepEqual(queryFromSearch('granularity=hour', '2026-06'), base)
  assert.deepEqual(queryFromSearch('comparison=invalid', '2026-06'), base)
})

test('searchForQuery serialises a clean month period as just the month param', () => {
  assert.equal(
    searchForQuery({ startDate: '2026-06-01', endDate: '2026-07-01', granularity: 'month', comparison: 'previous_period' }),
    'month=2026-06',
  )
})

test('searchForQuery serialises custom ranges with explicit dates and non-default comparison', () => {
  assert.equal(
    searchForQuery({ startDate: '2026-06-01', endDate: '2026-06-15', granularity: 'day', comparison: 'previous_period' }),
    'startDate=2026-06-01&endDate=2026-06-15&granularity=day',
  )
  assert.equal(
    searchForQuery({ startDate: '2026-06-01', endDate: '2026-07-01', granularity: 'month', comparison: 'previous_year' }),
    'month=2026-06&comparison=previous_year',
  )
  assert.equal(
    searchForQuery({ startDate: '2026-06-01', endDate: '2026-07-01', granularity: 'week', comparison: 'previous_period' }),
    'startDate=2026-06-01&endDate=2026-07-01&granularity=week',
  )
})