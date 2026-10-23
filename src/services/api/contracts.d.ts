/** Proposed frontend/backend contract. Not an API defined by the original report. */
export type Id = string
/** Unquoted server-issued entity version. Sent as If-Match: "revision". */
export type Revision = string
/** Base-10 integer string, e.g. "12850" = CNY 128.50. Transaction amount must match /^[1-9]\d*$/. */
export type MinorAmount = string
/** Decimal string; ratios use 0.36 = 36%, percentage points use -3.1 = -3.1 percentage points. */
export type Decimal = string
export type Direction = 'inflow' | 'outflow'
export type TransactionKind = 'sale' | 'expense' | 'refund' | 'transfer' | 'settlement' | 'loan' | 'owner_contribution' | 'other'
export type FieldErrors = Record<string, string[]>
export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue | QueryValue[]>
export interface Meta {
  requestId: string | null
  dataVersion?: string
  snapshotId?: string
  generatedAt?: string
  [key: string]: unknown
}
export interface Envelope<T> { data: T; meta: Meta }
export interface ErrorPayload { error: { code: string; message: string; fieldErrors?: FieldErrors }; meta: Meta }
export interface CallOptions {
  signal?: AbortSignal
  /** 0 disables the timeout; default 20000ms. This is not a server-side job deadline. */
  timeoutMs?: number
  headers?: HeadersInit
  /** Generated once per user intent and reused only for an identical retry payload. */
  idempotencyKey?: string
  revision?: Revision
}
export interface CreateOptions extends CallOptions { idempotencyKey: string }
export interface EditOptions extends CallOptions { revision: Revision }
export interface RequestOptions extends CallOptions {
  method?: string
  query?: Query
  body?: unknown
  auth?: boolean
  business?: boolean
}
export interface ClientOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  getBusinessId?: () => string | null | undefined | Promise<string | null | undefined>
  timeoutMs?: number
  credentials?: RequestCredentials
  headers?: HeadersInit
}
export interface ApiClient { request<T = unknown>(path: string, options?: RequestOptions): Promise<Envelope<T>> }
export interface PageQuery extends Query { cursor?: string; limit?: number }
export interface Page<T> { items: T[]; nextCursor: string | null; total?: number }
export interface Entity { id: Id; revision: Revision; createdAt: string; updatedAt: string }
export interface BusinessProfile extends Entity {
  name: string; industry: string; currency: 'CNY'; timezone: string
  /** Proposed server capability declaration, used for UI availability only, never authorization. */
  capabilities?: Partial<{ billImport: boolean; analytics: boolean; assistant: boolean; ocr: boolean; alerts: boolean; memberManagement: boolean; backup: boolean; export: boolean }>
  /** Supported file extensions without a dot, e.g. ['csv', 'xlsx']; actual parser support governs. */
  supportedImportFormats?: string[]
  supportedExportFormats?: ('xlsx' | 'pdf')[]
}
export type BusinessInput = Pick<BusinessProfile, 'name' | 'industry' | 'currency' | 'timezone'>
export interface CurrentUser { id: Id; displayName: string; businessIds: Id[]; permissions: string[] }
/** Auth provider must be confirmed with the team; no password/SDK provider is hardwired. */
export interface LoginInput { provider: string; code: string; redirectUri?: string }
export interface Session { user: CurrentUser; expiresAt: string; accessToken?: string }
export interface TransactionInput {
  businessDate: string // YYYY-MM-DD in the business timezone
  direction: Direction
  kind: TransactionKind
  amountMinor: MinorAmount // positive; no sign or decimal point
  currency: 'CNY'
  categoryId: Id | null
  summary: string
  productId?: Id
  receiptId?: Id
  originalTransactionId?: Id // required by server for a refund when known
  note?: string
}
export interface Transaction extends Entity, TransactionInput {
  businessId: Id
  status: 'posted' | 'voided'
  categoryStatus: 'confirmed' | 'unclassified'
    source: { platform: 'manual' | 'wechat' | 'alipay' | 'receipt'; importId?: Id; importRowId?: Id; sourceAccountId?: Id; sourceTransactionId?: string }
}
export interface TransactionQuery extends PageQuery {
  startDate?: string; endDate?: string; categoryId?: Id; direction?: Direction; kind?: TransactionKind
  importId?: Id; status?: 'posted' | 'voided'; search?: string; sort?: string; dataVersion?: string
}
export interface ReasonInput { reason: string }
export interface BulkCategoryInput { items: { id: Id; revision: Revision }[]; categoryId: Id }
export interface BulkResult { items: { id: Id; status: 'updated' | 'failed'; error?: ErrorPayload['error'] }[] }
export interface CategoryInput { name: string; parentId?: Id | null; direction: Direction; metricRole: string }
export interface Category extends Entity, CategoryInput { archived: boolean }
export interface ProductInput { name: string; sku?: string; priceMinor: MinorAmount; costMinor: MinorAmount; currency: 'CNY' }
export interface Product extends Entity, ProductInput { archived: boolean }
export interface CostAllocationInput {
  name: string; amountMinor: MinorAmount; currency: 'CNY'; categoryId: Id
  periodStart: string; periodEnd: string; sourceTransactionId?: Id; note?: string
}
export interface CostAllocation extends Entity, CostAllocationInput { status: 'active' | 'voided' }
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export interface Job<T = unknown> {
  id: Id; kind: string; status: JobStatus; stage: string
  /** Null if the server cannot report a measured percentage; never simulate progress. */
  progress: number | null
  result?: T; error?: ErrorPayload['error']; retryAfterMs?: number
}
export interface ImportBatch extends Entity {
  status: 'queued' | 'parsing' | 'review' | 'committing' | 'completed' | 'failed' | 'cancelled'
  jobId?: Id; filename: string; platform: 'wechat' | 'alipay'; parserVersion?: string
  counts: { total: number; invalid: number; duplicate: number; ready: number; needsReview: number; posted: number }
}
export interface ImportRow {
  id: Id; revision: Revision; rowNumber: number; raw: Record<string, string>
  draft: Partial<TransactionInput>
  status: 'invalid' | 'duplicate' | 'ready' | 'needs_review' | 'posted'
  categoryConfidence: number | null
  fieldErrors: FieldErrors; reviewReasons?: string[]; kindConfirmed?: boolean; duplicateTransactionId?: Id
}
export interface ImportMapping { columns: Record<string, string>; dateFormat?: string; encoding?: string }
export interface ImportRowPatch { draft?: Partial<TransactionInput>; categoryConfirmed?: boolean; kindConfirmed?: boolean; duplicateDecision?: 'skip' | 'keep' }
export interface ImportCommit { rows: { id: Id; revision: Revision }[] }
export interface ImportCommitResult { importId: Id; postedTransactionIds: Id[]; failedRowIds: Id[]; pendingRowIds: Id[] }
export interface AnalyticsQuery extends Query {
  startDate: string; endDate: string; timezone: string
  granularity: 'day' | 'week' | 'month'
  comparison?: 'previous_period' | 'previous_year' | 'custom'
  compareStartDate?: string; compareEndDate?: string
  metricBasis?: string; storeId?: Id; categoryId?: Id; dataVersion?: string; snapshotId?: Id
}
export type MetricUnit = 'currency_minor' | 'ratio' | 'percentage_point' | 'count'
export interface Metric {
  id: Id; label: string; value: string | null; unit: MetricUnit; currency?: 'CNY'
  definition: { basis: string; formula: string; numerator?: string; denominator?: string }
  quality: 'complete' | 'partial' | 'unavailable'; qualityReason?: string
  evidenceId?: Id
}
export interface MetricSummary { query: AnalyticsQuery; metrics: Metric[] }
export interface TrendSeries { metricId: Id; unit: MetricUnit; points: { date: string; value: string | null; evidenceId?: Id }[] }
export interface CostStructure { denominatorMetricId: Id; totalMinor: MinorAmount | null; items: { categoryId: Id; label: string; amountMinor: MinorAmount; ratio: Decimal | null; evidenceId?: Id }[] }
export interface Comparison {
  metricId: Id; current: Metric; previous: Metric; absoluteChange: string | null
  relativeChange: Decimal | null; percentagePointChange: Decimal | null
  direction: 'up' | 'down' | 'flat' | 'unknown'; favorability: 'positive' | 'negative' | 'neutral' | 'unknown'
  unavailableReason?: string
}
export interface Evidence { id: Id; snapshotId: Id; dataVersion: string; query: AnalyticsQuery; metrics: Metric[]; transactions: Page<Transaction> }
export interface Conversation extends Entity { title: string; query: AnalyticsQuery }
export interface MessageInput { text: string; query: AnalyticsQuery; parentMessageId?: Id }
export interface AssistantMessage extends Entity {
  role: 'user' | 'assistant'; conversationId: Id; jobId?: Id
  status: 'queued' | 'querying' | 'calculating' | 'generating' | 'completed' | 'needs_clarification' | 'insufficient_data' | 'stopped' | 'failed'
  text: string; querySnapshot: AnalyticsQuery; snapshotId?: Id; dataVersion?: string
  metricIds: Id[]; evidenceIds: Id[]; error?: ErrorPayload['error']
}
export interface Receipt extends Entity {
  status: 'queued' | 'recognizing' | 'review' | 'committing' | 'posted' | 'failed'
  jobId?: Id; previewUrl?: string; fields: Partial<TransactionInput>
  fieldConfidence: Record<string, number | null>; suspectedTransactionIds: Id[]; transactionId?: Id
}
export type ReceiptConfirm = { action: 'create'; transaction: TransactionInput } | { action: 'link'; transactionId: Id; transactionRevision: Revision }
export interface AlertRuleInput {
  name: string; metricId: Id; numeratorMetricId?: Id; denominatorMetricId?: Id
  operator: 'gt' | 'gte' | 'lt' | 'lte'; threshold: Decimal; unit: MetricUnit
  period: 'day' | 'week' | 'month'; consecutivePeriods: number; enabled: boolean
}
export interface AlertRule extends Entity, AlertRuleInput { }
export interface AlertEvent extends Entity {
  ruleId: Id; title: string; status: 'open' | 'resolved' | 'ignored'; readAt: string | null
  severity: 'info' | 'warning' | 'critical'; evidenceId: Id; actual: Metric
  notification: { channel: string | null; status: 'not_configured' | 'queued' | 'delivered' | 'failed'; deliveredAt?: string }
}
export interface Member extends Entity { userId: Id; displayName: string; role: 'owner' | 'accountant' | 'clerk'; active: boolean }
export interface Invitation extends Entity { contact: string; role: 'accountant' | 'clerk'; status: 'pending' | 'accepted' | 'revoked' | 'expired' }
export interface Backup extends Entity { status: JobStatus; jobId: Id; dataVersion: string; restorable: boolean }
export interface DestructivePreview { previewToken: string; expiresAt: string; dataVersion: string; affectedCounts: Record<string, number> }
export interface DestructiveConfirmation { previewToken: string; confirmedBusinessName: string; reason: string }
export interface ExportInput { format: 'xlsx' | 'pdf'; scope: 'transactions' | 'analytics'; query: AnalyticsQuery; snapshotId?: Id }
export interface ExportTask extends Entity { status: JobStatus; jobId: Id; snapshotId?: Id; error?: ErrorPayload['error'] }
/** Short-lived server-authorized URL; never attach the API bearer token to this URL. */
export interface DownloadGrant { url: string; expiresAt: string; filename: string; sizeBytes: number; contentType: string }
export interface AuditEvent { id: Id; actorId: Id; action: string; entityId: Id; createdAt: string; requestId: string }

type Result<T> = Promise<Envelope<T>>
type List<T, Q extends Query = PageQuery> = (query?: Q, options?: CallOptions) => Result<Page<T>>
type Get<T> = (id: Id, options?: CallOptions) => Result<T>
type Create<I, O> = (payload: I, options: CreateOptions) => Result<O>
type Update<I, O> = (id: Id, payload: I, options: EditOptions) => Result<O>
type Action<I, O> = (id: Id, payload: I, options: CreateOptions & EditOptions) => Result<O>
export interface SmeApi {
  auth: {
    me(options?: CallOptions): Result<CurrentUser>
    login(payload: LoginInput, options?: CallOptions): Result<Session>
    session(options?: CallOptions): Result<Session>
    logout(options?: CallOptions): Result<null>
  }
  business: {
    getProfile(options?: CallOptions): Result<BusinessProfile>
    createProfile: Create<BusinessInput, BusinessProfile>
    updateProfile(payload: Partial<BusinessInput>, options: EditOptions): Result<BusinessProfile>
  }
  imports: {
    create: Create<FormData, ImportBatch>; list: List<ImportBatch>; get: Get<ImportBatch>
    rows(importId: Id, query?: PageQuery, options?: CallOptions): Result<Page<ImportRow>>
    mapFields: Update<ImportMapping, ImportBatch>
    updateRow(importId: Id, rowId: Id, payload: ImportRowPatch, options: EditOptions): Result<ImportRow>
    commit: Action<ImportCommit, Job<ImportCommitResult>>
    cancel(importId: Id, options: CreateOptions): Result<ImportBatch>
  }
  transactions: {
    list: List<Transaction, TransactionQuery>; get: Get<Transaction>; create: Create<TransactionInput, Transaction>
    update: Update<Partial<TransactionInput>, Transaction>; void: Action<ReasonInput, Transaction>
    bulkCategory(payload: BulkCategoryInput, options: CreateOptions): Result<BulkResult>
  }
  categories: { list: List<Category>; create: Create<CategoryInput, Category>; update: Update<Partial<CategoryInput>, Category>; archive(id: Id, options: CreateOptions & EditOptions): Result<Category> }
  products: { list: List<Product>; get: Get<Product>; create: Create<ProductInput, Product>; update: Update<Partial<ProductInput>, Product>; archive(id: Id, options: CreateOptions & EditOptions): Result<Product> }
  costAllocations: { list: List<CostAllocation>; get: Get<CostAllocation>; create: Create<CostAllocationInput, CostAllocation>; update: Update<Partial<CostAllocationInput>, CostAllocation>; void: Action<ReasonInput, CostAllocation> }
  analytics: {
    summary(query: AnalyticsQuery, options?: CallOptions): Result<MetricSummary>
    trends(query: AnalyticsQuery, options?: CallOptions): Result<TrendSeries[]>
    costStructure(query: AnalyticsQuery, options?: CallOptions): Result<CostStructure>
    comparisons(query: AnalyticsQuery, options?: CallOptions): Result<Comparison[]>
    evidence(evidenceId: Id, query?: PageQuery, options?: CallOptions): Result<Evidence>
  }
  assistant: {
    conversations: List<Conversation>; createConversation: Create<{ title?: string; query: AnalyticsQuery }, Conversation>
    messages(conversationId: Id, query?: PageQuery, options?: CallOptions): Result<Page<AssistantMessage>>
    sendMessage: (conversationId: Id, payload: MessageInput, options: CreateOptions) => Result<AssistantMessage>
    getMessage(conversationId: Id, messageId: Id, options?: CallOptions): Result<AssistantMessage>
    cancelMessage(conversationId: Id, messageId: Id, options: CreateOptions): Result<AssistantMessage>
  }
  receipts: {
    create: Create<FormData, Receipt>; get: Get<Receipt>; update: Update<{ fields: Partial<TransactionInput> }, Receipt>
    recognize: Action<{ rotation: 0 | 90 | 180 | 270 }, Receipt>; confirm: Action<ReceiptConfirm, Receipt>
  }
  alerts: {
    list: List<AlertEvent>; get: Get<AlertEvent>; read(id: Id, options?: CallOptions): Result<AlertEvent>
    resolve: Action<ReasonInput, AlertEvent>; ignore: Action<ReasonInput, AlertEvent>
    reopen(id: Id, options: CreateOptions & EditOptions): Result<AlertEvent>
    rules: List<AlertRule>; createRule: Create<AlertRuleInput, AlertRule>; updateRule: Update<Partial<AlertRuleInput>, AlertRule>
  }
  members: {
    list: List<Member>; invite: Create<{ contact: string; role: 'accountant' | 'clerk' }, Invitation>
    update: Update<{ role?: Member['role']; active?: boolean }, Member>; remove: Action<ReasonInput, null>
    revokeInvitation(id: Id, options: CreateOptions & EditOptions): Result<null>
  }
  backups: {
    list: List<Backup>; create: Create<{ label?: string }, Backup>
    previewRestore(id: Id, payload: { dataVersion: string }, options?: CallOptions): Result<DestructivePreview>
    restore: Action<DestructiveConfirmation, Job>
  }
  exports: { create: Create<ExportInput, ExportTask>; get: Get<ExportTask>; getDownload: Get<DownloadGrant> }
  dataDeletion: {
    preview(payload: { scope: 'business_data'; dataVersion: string }, options?: CallOptions): Result<DestructivePreview>
    create: Create<DestructiveConfirmation, Job>; get: Get<Job>
  }
  jobs: { get: Get<Job> }
  audit: { list: List<AuditEvent> }
}
