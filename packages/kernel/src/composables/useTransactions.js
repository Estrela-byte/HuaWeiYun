import { ref } from 'vue'
import { asItems, errorText, newIdempotencyKey } from '../domain/navigation.js'

export function useTransactions(api) {
  const items = ref([])
  const nextCursor = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const notice = ref('')
  let cursor = null
  let cursorStack = []
  let createIntent = { signature: '', key: '' }

  async function load(query) {
    loading.value = true
    error.value = ''
    try {
      const result = await api.transactions.list({ ...query, cursor: cursor || undefined, limit: query?.limit || 20 })
      items.value = asItems(result.data)
      nextCursor.value = result.data?.nextCursor || null
    } catch (cause) { error.value = errorText(cause); items.value = [] }
    finally { loading.value = false }
  }

  function resetCursor() { cursor = null; cursorStack = [] }
  function nextPage() { if (!nextCursor.value) return; cursorStack.push(cursor); cursor = nextCursor.value }
  function prevPage() { if (!cursorStack.length) return; cursor = cursorStack.pop() }

  async function save(payload, existing) {
    if (saving.value) return null
    saving.value = true
    error.value = ''
    try {
      const signature = JSON.stringify(payload)
      let result
      if (existing) {
        result = await api.transactions.update(existing.id, payload, { revision: existing.revision })
      } else {
        if (createIntent.signature !== signature) createIntent = { signature, key: newIdempotencyKey() }
        result = await api.transactions.create(payload, { idempotencyKey: createIntent.key })
      }
      createIntent = { signature: '', key: '' }
      notice.value = '流水已保存。'
      return result
    } catch (cause) { error.value = errorText(cause); return null }
    finally { saving.value = false }
  }

  async function voidTransaction(id, reason, revision) {
    if (saving.value) return null
    saving.value = true
    error.value = ''
    try {
      const result = await api.transactions.void(id, { reason }, { revision, idempotencyKey: newIdempotencyKey() })
      notice.value = '流水已作废，历史来源仍保留。'
      return result
    } catch (cause) { error.value = errorText(cause); return null }
    finally { saving.value = false }
  }

  async function bulkCategory(selectedItems, categoryId) {
    if (saving.value) return null
    saving.value = true
    error.value = ''
    try {
      const result = await api.transactions.bulkCategory(
        { items: selectedItems.map(item => ({ id: item.id, revision: item.revision })), categoryId },
        { idempotencyKey: newIdempotencyKey() }
      )
      return result
    } catch (cause) { error.value = errorText(cause); return null }
    finally { saving.value = false }
  }

  function resetMessages() { error.value = ''; notice.value = '' }
  return { items, nextCursor, loading, saving, error, notice, load, resetCursor, nextPage, prevPage, save, voidTransaction, bulkCategory, resetMessages }
}