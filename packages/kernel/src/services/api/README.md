# 前端接口预留层

这是依据软件设计报告 5.1—5.4、6.3—6.4、8.1—8.2 整理的 **HTTP 对接草案**，需要前端、后端、指标算法和 AI 队友共同确认。报告没有规定这些 URL、字段、状态码、身份提供商或 HTTP 传输方式。当前实现提供可调用的前端请求层和字段类型，不代表后端已实现。

一期闭环是手工记账、微信/支付宝**导出文件**导入与分类、指标报表和智能问答。OCR、主动预警、完整成员管理、备份与导出是扩展能力。`createSmeApi()` 只创建方法，不自动请求扩展接口。报告一期是微信小程序与云开发，本目录服务于当前 Vue Web 工程；若云函数网关约定不同，修改适配层，不让页面散落服务商调用。

## 文件与职责

| 文件 | 用途 |
| --- | --- |
| `client.js` | fetch 注入、鉴权/主体头、超时取消、JSON/FormData、统一错误 |
| `index.js` | `createSmeApi` 分域方法；统一导出 `createApiClient`、`createSmeApi`、`ApiError` |
| `contracts.d.ts` | 每项方法的输入/返回类型、金额/指标/分页/任务状态和实体字段 |
| `index.d.ts` | JS 项目的编辑器类型入口，不要求安装 TypeScript |
| `client.test.mjs` | Node 内置测试，全程 mock transport，不访问真实网络 |

## 页面如何调用

```js
import { createApiClient, createSmeApi, ApiError } from './services/api/index.js'

const api = createSmeApi(createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  getAccessToken: () => authState.accessToken, // 由团队认证模块提供，按请求动态读取
  getBusinessId: () => authState.businessId,
}))

// 在一次用户保存意图开始时创建，发生相同内容重试时沿用。
const idempotencyKey = crypto.randomUUID()
try {
  const { data, meta } = await api.transactions.create({
    businessDate: '2026-06-15', direction: 'outflow', kind: 'expense',
    amountMinor: '12850', currency: 'CNY', categoryId: 'raw-materials',
    summary: '原材料采购',
  }, { idempotencyKey })
  // 用 data 更新账本，以 meta.dataVersion 刷新有关指标。
} catch (error) {
  if (error instanceof ApiError) {
    // 表单映射 error.fieldErrors；提示 error.message；问题反馈附 error.requestId。
    // 不记录 token、登录凭据或原始账单内容。
  }
}
```

`VITE_API_BASE_URL` 只保存公开接口地址，例如 `/api/v1` 或 `https://api.example.com/api/v1`。**访问令牌、模型 API Key、密码不能放进 `VITE_` 环境变量**，这些变量会进入浏览器构建产物。本层不读写 localStorage，不持久化令牌，不调用模型供应商；认证凭据由认证模块管理。若使用 HttpOnly Cookie，`getAccessToken` 可返回空值；跨域 cookie 需要显式 `credentials: 'include'`，并由服务端团队落实 CORS 与 CSRF 策略。

默认基础路径是 `/api/v1`，方法内部只写 `/transactions` 等资源路径。请求路径不能是其他绝对 URL，不允许跳出基础路径；HTTP 重定向会被拒绝。下载 URL 通过专门的下载授权接口获取，不把 API 的 Bearer token 附加到下载地址。

## 明确切换演示和真实服务

```js
// 本示例仅说明 fetchImpl 注入，不是自动启用的演示数据。
const mockFetch = async (url, init) => {
  if (url === '/api/v1/transactions' && init.method === 'GET') {
    return new Response(JSON.stringify({
      data: { items: [], nextCursor: null, total: 0 },
      meta: { requestId: 'demo-request', dataVersion: 'demo-v1' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({
    error: { code: 'DEMO_NOT_IMPLEMENTED', message: '演示接口尚未定义', fieldErrors: {} },
    meta: { requestId: 'demo-missing' },
  }), { status: 501 })
}

const demoApi = createSmeApi(createApiClient({
  fetchImpl: mockFetch,
  getBusinessId: () => 'demo-business',
}))
```

接真接口时移除 `fetchImpl` 注入并配置真实 `baseUrl` 与身份回调。演示模式必须明确标识；HTTP 错误不会悄悄切换到示例数据，也不会因为 401/403 擅自清空用户状态。界面应由会话模块决定重新登录或权限提示。

## 通用约定

成功保留完整 envelope：`{ data, meta: { requestId, dataVersion?, snapshotId?, generatedAt? } }`。分页数据为 `{ items, nextCursor, total? }`，查询用 `cursor`、`limit`；服务器确认上限。空成功响应 204 转成 `{ data: null, meta: { requestId } }`，如有 `X-Data-Version` 则保留。其他成功响应必须包含 `data` 和对象类型的 `meta`。

失败约定为 `{ error: { code, message, fieldErrors? }, meta: { requestId } }`。统一抛出 `ApiError`，包含 `code`、`status`、`message`、`fieldErrors`、`requestId`、`retryAfter`。`fieldErrors` 为字段名到字符串数组。非 JSON 的 HTTP 失败仍保留状态码，不直接把网关 HTML 展示为错误文案。

| 请求约定 | 行为 |
| --- | --- |
| 身份 | 每次从 `getAccessToken()` 获取，发送 `Authorization: Bearer ...`；登录不携带旧凭据 |
| 经营主体 | 业务方法从 `getBusinessId()` 获取并发送 `X-Business-Id`；缺少主体会抛 `MISSING_BUSINESS_ID` |
| 前端权限 | `permissions`、`capabilities` 只控制显示；服务端仍验证用户、主体、角色、资源归属和每个操作 |
| 幂等 | `options.idempotencyKey` → `Idempotency-Key`；创建、导入确认、OCR 确认、AI 提问、备份/导出等类型要求提供 |
| 并发编辑 | `options.revision` → `If-Match: "revision"`；传入服务器返回的未加引号版本；冲突由 409/412 提示刷新和重新确认 |
| 参数编码 | query 使用 URLSearchParams；忽略 undefined/null，保留 0/false；数组作为重复同名键；对象须按契约展开 |
| 表单上传 | `FormData` 原样传递，删除手写 Content-Type，由浏览器补 multipart boundary |
| 超时 | 默认 20 秒，可按请求改 `timeoutMs`；0 表示关闭；抛 `REQUEST_TIMEOUT` |
| 取消 | 传 `AbortSignal`；抛 `REQUEST_ABORTED`；切换页面或查询条件时取消旧请求 |
| 网络失败 | 抛 `NETWORK_ERROR`；不自动重试 POST 或任何其他请求，不替换成 mock |
| 响应不合约 | 成功响应无法解析为 JSON 或缺少 envelope 时抛 `INVALID_RESPONSE` |

创建/修改字段的 `.d.ts` 约束帮助开发联调，不是运行时安全校验。服务器必须验证幂等键、版本、金额、分类、权限和文件内容。**客户端超时或取消只代表不再等待，不能证明后台写入失败。** 用已返回任务 ID 查询，或用同一幂等键和完全相同的请求内容核查结果。改变内容应当产生新的意图和新键，不能沿用旧键。

导入批次、问答会话和消息历史均通过 `nextCursor` 翻页，游标按服务端返回的原值传回，不把固定首屏数量当作完整历史。演示流水的 `source.importRowId` 是可选的导入行追溯字段；服务端仍须保证每个已确认导入行只能入账一次，并在修改或作废原流水时校验已有退款。

上传入口暂约定 `file`、`platform`（wechat/alipay）、可选 `sourceAccountId`；一次提交一个文件，多文件界面分别创建批次。票据上传使用 `file`。格式、大小、编码、票据识别能力由后端确认。本 fetch 实现不提供字节上传进度，只提供请求取消；界面使用不确定进度，服务器解析进度来自任务结果。

金额通过十进制**整数分字符串**传递，交易 `amountMinor` 必须是正值，收支方向用 `direction`，不把负数再取一次反。商品售价和成本可由服务端允许零；聚合利润指标允许负值。收入、支出、结余、毛利、经营利润的口径由指标队友明确，前端不根据流水自行推导为实际利润。

指标 `unit` 区分 `currency_minor`、`ratio`、`percentage_point`、`count`；`ratio: "0.36"` 显示 36%，`percentagePointChange: "-3.1"` 显示下降 3.1 个百分点。`null` 表示缺失/无法比较，与 0 区分。证据返回 `snapshotId`、`dataVersion` 和原查询上下文；图表与 AI 证据按同一快照展示。

## 方法清单

下表的 `payload` 字段详见 `contracts.d.ts`。全部方法最后一个参数为 `options`；读操作可省略，创建操作需要 `idempotencyKey`，编辑操作需要 `revision`，部分确认动作两者都需要。`id` 均在路径中编码。以下 URL 均相对 `/api/v1`。

| 领域 | 方法签名（省略末尾 options） | HTTP 草案 |
| --- | --- | --- |
| 身份 | `auth.me()`、`auth.session()` | GET `/auth/me`、`/auth/session` |
| 登录登出 | `auth.login(payload)`、`auth.logout()` | POST、DELETE `/auth/session` |
| 主体配置 | `business.getProfile()`、`createProfile(payload)`、`updateProfile(payload)` | GET、POST、PATCH `/business/profile` |
| 导入批次 | `imports.create(formData)`、`list(query)`、`get(importId)` | POST/GET `/imports`；GET `/imports/:id` |
| 预览和映射 | `imports.rows(importId, query)`、`mapFields(importId, payload)` | GET `/:id/rows`；PATCH `/:id/mapping` |
| 修正、提交、取消 | `imports.updateRow(importId, rowId, payload)`、`commit(importId, payload)`、`cancel(importId)` | PATCH `/imports/:id/rows/:rowId`；POST `/:id/commit`、`/:id/cancel` |
| 流水 | `transactions.list(query)`、`get(id)`、`create(payload)`、`update(id, payload)` | GET/POST `/transactions`；GET/PATCH `/:id` |
| 作废和分类 | `transactions.void(id, payload)`、`bulkCategory(payload)` | POST `/transactions/:id/void`；PATCH `/transactions/bulk-category` |
| 分类 | `categories.list(query)`、`create(payload)`、`update(id, payload)`、`archive(id)` | GET/POST `/categories`；PATCH `/:id`；POST `/:id/archive` |
| 商品 | `products.list(query)`、`get(id)`、`create(payload)`、`update(id, payload)`、`archive(id)` | GET/POST `/products`；GET/PATCH `/:id`；POST `/:id/archive` |
| 成本归集 | `costAllocations.list(query)`、`get(id)`、`create(payload)`、`update(id, payload)`、`void(id, payload)` | GET/POST `/cost-allocations`；GET/PATCH `/:id`；POST `/:id/void` |
| 指标 | `analytics.summary(query)`、`trends(query)`、`costStructure(query)`、`comparisons(query)` | GET `/analytics/summary`、`trends`、`cost-structure`、`comparisons` |
| 证据 | `analytics.evidence(evidenceId, query)` | GET `/analytics/evidence/:id` |
| AI 会话 | `assistant.conversations(query)`、`createConversation(payload)` | GET/POST `/assistant/conversations` |
| AI 消息 | `assistant.messages(conversationId, query)`、`sendMessage(conversationId, payload)` | GET/POST `/assistant/conversations/:id/messages` |
| 回答状态和停止 | `assistant.getMessage(conversationId, messageId)`、`cancelMessage(conversationId, messageId)` | GET `/assistant/conversations/:id/messages/:messageId`；POST `.../cancel` |
| OCR（扩展） | `receipts.create(formData)`、`get(id)`、`update(id, payload)`、`recognize(id, payload)`、`confirm(id, payload)` | POST `/receipts`；GET/PATCH `/:id`；POST `/:id/recognize`、`/:id/confirm` |
| 预警（扩展） | `alerts.list(query)`、`get(id)`、`read(id)`、`resolve(id, payload)`、`ignore(id, payload)`、`reopen(id)` | GET `/alerts`、`/:id`；POST `/:id/read`、`resolve`、`ignore`、`reopen` |
| 规则（扩展） | `alerts.rules(query)`、`createRule(payload)`、`updateRule(id, payload)` | GET/POST `/alert-rules`；PATCH `/:id` |
| 成员（扩展） | `members.list(query)`、`invite(payload)`、`update(id, payload)`、`remove(id, payload)`、`revokeInvitation(id)` | GET `/members`；POST `/members/invitations`；PATCH/DELETE `/members/:id`；DELETE `/members/invitations/:id` |
| 备份（扩展） | `backups.list(query)`、`create(payload)`、`previewRestore(id, payload)`、`restore(id, payload)` | GET/POST `/backups`；POST `/:id/restore-preview`、`/:id/restore` |
| 导出（扩展） | `exports.create(payload)`、`get(id)`、`getDownload(id)` | POST `/exports`；GET `/:id`、`/:id/download` |
| 数据删除 | `dataDeletion.preview(payload)`、`create(payload)`、`get(id)` | POST `/data-deletions/preview`、`/data-deletions`；GET `/data-deletions/:id` |
| 通用任务 | `jobs.get(id)` | GET `/jobs/:id` |
| 审计（扩展） | `audit.list(query)` | GET `/audit-logs` |

流水的删除通过 `void` 保留原记录与原因。导入行预览支持人工核对业务类型、分类和去重；`kindConfirmed` 标记人工确认，自动分类不等于已入账。转账不计入经营指标，退款须关联原销售或支出流水，后端仍要复核分类、方向和累计退款额。`bulkCategory` 提交明确的 `{ id, revision }[]`，不能暗中把当前分页选择扩展到所有流水。OCR `confirm` 区分新建交易 `action: 'create'` 与给已有流水附凭证 `action: 'link'`，防止同一费用重复入账。

## 异步任务与 AI 对接

通用任务状态：`queued → running → succeeded/failed/cancelled`，同时提供业务 `stage`、可空 `progress`、`error`、可选 `retryAfterMs`。接口层提供单次查询，页面 composable 负责轮询：等待本次请求完成后安排下一次，终态、离页或主体切换时停止；可见性恢复时继续查询。轮询间隔先跟随后端建议，不重叠请求，不伪造进度。本层不强制 SSE，适合先对接云函数网关。

AI 使用 `createConversation → sendMessage → getMessage / jobs.get`。回答状态覆盖查询、计算、生成、需要澄清、数据不足、停止和失败。取消 HTTP 不等于停止模型任务，需要调用 `cancelMessage`，再读取服务器最终状态。用户显式重试才创建新的消息意图；是否复用原任务由返回状态和团队约定决定。

AI 队友提供可核对的 `metricIds`、`evidenceIds`、`querySnapshot`、`snapshotId` 和 `dataVersion`；前端用这些信息渲染指标和证据。数值计算、权限检查、模型密钥、任意 SQL/URL 防护和归因约束在服务端，不由浏览器承担。

导出先创建任务，成功后取得短效、按权限授权的 `DownloadGrant`；过期重新取下载授权。下载 URL 不经带 Bearer token 的 API 客户端请求。恢复和业务数据删除先请求影响预览，再由用户确认范围，提交 `previewToken`、主体名称与原因。服务端验证预览有效期、版本、权限与幂等键。前端示例不自动触发这些操作，不执行生产数据库操作。

备份任务成功不等于已验证可恢复；是否支持定时、增量、加密、微信推送，均需后端真实能力声明。`BusinessProfile.capabilities` 是可选的建议字段，界面按能力开启入口；缺失时不得显示已经开通成功。主体响应还预留两个可选的**顶层字段**：`supportedImportFormats` 是不带点的扩展名数组（例如 `['csv', 'xlsx']`），`supportedExportFormats` 为已实现的 `['xlsx', 'pdf']` 子集；缺失时界面不应推断全部格式受支持，应用启动适配层可将它们合并到界面使用的能力状态中。

## 联调验收与本地检查

前后端逐项确认：路径/方法、字段和必填项、分页与排序、金额/时区/指标口径、上传样本、状态枚举、错误码、revision/幂等语义、数据版本和证据快照。建议后端返回 401（未登录）、403（无权限）、409/412（冲突）、422（字段错误）、429（频率限制）和 5xx（服务故障）；最终以共同签字的契约为准。

在项目根目录运行：

```powershell
node --test src/services/api/client.test.mjs
```

测试覆盖动态身份/主体、查询编码、精确金额、JSON/上传、幂等与 revision、错误与字段提示、204、错误响应格式、超时/取消、网络失败、URL 边界和 façade 路径。无需额外安装依赖，测试不访问真实接口；后端权限、数据库幂等、算法准确性和真实文件解析仍需队友联调验证。
