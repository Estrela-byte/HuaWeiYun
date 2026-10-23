import { onUnmounted, ref } from 'vue'
import { asItems, errorText } from '../domain/navigation.js'

export function useAnalytics(api) {
  const summary = ref(null)
  const trends = ref([])
  const costStructure = ref(null)
  const comparisons = ref([])
  const loading = ref(false)
  const error = ref('')
  const dataVersion = ref('')
  let controller = null
  let sequence = 0

  async function load(query) {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const current = ++sequence
    loading.value = true
    error.value = ''
    const outcomes = await Promise.allSettled([
      api.analytics.summary(query, { signal }),
      api.analytics.trends(query, { signal }),
      api.analytics.costStructure(query, { signal }),
      api.analytics.comparisons(query, { signal }),
    ])
    if (signal.aborted || current !== sequence) return
    const [s, t, c, cmp] = outcomes
    if (s.status === 'fulfilled') { summary.value = s.value.data; dataVersion.value = s.value.meta?.dataVersion || '' }
    else { summary.value = null; error.value = errorText(s.reason) }
    trends.value = t.status === 'fulfilled' ? t.value.data : []
    costStructure.value = c.status === 'fulfilled' ? c.value.data : null
    comparisons.value = cmp.status === 'fulfilled' ? cmp.value.data : []
    loading.value = false
  }

  async function openEvidence(evidenceId, query) { return api.analytics.evidence(evidenceId, query) }
  function invalidate() { summary.value = null; trends.value = []; costStructure.value = null; comparisons.value = [] }
  onUnmounted(() => controller?.abort())
  return { summary, trends, costStructure, comparisons, loading, error, dataVersion, load, openEvidence, invalidate }
}