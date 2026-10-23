import { errorText } from '../domain/navigation.js'

export function useApiErrorHandler() {
  function handle(error, { onFieldErrors, onForbidden, onConflict, onRateLimit, onUnauthorized, onGeneric } = {}) {
    if (!error) return
    if (error.name === 'AbortError' || error.code === 'REQUEST_ABORTED') return
    if (error.status === 401 || error.code === 'HTTP_401') { onUnauthorized?.(error); return }
    if (error.status === 403) { onForbidden?.(error); return }
    if (error.status === 409 || error.status === 412) { onConflict?.(error); return }
    if (error.status === 429) { onRateLimit?.(error); return }
    const fieldErrors = error.fieldErrors || {}
    if (Object.values(fieldErrors).flat().some(Boolean)) { onFieldErrors?.(fieldErrors); return }
    onGeneric?.(errorText(error) || '请求失败，请重试。')
  }
  return { handle }
}