<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import { useCursorPage } from '../composables/useCursorPage.js'
import { asItems, errorText, formatAmountMinor, isPendingJob, newIdempotencyKey, retainReadySelection, statusLabel, yuanToMinor } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const fileInput = ref(null)
const selectedFile = ref(null)
const platform = ref('wechat')
const dragging = ref(false)
const historyPager = useCursorPage(query => props.api.imports.list(query), 8)
const history = historyPager.items
const categories = ref([])
const batch = ref(null)
const rows = ref([])
const rowCursor = ref(null)
const rowNextCursor = ref(null)
const rowCursorStack = ref([])
const selectedIds = ref([])
const editRow = ref(null)
const editDraft = ref({})
const editAmount = ref('')
const mapping = ref({})
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const job = ref(null)
const uploadIntent = ref({ signature: '', key: '' })
const commitIntent = ref({ signature: '', key: '' })
let timer
let controller
const formats = computed(() => Array.isArray(props.capabilities?.supportedImportFormats) ? props.capabilities.supportedImportFormats : ['csv'])
const accept = computed(() => formats.value.map(ext => `.${ext.replace(/^\./, '')}`).join(','))
const active = computed(() => !!batch.value && isPendingJob(batch.value.status))
const canUpload = computed(() => props.capabilities.billImport !== false && formats.value.length > 0)
const readyRows = computed(() => rows.value.filter(row => row.status === 'ready'))
const counts = computed(() => batch.value?.counts || {})

function setFile(file) {
  error.value = ''
  notice.value = ''
  if (!file) return
  if (!canUpload.value) { error.value = '当前经营主体尚未开放账单文件导入。'; return }
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!formats.value.includes(extension)) { error.value = `当前仅支持 ${formats.value.join('、').toUpperCase()} 文件。`; return }
  if (file.size === 0) { error.value = '文件为空，请重新选择。'; return }
  selectedFile.value = file
}
function drop(event) { dragging.value = false; setFile(event.dataTransfer.files?.[0]) }
function clearPoll() { if (timer) clearTimeout(timer); timer = undefined }
async function loadHistory(findId = null) {
  try {
    if (findId) await historyPager.find(item => item.id === findId)
    else await historyPager.reload()
  }
  catch (cause) { if (!batch.value) error.value = errorText(cause) }
}
async function changeHistoryPage(direction) {
  try { await historyPager[direction]() }
  catch (cause) { error.value = errorText(cause) }
}
async function loadCategories() {
  try { categories.value = asItems((await props.api.categories.list({ limit: 100 })).data) }
  catch { categories.value = [] }
}
async function loadRows() {
  if (!batch.value?.id) return
  const importId = batch.value.id
  const cursor = rowCursor.value
  const result = await props.api.imports.rows(importId, { limit: 100, cursor: cursor || undefined })
  if (batch.value?.id !== importId || rowCursor.value !== cursor) return
  rows.value = asItems(result.data)
  rowNextCursor.value = result.data?.nextCursor || null
  selectedIds.value = retainReadySelection(selectedIds.value, rows.value)
}
function resetRowPage() { rowCursor.value = null; rowNextCursor.value = null; rowCursorStack.value = []; selectedIds.value = []; rows.value = [] }
async function nextRowPage() {
  if (!rowNextCursor.value) return
  const previousCursor = rowCursor.value
  const previousSelection = [...selectedIds.value]
  rowCursorStack.value.push(rowCursor.value)
  rowCursor.value = rowNextCursor.value
  selectedIds.value = []
  try { await loadRows() }
  catch (cause) { rowCursor.value = previousCursor; rowCursorStack.value.pop(); selectedIds.value = previousSelection; error.value = errorText(cause) }
}
async function previousRowPage() {
  if (!rowCursorStack.value.length) return
  const previousCursor = rowCursor.value
  const previousSelection = [...selectedIds.value]
  const targetCursor = rowCursorStack.value.pop()
  rowCursor.value = targetCursor
  selectedIds.value = []
  try { await loadRows() }
  catch (cause) { rowCursor.value = previousCursor; rowCursorStack.value.push(targetCursor); selectedIds.value = previousSelection; error.value = errorText(cause) }
}
async function refreshBatch() {
  if (!batch.value?.id) return
  clearPoll()
  try {
    const importId = batch.value.id
    const result = await props.api.imports.get(importId)
    if (batch.value?.id !== importId) return
    batch.value = result.data
    if (batch.value.status === 'review' || batch.value.status === 'completed') await loadRows()
    if (active.value) timer = setTimeout(refreshBatch, 2000)
    if (batch.value.status === 'completed') { emit('data-changed', result.meta); await loadHistory() }
  } catch (cause) { error.value = errorText(cause) }
}
async function upload() {
  if (!selectedFile.value || submitting.value) return
  submitting.value = true; error.value = ''; notice.value = ''
  const form = new FormData()
  form.append('file', selectedFile.value)
  form.append('platform', platform.value)
  const signature = `${selectedFile.value.name}:${selectedFile.value.size}:${selectedFile.value.lastModified}:${platform.value}`
  if (uploadIntent.value.signature !== signature) uploadIntent.value = { signature, key: newIdempotencyKey() }
  try {
    const result = await props.api.imports.create(form, { idempotencyKey: uploadIntent.value.key })
    batch.value = result.data
    resetRowPage()
    uploadIntent.value = { signature: '', key: '' }
    selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    await loadHistory(batch.value.id)
    await refreshBatch()
  } catch (cause) { error.value = errorText(cause) }
  finally { submitting.value = false }
}
async function openBatch(item) { clearPoll(); batch.value = item; resetRowPage(); editRow.value = null; job.value = null; mapping.value = {}; error.value = ''; await refreshBatch() }
function startEdit(row) {
  if (row.status === 'posted') return
  editRow.value = row
  editDraft.value = {
    businessDate: row.draft?.businessDate || '',
    direction: row.draft?.direction || 'outflow',
    kind: row.draft?.kind || 'other',
    summary: row.draft?.summary || '',
    categoryId: row.draft?.categoryId || '',
    originalTransactionId: row.draft?.originalTransactionId || '',
  }
  editAmount.value = row.draft?.amountMinor ? `${BigInt(row.draft.amountMinor) / 100n}.${String(BigInt(row.draft.amountMinor) % 100n).padStart(2, '0')}` : ''
}
async function saveRow() {
  if (!editRow.value || editRow.value.status === 'posted') return
  const amountMinor = yuanToMinor(editAmount.value)
  if (!amountMinor) { error.value = '金额必须大于 0，最多保留两位小数。'; return }
  if (editDraft.value.kind === 'refund' && !editDraft.value.originalTransactionId) { error.value = '退款必须填写已入账的原流水 ID。'; return }
  submitting.value = true; error.value = ''
  try {
    await props.api.imports.updateRow(batch.value.id, editRow.value.id, {
      draft: { ...editDraft.value, originalTransactionId: editDraft.value.originalTransactionId || undefined, amountMinor, currency: 'CNY' },
      categoryConfirmed: Boolean(editDraft.value.categoryId),
      kindConfirmed: true,
    }, { revision: editRow.value.revision })
    editRow.value = null
    // A row edit can also advance the batch revision required by commit.
    await refreshBatch()
  } catch (cause) { error.value = errorText(cause) }
  finally { submitting.value = false }
}
async function saveMapping() {
  if (!batch.value) return
  submitting.value = true; error.value = ''
  try {
    const result = await props.api.imports.mapFields(batch.value.id, { columns: mapping.value }, { revision: batch.value.revision })
    batch.value = result.data
    await refreshBatch()
  } catch (cause) { error.value = errorText(cause) }
  finally { submitting.value = false }
}
async function pollJob() {
  if (!job.value?.id) return
  clearPoll()
  try {
    const result = await props.api.jobs.get(job.value.id)
    job.value = result.data
    if (isPendingJob(job.value.status)) timer = setTimeout(pollJob, job.value.retryAfterMs || 2000)
    else {
      await refreshBatch()
      if (job.value.status === 'succeeded') {
        notice.value = `入账任务已完成。成功 ${job.value.result?.postedTransactionIds?.length ?? '—'} 笔，失败 ${job.value.result?.failedRowIds?.length ?? '—'} 笔。`
        if (job.value.result?.postedTransactionIds?.length) emit('data-changed', result.meta)
      }
      if (job.value.status === 'failed') error.value = job.value.error?.message || '入账任务失败。'
    }
  } catch (cause) { error.value = errorText(cause) }
}
async function commit() {
  if (!batch.value || !selectedIds.value.length || submitting.value) return
  submitting.value = true; error.value = ''; notice.value = ''
  const chosen = rows.value.filter(row => selectedIds.value.includes(row.id) && row.status === 'ready').map(row => ({ id: row.id, revision: row.revision }))
  if (!chosen.length) { submitting.value = false; return }
  const signature = JSON.stringify({ batchId: batch.value.id, revision: batch.value.revision, rows: chosen })
  if (commitIntent.value.signature !== signature) commitIntent.value = { signature, key: newIdempotencyKey() }
  try {
    const result = await props.api.imports.commit(batch.value.id, { rows: chosen }, { revision: batch.value.revision, idempotencyKey: commitIntent.value.key })
    job.value = result.data
    commitIntent.value = { signature: '', key: '' }
    if (job.value?.id) await pollJob()
    else error.value = '服务端未返回任务编号，请查询批次状态后再操作。'
  } catch (cause) { error.value = errorText(cause) }
  finally { submitting.value = false }
}
watch(() => props.capabilities.billImport, value => { if (value !== false) { loadHistory(); loadCategories() } }, { immediate: true })
onUnmounted(() => { clearPoll(); historyPager.reset(); controller?.abort() })
</script>

<template>
  <div class="section-stack">
    <header class="page-header"><div><h1 class="page-title">数据采集</h1><p class="page-description">导入账单文件，逐行核对后确认入账。</p></div><button class="button" type="button" @click="emit('navigate', 'receipt')">票据识别 <span class="badge badge--warn">扩展</span></button></header>
    <div v-if="!canUpload" class="phase-note">当前经营主体尚未开通账单导入接口。页面已预留上传、解析、预览与确认流程。</div>
    <div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div>
    <div v-if="notice" class="inline-message inline-message--success" role="status">{{ notice }}</div>
    <div class="import-layout">
      <section class="card"><h2 class="card-title">导入微信或支付宝导出文件</h2><p class="card-subtitle">支持格式以服务端能力声明为准；{{ formats.length ? `目前显示 ${formats.join('、').toUpperCase()}` : '当前未开放可用格式' }}。</p>
        <div class="dropzone" :data-dragging="dragging" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="drop"><div class="dropzone__icon" aria-hidden="true">⇧</div><strong>{{ selectedFile?.name || '选择账单文件，或拖到这里' }}</strong><p v-if="selectedFile">{{ (selectedFile.size / 1024).toFixed(1) }} KB · 上传后会先解析并进入预览</p><p v-else>仅从支付平台导出账单文件；不会在选中后自动入账。</p><input ref="fileInput" class="visually-hidden" type="file" :accept="accept" :disabled="!canUpload || submitting" @change="setFile($event.target.files?.[0])"><button class="button" type="button" :disabled="!canUpload || submitting" @click="fileInput?.click()">选择文件</button></div>
        <div class="field-row" style="margin-top: 16px"><label class="field">账单来源<select v-model="platform" class="field-control" :disabled="submitting"><option value="wechat">微信支付</option><option value="alipay">支付宝</option></select></label><div class="field"><span>处理方式</span><span class="field-control" style="border-color: transparent; padding-left: 0">上传 → 解析 → 核对 → 确认</span></div></div>
        <div class="form-actions"><button class="button button--primary" type="button" :disabled="!selectedFile || !canUpload || submitting" @click="upload">{{ submitting ? '提交中…' : '上传并预览' }}</button></div>
      </section>
      <section class="card"><h2 class="card-title">导入结果</h2><UiState v-if="!batch" title="还没有选中批次" description="上传后可查看解析阶段、行数和需要核对的内容。" /><template v-else><p class="muted" style="margin-top: 0">{{ batch.filename }} <span class="badge">{{ statusLabel(batch.status) }}</span></p><ol class="step-list"><li v-for="step in ['上传', '解析', '核对', '入账']" :key="step" :aria-current="(batch.status === 'review' && step === '核对') || (batch.status === 'completed' && step === '入账') ? 'step' : undefined">{{ step }}</li></ol><dl class="stat-list" style="margin-top: 20px"><div><dt>原始行</dt><dd>{{ counts.total ?? '—' }}</dd></div><div><dt>可确认</dt><dd>{{ counts.ready ?? '—' }}</dd></div><div><dt>待人工处理</dt><dd>{{ counts.needsReview ?? '—' }}</dd></div><div><dt>重复 / 无效</dt><dd>{{ counts.duplicate ?? '—' }} / {{ counts.invalid ?? '—' }}</dd></div><div><dt>已入账</dt><dd>{{ counts.posted ?? '—' }}</dd></div></dl><p v-if="active" class="inline-message">服务端正在{{ batch.status === 'committing' ? '入账' : '解析' }}。{{ batch.progress == null ? '当前阶段暂无可计量进度。' : `进度 ${batch.progress}%` }}</p><p v-if="job" class="subtle">入账任务：{{ statusLabel(job.status) }}{{ job.progress == null ? '' : ` · ${job.progress}%` }}</p></template></section>
    </div>
    <section v-if="batch?.detectedColumns?.length" class="card">
      <h2>字段映射</h2>
      <p class="card-subtitle">识别失败时，请将源文件列映射到标准字段后重新解析。</p>
      <div class="field-row">
        <label v-for="column in batch.detectedColumns" :key="column" class="field">{{ column }}
          <select v-model="mapping[column]" class="field-control">
            <option value="">忽略此列</option>
            <option value="businessDate">日期</option>
            <option value="summary">摘要</option>
            <option value="amountMinor">金额</option>
            <option value="direction">收支方向</option>
            <option value="kind">业务类型</option>
            <option value="categoryId">分类</option>
            <option value="originalTransactionId">原流水 ID</option>
            <option value="originalSourceTransactionId">原交易单号</option>
          </select>
        </label>
      </div>
      <div class="form-actions"><button type="button" class="button button--primary" :disabled="submitting" @click="saveMapping">保存映射并重新解析</button></div>
    </section>
    <section v-if="batch?.status === 'review' || rows.length" class="card">
      <div class="section-heading"><h2>逐行预览与确认</h2><span class="subtle">每页最多 100 行；仅提交本页明确勾选的可确认行</span></div>
      <UiState v-if="!rows.length" title="预览暂无行" description="解析结束后刷新批次查看。" retry @retry="refreshBatch" />
      <template v-else>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>选择</th><th>行号</th><th>日期</th><th>摘要</th><th>业务类型</th><th>分类</th><th class="numeric">金额</th><th>状态</th><th class="actions">操作</th></tr></thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td><input v-model="selectedIds" type="checkbox" :value="row.id" :disabled="row.status !== 'ready'" :aria-label="'选择第 ' + row.rowNumber + ' 行'"></td>
                <td>{{ row.rowNumber }}</td><td>{{ row.draft?.businessDate || '—' }}</td><td>{{ row.draft?.summary || '—' }}</td>
                <td>{{ statusLabel(row.draft?.kind) }}</td><td>{{ categories.find(item => item.id === row.draft?.categoryId)?.name || row.draft?.categoryId || '待分类' }}</td>
                <td class="numeric">{{ formatAmountMinor(row.draft?.amountMinor) }}</td>
                <td><span class="badge" :class="row.status === 'ready' ? 'badge--mint' : 'badge--warn'">{{ statusLabel(row.status) }}</span><small v-if="row.reviewReasons?.length" class="subtle">{{ row.reviewReasons.join('；') }}</small></td>
                <td class="actions"><button class="button button--small" type="button" :disabled="row.status === 'posted'" @click="startEdit(row)">修正</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span>本页 {{ rows.length }} 行，可确认 {{ readyRows.length }} 行，已勾选 {{ selectedIds.length }} 行；刷新不会重新勾选</span>
          <div class="toolbar">
            <button class="button button--small" type="button" :disabled="!rowCursorStack.length || submitting" @click="previousRowPage">上一页</button>
            <button class="button button--small" type="button" :disabled="!rowNextCursor || submitting" @click="nextRowPage">下一页</button>
            <button class="button button--primary" type="button" :disabled="!selectedIds.length || submitting || batch.status !== 'review'" @click="commit">确认本页选中行入账</button>
          </div>
        </div>
      </template>
    </section>
    <section v-if="editRow" class="card">
      <div class="section-heading"><h2>修正第 {{ editRow.rowNumber }} 行</h2><button type="button" class="button button--small" @click="editRow = null">关闭</button></div>
      <p v-if="editRow.reviewReasons?.length" class="inline-message inline-message--warn">{{ editRow.reviewReasons.join('；') }}</p>
      <div class="field-row">
        <label class="field">日期<input v-model="editDraft.businessDate" type="date" class="field-control"></label>
        <label class="field">金额（元）<input v-model="editAmount" inputmode="decimal" class="field-control"></label>
        <label class="field">方向<select v-model="editDraft.direction" class="field-control"><option value="inflow">收入</option><option value="outflow">支出</option></select></label>
        <label class="field">业务类型<select v-model="editDraft.kind" class="field-control">
          <option value="sale">销售</option><option value="expense">经营支出</option><option value="refund">退款</option>
          <option value="transfer">转账</option><option value="settlement">结算</option><option value="loan">借款</option>
          <option value="owner_contribution">业主投入</option><option value="other">其他</option>
        </select></label>
        <label class="field">分类<select v-model="editDraft.categoryId" class="field-control"><option value="">暂不分类</option><option v-for="category in categories.filter(item => !item.archived && (editDraft.kind === 'refund' || item.direction === editDraft.direction))" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
        <label v-if="editDraft.kind === 'refund'" class="field">原流水 ID<input v-model.trim="editDraft.originalTransactionId" class="field-control" placeholder="填写对应已入账销售或支出流水 ID"></label>
      </div>
      <label class="field" style="margin-top: 12px">摘要<input v-model.trim="editDraft.summary" class="field-control"></label>
      <p v-if="editDraft.kind === 'refund'" class="subtle">退款须关联原交易；服务端会核对方向与累计退款金额。</p>
      <div class="form-actions"><button class="button button--primary" type="button" :disabled="submitting" @click="saveRow">保存修正</button></div>
    </section>
    <section class="card"><div class="section-heading"><h2>导入历史</h2><button type="button" class="button button--small" @click="loadHistory()">刷新</button></div><UiState v-if="!history.length && !historyPager.loading.value" title="暂无导入记录" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>文件</th><th>平台</th><th>状态</th><th>创建时间</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="item in history" :key="item.id"><td>{{ item.filename }}</td><td>{{ item.platform === 'wechat' ? '微信支付' : '支付宝' }}</td><td>{{ statusLabel(item.status) }}</td><td>{{ item.createdAt || '—' }}</td><td class="actions"><button class="button button--small" type="button" @click="openBatch(item)">查看</button></td></tr></tbody></table></div><div class="table-footer"><span>第 {{ historyPager.previousCursors.value.length + 1 }} 页</span><div class="toolbar"><button type="button" class="button button--small" :disabled="!historyPager.previousCursors.value.length || historyPager.loading.value" @click="changeHistoryPage('previous')">上一页</button><button type="button" class="button button--small" :disabled="!historyPager.nextCursor.value || historyPager.loading.value" @click="changeHistoryPage('next')">下一页</button></div></div></section>
  </div>
</template>
