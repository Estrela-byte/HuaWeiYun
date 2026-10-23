import assert from 'node:assert/strict'
import test from 'node:test'
import { errorText, formatAmountMinor, formatMetric, formatRate, retainReadySelection, yuanToMinor } from './navigation.js'

test('yuan input is converted to exact integer minor units', () => {
  assert.equal(yuanToMinor('128.50'), '12850')
  assert.equal(yuanToMinor('0.01'), '1')
  assert.equal(yuanToMinor('0.1'), '10')
  for (const value of ['0', '-1', '1.001', '1e3', '1,000']) {
    assert.equal(yuanToMinor(value), null, value)
  }
})

test('financial display keeps sign, exact cents and unavailable values distinct', () => {
  assert.equal(formatAmountMinor('12840000'), '¥128,400.00')
  assert.equal(formatAmountMinor('-8215000'), '−¥82,150.00')
  assert.equal(formatMetric({ value: '0.3602', unit: 'ratio' }), '36.0%')
  assert.equal(formatRate('-0.0503'), '-5.0%')
  assert.equal(formatMetric({ value: null, unit: 'ratio' }), '—')
})

test('connection and capability errors are explained in Chinese', () => {
  for (const code of ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'MISSING_BUSINESS_ID', 'FEATURE_NOT_AVAILABLE']) {
    const message = errorText({ code, message: 'English transport error' })
    assert.notEqual(message, 'English transport error')
    assert.match(message, /[\u3400-\u9fff]/)
  }
})

test('refresh preserves only explicitly selected ready import rows', () => {
  const rows = [
    { id: 'row_1', status: 'ready' },
    { id: 'row_2', status: 'ready' },
    { id: 'row_3', status: 'posted' },
  ]
  assert.deepEqual(retainReadySelection(['row_1', 'row_3'], rows), ['row_1'])
  assert.deepEqual(retainReadySelection([], rows), [])
})
