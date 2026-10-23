import type { ApiClient, ClientOptions, FieldErrors, SmeApi } from './contracts'
export * from './contracts'
export declare class ApiError extends Error {
  code: string
  status: number
  fieldErrors: FieldErrors
  requestId: string | null
  retryAfter: string | null
  constructor(message: string, details?: {
    code?: string; status?: number; fieldErrors?: FieldErrors; requestId?: string | null; retryAfter?: string | null; cause?: unknown
  })
}
export declare function createApiClient(options?: ClientOptions): ApiClient
export declare function createSmeApi(client: ApiClient): SmeApi
