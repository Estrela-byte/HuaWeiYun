/**
 * HTTP transport for the proposed SME-I API. No storage, retries or mock fallback.
 * @typedef {import('./contracts').RequestOptions} RequestOptions
 * @typedef {import('./contracts').ClientOptions} ClientOptions
 */

export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN_ERROR', status = 0, fieldErrors = {}, requestId = null, retryAfter = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
    this.requestId = requestId
    this.retryAfter = retryAfter
  }
}

function invalid(message) {
  return new ApiError(message, { code: 'INVALID_REQUEST' })
}

function joinUrl(baseUrl, path, query) {
  // Only the configured API origin may receive credentials. Paths never override it.
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) {
    throw invalid('API path must be an absolute pathname within the configured baseUrl.')
  }
  for (const segment of path.split('/')) {
    let decoded
    try { decoded = decodeURIComponent(segment) } catch { throw invalid('Invalid URL encoding.') }
    if (decoded === '.' || decoded === '..' || /[\\]/.test(decoded)) throw invalid('Path traversal is not allowed.')
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null) continue
      if (!['string', 'number', 'boolean'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item))) {
        throw invalid(`Query parameter ${key} must be a scalar or an array of scalars.`)
      }
      params.append(key, String(item))
    }
  }
  const suffix = params.toString()
  return `${baseUrl}${path}${suffix ? `?${suffix}` : ''}`
}

function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[?#\\\s]/.test(value)) throw invalid('Invalid API baseUrl.')
  const baseUrl = value.replace(/\/+$/, '')
  if (baseUrl.startsWith('/') && !baseUrl.startsWith('//')) return baseUrl
  let parsed
  try { parsed = new URL(baseUrl) } catch { throw invalid('baseUrl must be an API pathname or an HTTP(S) URL.') }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw invalid('Invalid API origin.')
  return baseUrl
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Create one client for an API origin; token and business callbacks are read per request.
 * @param {ClientOptions} [config]
 */
export function createApiClient({
  baseUrl = '/api/v1',
  fetchImpl = globalThis.fetch?.bind(globalThis),
  getAccessToken = () => null,
  getBusinessId = () => null,
  timeoutMs = 20_000,
  credentials = 'same-origin',
  headers: defaultHeaders,
} = {}) {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  if (typeof fetchImpl !== 'function') throw invalid('A fetch implementation is required.')

  /** @param {string} path @param {RequestOptions} [options] */
  async function request(path, options = {}) {
    const controller = new AbortController()
    const duration = options.timeoutMs ?? timeoutMs
    if (!Number.isFinite(duration) || duration < 0) throw invalid('timeoutMs must be a nonnegative finite number.')
    let timer
    let cancellationError
    let rejectCancellation
    const cancellation = new Promise((_, reject) => { rejectCancellation = reject })
    const abort = (code, message) => {
      if (cancellationError) return
      cancellationError = new ApiError(message, { code })
      controller.abort(cancellationError)
      rejectCancellation(cancellationError)
    }
    const onAbort = () => abort('REQUEST_ABORTED', 'Request cancelled.')
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) onAbort()
    if (duration > 0) timer = setTimeout(() => abort('REQUEST_TIMEOUT', 'Request timed out.'), duration)

    const execute = async () => {
      if (cancellationError) throw cancellationError
      const url = joinUrl(normalizedBase, path, options.query)
      const method = (options.method ?? 'GET').toUpperCase()
      const headers = new Headers(defaultHeaders)
      new Headers(options.headers).forEach((value, key) => headers.set(key, value))
      headers.set('Accept', 'application/json')
      // These headers come from the current auth context, never stale default headers.
      headers.delete('Authorization')
      headers.delete('X-Business-Id')
      const token = options.auth === false ? null : await getAccessToken()
      const businessId = options.business === false ? null : await getBusinessId()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (options.business !== false && !businessId) {
        throw new ApiError('Select a business before requesting business data.', { code: 'MISSING_BUSINESS_ID' })
      }
      if (businessId) headers.set('X-Business-Id', businessId)
      if (options.idempotencyKey !== undefined) {
        if (!options.idempotencyKey?.trim()) throw invalid('idempotencyKey cannot be empty.')
        headers.set('Idempotency-Key', options.idempotencyKey)
      }
      if (options.revision !== undefined) {
        const revision = String(options.revision)
        if (!revision || /["\r\n]/.test(revision)) throw invalid('revision must be an unquoted opaque version.')
        headers.set('If-Match', `"${revision}"`)
      }
      let body
      if (options.body !== undefined) {
        if (method === 'GET' || method === 'HEAD') throw invalid(`${method} cannot include a request body.`)
        if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
          body = options.body
          headers.delete('Content-Type') // Browser supplies the multipart boundary.
        } else {
          try { body = JSON.stringify(options.body) } catch (cause) {
            throw new ApiError('Request body must be JSON serializable.', { code: 'INVALID_REQUEST', cause })
          }
          if (body === undefined) throw invalid('Request body must be JSON serializable.')
          headers.set('Content-Type', 'application/json')
        }
      }
      if (cancellationError) throw cancellationError
      // Reject HTTP redirects; a redirect must never move tenant/auth context to another origin.
      const response = await fetchImpl(url, { method, headers, body, signal: controller.signal, credentials, redirect: 'error' })
      const headerRequestId = response.headers.get('X-Request-Id')
      const text = response.status === 204 ? '' : await response.text()
      let payload
      if (text) {
        try { payload = JSON.parse(text) } catch {
          if (response.ok) throw new ApiError('The API returned invalid JSON.', { code: 'INVALID_RESPONSE', status: response.status, requestId: headerRequestId })
        }
      }
      const requestId = payload?.meta?.requestId ?? headerRequestId ?? null
      if (!response.ok) {
        const error = isRecord(payload?.error) ? payload.error : {}
        throw new ApiError(typeof error.message === 'string' ? error.message : `Request failed (${response.status}).`, {
          code: typeof error.code === 'string' ? error.code : `HTTP_${response.status}`,
          status: response.status,
          fieldErrors: isRecord(error.fieldErrors) ? error.fieldErrors : {},
          requestId,
          retryAfter: response.headers.get('Retry-After'),
        })
      }
      if (response.status === 204) {
        const dataVersion = response.headers.get('X-Data-Version')
        return { data: null, meta: { requestId, ...(dataVersion ? { dataVersion } : {}) } }
      }
      if (!isRecord(payload) || !Object.hasOwn(payload, 'data') || !isRecord(payload.meta)) {
        throw new ApiError('Expected an API response with data and meta.', { code: 'INVALID_RESPONSE', status: response.status, requestId })
      }
      return { data: payload.data, meta: { ...payload.meta, requestId } }
    }

    try {
      return await Promise.race([execute(), cancellation])
    } catch (cause) {
      if (cancellationError) throw cancellationError
      if (cause instanceof ApiError) throw cause
      throw new ApiError('Unable to complete the API request.', { code: 'NETWORK_ERROR', cause })
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  return { request }
}
