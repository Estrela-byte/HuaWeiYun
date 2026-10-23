import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient, createSmeApi } from '../services/api/index.js'
import { createDemoFetch } from '../services/demo/index.js'
import { useCursorPage } from './useCursorPage.js'

test('opaque cursor navigation reaches records beyond the first page and returns to earlier pages', async () => {
  const records = Array.from({ length: 21 }, (_, index) => ({ id: `record-${index + 1}` }))
  const pager = useCursorPage(async ({ cursor, limit }) => {
    const start = cursor == null ? 0 : Number(cursor.slice('opaque-'.length))
    return { data: { items: records.slice(start, start + limit), nextCursor: start + limit < records.length ? `opaque-${start + limit}` : null } }
  }, 8)
  await pager.first()
  assert.equal(pager.items.value[0].id, 'record-1')
  await pager.next()
  assert.equal(pager.items.value[0].id, 'record-9')
  await pager.previous()
  assert.equal(pager.items.value[0].id, 'record-1')
  assert.equal(await pager.find(item => item.id === 'record-21'), true)
  assert.equal(pager.items.value[0].id, 'record-17')
  assert.equal(pager.nextCursor.value, null)
})

test('a reset ignores a late response from a previous conversation', async () => {
  let resolveOld
  let calls = 0
  const pager = useCursorPage(() => ++calls === 1
    ? new Promise(resolve => { resolveOld = resolve })
    : Promise.resolve({ data: { items: [{ id: 'new' }], nextCursor: null } }), 20)
  const old = pager.first()
  pager.reset()
  await pager.first()
  resolveOld({ data: { items: [{ id: 'old' }], nextCursor: null } })
  await old
  assert.equal(pager.items.value[0].id, 'new')
})

test('refresh locates an authoritative message after an optimistic local insert', async () => {
  const server = Array.from({ length: 51 }, (_, index) => ({ id: `message-${index + 1}` }))
  const pager = useCursorPage(async ({ cursor, limit }) => {
    const start = cursor == null ? 0 : Number(cursor)
    return { data: { items: server.slice(start, start + limit), nextCursor: start + limit < server.length ? String(start + limit) : null } }
  }, 50)
  await pager.first()
  pager.items.value.push({ id: 'message-51', text: 'optimistic' })
  assert.equal(await pager.find(item => item.id === 'message-51', { refresh: true }), true)
  assert.equal(pager.previousCursors.value.length, 1)
  assert.deepEqual(pager.items.value, [{ id: 'message-51' }])
})

test('demo import, conversation, and message histories remain reachable beyond their first pages', async () => {
  const api = createSmeApi(createApiClient({ fetchImpl: createDemoFetch(), getBusinessId: () => 'demo-business' }))
  let lastImport
  for (let index = 0; index < 9; index++) {
    const form = new FormData()
    form.set('file', new Blob(['日期,收支,金额(元),商品\n2026-06-20,收入,1.00,销售\n'], { type: 'text/csv' }), `history-${index}.csv`)
    form.set('platform', 'wechat')
    lastImport = (await api.imports.create(form, { idempotencyKey: `history-upload-${index}` })).data
  }
  const imports = useCursorPage(query => api.imports.list(query), 8)
  assert.equal(await imports.find(item => item.id === lastImport.id), true)
  assert.equal(imports.previousCursors.value.length, 1)

  const query = { startDate: '2026-06-01', endDate: '2026-07-01', timezone: 'Asia/Shanghai', granularity: 'month' }
  let lastConversation
  for (let index = 0; index < 21; index++) {
    lastConversation = (await api.assistant.createConversation({ query }, { idempotencyKey: `history-conversation-${index}` })).data
  }
  const conversations = useCursorPage(page => api.assistant.conversations(page), 20)
  assert.equal(await conversations.find(item => item.id === lastConversation.id), true)
  assert.equal(conversations.previousCursors.value.length, 1)

  let lastAnswer
  for (let index = 0; index < 26; index++) {
    lastAnswer = (await api.assistant.sendMessage(lastConversation.id, { text: `Question ${index}`, query }, { idempotencyKey: `history-message-${index}` })).data
  }
  const messages = useCursorPage(page => api.assistant.messages(lastConversation.id, page), 50)
  assert.equal(await messages.find(item => item.id === lastAnswer.id), true)
  assert.equal(messages.items.value.some(item => item.id === lastAnswer.id), true)
  assert.equal(messages.previousCursors.value.length, 1)
})
