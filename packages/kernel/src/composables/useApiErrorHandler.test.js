import test from 'node:test'
import assert from 'node:assert/strict'
import { useApiErrorHandler } from './useApiErrorHandler.js'

test('useApiErrorHandler routes 401 to onUnauthorized', () => {
  const { handle } = useApiErrorHandler()
  let result = ''
  handle({ status: 401, code: 'HTTP_401' }, { onUnauthorized: () => { result = 'unauth' } })
  assert.equal(result, 'unauth')
})

test('useApiErrorHandler routes 403 to onForbidden', () => {
  const { handle } = useApiErrorHandler()
  let result = ''
  handle({ status: 403 }, { onForbidden: () => { result = 'forbidden' } })
  assert.equal(result, 'forbidden')
})

test('useApiErrorHandler routes 409 and 412 to onConflict', () => {
  const { handle } = useApiErrorHandler()
  let result = ''
  handle({ status: 409 }, { onConflict: () => { result = 'conflict' } })
  assert.equal(result, 'conflict')
  result = ''
  handle({ status: 412 }, { onConflict: () => { result = 'conflict' } })
  assert.equal(result, 'conflict')
})

test('useApiErrorHandler routes 429 to onRateLimit', () => {
  const { handle } = useApiErrorHandler()
  let result = ''
  handle({ status: 429 }, { onRateLimit: () => { result = 'rate' } })
  assert.equal(result, 'rate')
})

test('useApiErrorHandler routes field errors to onFieldErrors', () => {
  const { handle } = useApiErrorHandler()
  let result = null
  handle({ fieldErrors: { amountMinor: ['金额必须大于 0'] } }, { onFieldErrors: (errors) => { result = errors } })
  assert.deepEqual(result, { amountMinor: ['金额必须大于 0'] })
})

test('useApiErrorHandler stays silent for aborted requests', () => {
  const { handle } = useApiErrorHandler()
  let called = false
  handle({ name: 'AbortError', code: 'REQUEST_ABORTED' }, { onGeneric: () => { called = true } })
  assert.equal(called, false)
})

test('useApiErrorHandler falls back to onGeneric for other errors', () => {
  const { handle } = useApiErrorHandler()
  let result = ''
  handle({ status: 500, code: 'HTTP_500', message: 'Server error' }, { onGeneric: (msg) => { result = msg } })
  assert.ok(result.length > 0)
})

test('useApiErrorHandler ignores empty error', () => {
  const { handle } = useApiErrorHandler()
  let called = false
  handle(null, { onGeneric: () => { called = true } })
  assert.equal(called, false)
})