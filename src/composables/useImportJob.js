import { onUnmounted, ref } from 'vue'
import { asItems, errorText, isPendingJob } from '../domain/navigation.js'

export function useImportJob(api) {
  const batch = ref(null)
  const rows = ref([])
  const job = ref(null)
  const loading = ref(false)
  const error = ref('')
  let pollTimer = null

  async function create(formData, options) {
    loading.value = true; error.value = ''
    try { const result = await api.imports.create(formData, options); batch.value = result.data; return result }
    catch (cause) { error.value = errorText(cause); return null }
    finally { loading.value = false }
  }

  async function loadBatch(importId) {
    try { const result = await api.imports.get(importId); batch.value = result.data; return result }
    catch (cause) { error.value = errorText(cause); return null }
  }

  async function loadRows(importId, query) {
    try { const result = await api.imports.rows(importId, query); rows.value = asItems(result.data); return result }
    catch (cause) { error.value = errorText(cause); rows.value = []; return null }
  }

  async function pollJob(jobId) {
    if (!jobId) return
    try {
      const result = await api.jobs.get(jobId)
      job.value = result.data
      if (isPendingJob(result.data?.status)) pollTimer = setTimeout(() => pollJob(jobId), 2000)
    } catch { /* stop polling on error */ }
  }

  async function commit(importId, payload, options) {
    loading.value = true; error.value = ''
    try {
      const result = await api.imports.commit(importId, payload, options)
      if (result.data?.jobId) pollJob(result.data.jobId)
      return result
    } catch (cause) { error.value = errorText(cause); return null }
    finally { loading.value = false }
  }

  function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null }
  onUnmounted(stopPolling)
  return { batch, rows, job, loading, error, create, loadBatch, loadRows, commit, pollJob, stopPolling }
}