import { ref } from 'vue'
import { asItems } from '../domain/navigation.js'

/** Navigate an API Page using opaque cursors. A stale response cannot replace a newer page. */
export function useCursorPage(fetchPage, limit) {
  const items = ref([])
  const cursor = ref(null)
  const nextCursor = ref(null)
  const previousCursors = ref([])
  const loading = ref(false)
  let request = 0

  async function loadAt(target = cursor.value, previous = previousCursors.value) {
    const current = ++request
    loading.value = true
    try {
      const response = await fetchPage({ limit, ...(target == null ? {} : { cursor: target }) })
      if (current !== request) return false
      items.value = asItems(response.data)
      cursor.value = target
      nextCursor.value = response.data?.nextCursor ?? null
      previousCursors.value = [...previous]
      return true
    } finally {
      if (current === request) loading.value = false
    }
  }

  function reset() {
    request++
    items.value = []
    cursor.value = null
    nextCursor.value = null
    previousCursors.value = []
    loading.value = false
  }

  const first = () => loadAt(null, [])
  const reload = () => loadAt()
  const next = () => nextCursor.value == null ? Promise.resolve(false) : loadAt(nextCursor.value, [...previousCursors.value, cursor.value])
  const previous = () => previousCursors.value.length === 0 ? Promise.resolve(false) : loadAt(previousCursors.value.at(-1), previousCursors.value.slice(0, -1))

  async function find(predicate, { refresh = false } = {}) {
    if (!refresh && items.value.some(predicate)) return true
    await first()
    const seen = new Set()
    while (!items.value.some(predicate) && nextCursor.value != null) {
      if (seen.has(nextCursor.value)) throw new Error('The API repeated a pagination cursor.')
      seen.add(nextCursor.value)
      await next()
    }
    return items.value.some(predicate)
  }

  return { items, cursor, nextCursor, previousCursors, loading, first, reload, next, previous, find, reset }
}
