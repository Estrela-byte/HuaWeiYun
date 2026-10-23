import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createApiClient, createSmeApi } from './index.js'

const json = (data = {}, meta = { requestId: 'request-1', dataVersion: 'v3' }, status = 200) =>
  new Response(JSON.stringify({ data, meta }), { status, headers: { 'Content-Type': 'application/json' } })
const clientWith = (fetchImpl, options = {}) => createApiClient({ getBusinessId: () => 'business-1', fetchImpl, ...options })

test('encodes scalar/array queries, reads current auth and business per request, preserves envelope', async () => {
  const calls = []
  let token = 'test-token-a'
  let businessId = 'business-a'
  const client = clientWith(async (url, init) => { calls.push({ url, init }); return json({ items: [] }) }, {
    baseUrl: '/api/v1/', getAccessToken: () => token, getBusinessId: () => businessId,
  })
  const response = await client.request('/transactions', { query: { search: '奶茶 & 咖啡', page: 0, archived: false, missing: undefined, empty: null, tag: ['a b', 'c/d'] } })
  assert.equal(calls[0].url, '/api/v1/transactions?search=%E5%A5%B6%E8%8C%B6+%26+%E5%92%96%E5%95%A1&page=0&archived=false&tag=a+b&tag=c%2Fd')
  assert.equal(calls[0].init.headers.get('Authorization'), 'Bearer test-token-a')
  assert.equal(calls[0].init.headers.get('X-Business-Id'), 'business-a')
  assert.equal(calls[0].init.redirect, 'error')
  assert.deepEqual(response, { data: { items: [] }, meta: { requestId: 'request-1', dataVersion: 'v3' } })
  token = 'test-token-b'; businessId = 'business-b'
  await client.request('/transactions')
  assert.equal(calls[1].init.headers.get('Authorization'), 'Bearer test-token-b')
  assert.equal(calls[1].init.headers.get('X-Business-Id'), 'business-b')
})

test('serializes exact minor amount strings and sends reusable idempotency and revision headers', async () => {
  const calls = []
  const client = clientWith(async (url, init) => { calls.push({ url, init }); return json({ id: 'transaction-1' }) })
  const options = { method: 'PATCH', body: { amountMinor: '9007199254740993123', direction: 'outflow' }, idempotencyKey: 'intent-1', revision: 'version-7' }
  await client.request('/transactions/1', options)
  await client.request('/transactions/1', options)
  for (const { init } of calls) {
    assert.deepEqual(JSON.parse(init.body), options.body)
    assert.equal(init.headers.get('Idempotency-Key'), 'intent-1')
    assert.equal(init.headers.get('If-Match'), '"version-7"')
    assert.equal(init.headers.get('Content-Type'), 'application/json')
  }
})

test('multipart upload keeps FormData and lets fetch set its boundary', async () => {
  const formData = new FormData()
  formData.append('platform', 'wechat')
  formData.append('file', new Blob(['date,amount\n2026-06-01,12.30'], { type: 'text/csv' }), 'bill.csv')
  const api = createSmeApi(clientWith(async (url, init) => {
    assert.equal(url, '/api/v1/imports')
    assert.equal(init.body, formData)
    assert.equal(init.headers.has('Content-Type'), false)
    return json({ id: 'import-1', status: 'queued' })
  }, { headers: { 'Content-Type': 'application/json' } }))
  await api.imports.create(formData, { idempotencyKey: 'upload-1' })
})

test('surfaces field errors, request id and server status without retrying a mutation', async () => {
  let calls = 0
  const api = createSmeApi(clientWith(async () => {
    calls += 1
    return new Response(JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: '金额格式错误', fieldErrors: { amountMinor: ['请输入正整数分'] } }, meta: { requestId: 'failed-1' } }), { status: 422 })
  }))
  await assert.rejects(api.transactions.create({ amountMinor: '-1' }, { idempotencyKey: 'save-1' }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, 'VALIDATION_FAILED')
    assert.equal(error.status, 422)
    assert.equal(error.requestId, 'failed-1')
    assert.deepEqual(error.fieldErrors, { amountMinor: ['请输入正整数分'] })
    return true
  })
  assert.equal(calls, 1)
})

test('normalizes 204 and exposes response version header', async () => {
  const client = clientWith(async () => new Response(null, { status: 204, headers: { 'X-Request-Id': 'empty-1', 'X-Data-Version': 'v4' } }))
  assert.deepEqual(await client.request('/resource', { method: 'DELETE' }), { data: null, meta: { requestId: 'empty-1', dataVersion: 'v4' } })
})

test('rejects malformed successful responses instead of accepting HTML or silently using mock data', async () => {
  for (const body of ['<html>proxy</html>', JSON.stringify({ items: [] })]) {
    const client = clientWith(async () => new Response(body, { status: 200 }))
    await assert.rejects(client.request('/transactions'), { code: 'INVALID_RESPONSE' })
  }
})

test('maps non-JSON server failures, 401, 403, 409 and retry guidance to ApiError', async () => {
  for (const status of [401, 403, 409, 503]) {
    const client = clientWith(async () => new Response('<html>failure</html>', { status, headers: { 'X-Request-Id': 'proxy-1', 'Retry-After': '3' } }))
    await assert.rejects(client.request('/transactions'), (error) => {
      assert.equal(error.code, `HTTP_${status}`)
      assert.equal(error.status, status)
      assert.equal(error.requestId, 'proxy-1')
      assert.equal(error.retryAfter, '3')
      assert.ok(!error.message.includes('<html>'))
      return true
    })
  }
})

test('network failure is explicit and does not retry or return sample data', async () => {
  let calls = 0
  const client = clientWith(async () => { calls += 1; throw new TypeError('offline') })
  await assert.rejects(client.request('/transactions'), { code: 'NETWORK_ERROR', status: 0 })
  assert.equal(calls, 1)
})

test('timeout aborts the fetch signal even if a transport ignores abort', async () => {
  let fetchSignal
  const client = clientWith((_url, init) => { fetchSignal = init.signal; return new Promise(() => {}) }, { timeoutMs: 10 })
  await assert.rejects(client.request('/transactions'), { code: 'REQUEST_TIMEOUT' })
  assert.equal(fetchSignal.aborted, true)
})

test('caller cancellation stays distinguishable from timeout', async () => {
  const controller = new AbortController()
  let fetchSignal
  const client = clientWith((_url, init) => {
    fetchSignal = init.signal
    controller.abort()
    return new Promise(() => {})
  })
  await assert.rejects(client.request('/transactions', { signal: controller.signal }), { code: 'REQUEST_ABORTED' })
  assert.equal(fetchSignal.aborted, true)
})

test('pre-aborted requests and invalid paths never reach the network', async () => {
  let calls = 0
  const client = clientWith(async () => { calls += 1; return json() })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(client.request('/transactions', { signal: controller.signal }), { code: 'REQUEST_ABORTED' })
  for (const path of ['https://other.example/steal', '//other.example/steal', '/../secret', '/%2E%2E/secret', '/transactions?redirect=elsewhere']) {
    await assert.rejects(client.request(path), { code: 'INVALID_REQUEST' })
  }
  assert.equal(calls, 0)
})

test('tenant calls require business context while login suppresses stale credential and tenant headers', async () => {
  let called = false
  const api = createSmeApi(createApiClient({
    headers: { Authorization: 'stale', 'X-Business-Id': 'stale' },
    getAccessToken: () => 'current-test-token',
    fetchImpl: async (_url, init) => {
      called = true
      assert.equal(init.headers.has('Authorization'), false)
      assert.equal(init.headers.has('X-Business-Id'), false)
      return json({ user: { id: 'user-1' } })
    },
  }))
  await assert.rejects(api.business.getProfile(), { code: 'MISSING_BUSINESS_ID' })
  assert.equal(called, false)
  await api.auth.login({ provider: 'team-provider', code: 'test-authorization-code' })
  assert.equal(called, true)
})

test('facade performs no eager requests and safely encodes identifiers without duplicating baseUrl', async () => {
  const calls = []
  const api = createSmeApi(clientWith(async (url, init) => { calls.push({ url, init }); return json() }))
  assert.equal(calls.length, 0)
  await api.assistant.getMessage('会话/1', 'msg?1')
  assert.equal(calls[0].url, '/api/v1/assistant/conversations/%E4%BC%9A%E8%AF%9D%2F1/messages/msg%3F1')
  await api.imports.mapFields('i-1', { columns: { amountMinor: '金额' } }, { revision: 'r1' })
  assert.equal(calls[1].url, '/api/v1/imports/i-1/mapping')
  assert.equal(calls[1].init.method, 'PATCH')
  await api.exports.getDownload('export-1')
  assert.equal(calls[2].url, '/api/v1/exports/export-1/download')
})
