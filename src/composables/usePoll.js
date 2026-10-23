import { onUnmounted, ref } from 'vue'

export function usePoll(fetcher, { intervalMs = 2000, isTerminal = () => false } = {}) {
  const result = ref(null)
  const loading = ref(false)
  const error = ref('')
  let timer = null
  let stopped = false

  async function start(...args) {
    stopped = false
    loading.value = true
    error.value = ''
    try {
      result.value = await fetcher(...args)
      loading.value = false
      if (stopped || isTerminal(result.value)) return
      timer = setTimeout(() => tick(...args), intervalMs)
    } catch (cause) {
      loading.value = false
      error.value = cause?.message || '轮询失败'
    }
  }

  async function tick(...args) {
    if (stopped) return
    try {
      result.value = await fetcher(...args)
      if (stopped || isTerminal(result.value)) return
      timer = setTimeout(() => tick(...args), intervalMs)
    } catch (cause) {
      error.value = cause?.message || '轮询失败'
    }
  }

  function stop() { stopped = true; if (timer) clearTimeout(timer); timer = null }
  onUnmounted(stop)
  return { result, loading, error, start, stop }
}