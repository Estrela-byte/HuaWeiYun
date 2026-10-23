<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import { asItems, createIdempotencyIntent, errorText, statusLabel, yuanToMinor } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' }, receiptId: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const fileInput = ref(null)
const file = ref(null)
const receipt = ref(null)
const categories = ref([])
const fields = ref({})
const amountYuan = ref('')
const rotation = ref(0)
const action = ref('create')
const linkedTransactionId = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const uploadIntent = createIdempotencyIntent()
const recognizeIntent = createIdempotencyIntent()
const confirmIntent = createIdempotencyIntent()
let timer
const enabled = computed(() => props.capabilities.ocr === true)
const previewUrl = computed(() => {
  const url = receipt.value?.previewUrl
  if (!url) return ''
  try { const parsed = new URL(url, location.href); return ['https:', 'http:', 'blob:'].includes(parsed.protocol) ? parsed.href : '' } catch { return '' }
})
function clearPoll() { if (timer) clearTimeout(timer); timer = undefined }
function adopt(value) {
  receipt.value = value
  fields.value = { businessDate: value.fields?.businessDate || '', direction: value.fields?.direction || 'outflow', kind: value.fields?.kind || 'expense', summary: value.fields?.summary || '', categoryId: value.fields?.categoryId || '' }
  if (value.fields?.amountMinor) {
    const minor = BigInt(value.fields.amountMinor)
    amountYuan.value = `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`
  } else amountYuan.value = ''
}
async function refresh() {
  if (!receipt.value?.id) return
  clearPoll()
  try {
    const result = await props.api.receipts.get(receipt.value.id)
    adopt(result.data)
    if (['queued', 'recognizing', 'committing'].includes(result.data.status)) timer = setTimeout(refresh, 2000)
    if (result.data.status === 'posted') emit('data-changed', result.meta)
  } catch (cause) { error.value = errorText(cause) }
}
async function loadById(id) {
  if (!id || !enabled.value) return
  loading.value = true; error.value = ''
  try { adopt((await props.api.receipts.get(id)).data); if (['queued', 'recognizing', 'committing'].includes(receipt.value.status)) timer = setTimeout(refresh, 2000) }
  catch (cause) { error.value = errorText(cause) }
  finally { loading.value = false }
}
async function loadCategories() {
  try { categories.value = asItems((await props.api.categories.list({ limit: 100 })).data) }
  catch { categories.value = [] }
}
function chooseFile(value) {
  error.value = ''
  if (!value) return
  if (!value.type.startsWith('image/')) { error.value = '请选择图片文件。'; return }
  if (!value.size) { error.value = '文件为空，请重新选择。'; return }
  if (file.value !== value) uploadIntent.clear()
  file.value = value
}
async function upload() {
  if (!file.value || saving.value) return
  saving.value = true; error.value = ''; notice.value = ''
  const form = new FormData(); form.append('file', file.value)
  try {
    const selected = file.value
    const signature = { name: selected.name, size: selected.size, lastModified: selected.lastModified, type: selected.type }
    const result = await props.api.receipts.create(form, { idempotencyKey: uploadIntent.keyFor(signature) })
    uploadIntent.clear()
    adopt(result.data); file.value = null; if (fileInput.value) fileInput.value.value = ''
    if (['queued', 'recognizing'].includes(result.data.status)) timer = setTimeout(refresh, 2000)
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function recognize() {
  if (!receipt.value || saving.value) return
  saving.value = true; error.value = ''
  try {
    const payload = { rotation: rotation.value }
    const intent = { receiptId: receipt.value.id, revision: receipt.value.revision, payload }
    const result = await props.api.receipts.recognize(intent.receiptId, payload, { revision: intent.revision, idempotencyKey: recognizeIntent.keyFor(intent) })
    recognizeIntent.clear()
    adopt(result.data)
    if (['queued', 'recognizing'].includes(result.data.status)) timer = setTimeout(refresh, 2000)
  }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
function transactionInput() {
  const amountMinor = yuanToMinor(amountYuan.value)
  if (!fields.value.businessDate || !fields.value.summary?.trim() || !amountMinor) { error.value = '请填写日期、摘要和大于 0 的金额。'; return null }
  return { ...fields.value, amountMinor, categoryId: fields.value.categoryId || null, currency: 'CNY' }
}
async function saveDraft() {
  const input = transactionInput()
  if (!input || saving.value) return
  saving.value = true; error.value = ''
  try { const result = await props.api.receipts.update(receipt.value.id, { fields: input }, { revision: receipt.value.revision }); adopt(result.data); notice.value = '识别草稿已保存，尚未入账。' }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function confirm() {
  if (!receipt.value || saving.value) return
  const input = action.value === 'create' ? transactionInput() : null
  if (action.value === 'create' && !input) return
  if (action.value === 'link' && !linkedTransactionId.value) { error.value = '请选择要关联的流水。'; return }
  saving.value = true; error.value = ''; notice.value = ''
  try {
    let payload
    if (action.value === 'link') {
      const transaction = (await props.api.transactions.get(linkedTransactionId.value)).data
      payload = { action: 'link', transactionId: transaction.id, transactionRevision: transaction.revision }
    } else payload = { action: 'create', transaction: input }
    const intent = { receiptId: receipt.value.id, revision: receipt.value.revision, payload }
    const result = await props.api.receipts.confirm(intent.receiptId, payload, { revision: intent.revision, idempotencyKey: confirmIntent.keyFor(intent) })
    confirmIntent.clear()
    adopt(result.data)
    if (result.data.status === 'posted') { notice.value = action.value === 'link' ? '票据已关联到现有流水。' : '票据已确认入账。'; emit('data-changed', result.meta) }
    else if (['queued', 'committing'].includes(result.data.status)) timer = setTimeout(refresh, 2000)
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
watch(() => [props.receiptId, enabled.value], ([id, isEnabled]) => { if (isEnabled) { loadCategories(); if (id) loadById(id) } }, { immediate: true })
onUnmounted(clearPoll)
</script>

<template>
  <div class="section-stack"><header class="page-header"><div><h1 class="page-title">票据识别</h1><p class="page-description">拍照或上传小票，修正识别草稿，再明确创建流水或关联已有流水。</p></div><button type="button" class="button" @click="emit('navigate', 'ingestion')">← 返回数据采集</button></header><div class="phase-note">OCR 属于说明书扩展阶段。识别草稿不会自动入账；置信度与重复提示由服务端提供。</div><div v-if="!enabled" class="card"><UiState title="票据识别尚未接入" description="接口能力未开放。已预留图片上传、识别任务、字段修正和入账确认。" /></div><template v-else><div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div><div v-if="notice" class="inline-message inline-message--success" role="status">{{ notice }}</div><div class="import-layout"><section class="card"><h2 class="card-title">小票预览</h2><div class="receipt-preview"><img v-if="previewUrl" :src="previewUrl" alt="已上传票据预览" :style="{ transform: `rotate(${rotation}deg)` }"><div v-else class="receipt-placeholder">{{ receipt ? '服务端未提供预览地址' : '上传票据后在这里查看预览' }}</div></div><div class="toolbar" style="margin-top: 15px"><input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="chooseFile($event.target.files?.[0])"><button type="button" class="button" @click="fileInput?.click()">选择图片</button><button type="button" class="button button--primary" :disabled="!file || saving" @click="upload">上传票据</button><button type="button" class="button" :disabled="!receipt" @click="rotation = (rotation + 90) % 360">旋转预览</button></div><p v-if="file" class="subtle">待上传：{{ file.name }}</p><p v-if="receipt" class="subtle">状态：{{ statusLabel(receipt.status) }} · ID：{{ receipt.id }}</p><button v-if="receipt && ['queued', 'failed', 'review'].includes(receipt.status)" type="button" class="button" :disabled="saving" @click="recognize">{{ receipt.status === 'review' ? '重新识别' : '开始识别' }}</button></section><section class="card"><h2 class="card-title">识别结果与修正</h2><UiState v-if="loading" kind="loading" /><UiState v-else-if="!receipt" title="尚未上传票据" /><UiState v-else-if="['queued', 'recognizing'].includes(receipt.status)" kind="loading" title="正在识别" description="请等待服务端任务完成。" /><template v-else><div v-if="receipt.suspectedTransactionIds?.length" class="inline-message inline-message--warn">发现 {{ receipt.suspectedTransactionIds.length }} 笔可能对应的现有流水；请核对后决定关联或新建。</div><div class="field-row"><label class="field">日期 <small class="subtle">{{ receipt.fieldConfidence?.businessDate == null ? '置信度未知' : `置信度 ${(receipt.fieldConfidence.businessDate * 100).toFixed(0)}%` }}</small><input v-model="fields.businessDate" class="field-control" type="date"></label><label class="field">金额（元） <small class="subtle">{{ receipt.fieldConfidence?.amountMinor == null ? '置信度未知' : `置信度 ${(receipt.fieldConfidence.amountMinor * 100).toFixed(0)}%` }}</small><input v-model="amountYuan" class="field-control" inputmode="decimal"></label><label class="field">收支<select v-model="fields.direction" class="field-control"><option value="inflow">收入</option><option value="outflow">支出</option></select></label><label class="field">类型<select v-model="fields.kind" class="field-control"><option value="sale">销售</option><option value="expense">费用</option><option value="refund">退款</option><option value="other">其他</option></select></label><label class="field">分类<select v-model="fields.categoryId" class="field-control"><option value="">暂不分类</option><option v-for="category in categories.filter(item => !item.archived && item.direction === fields.direction)" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label class="field">摘要<input v-model.trim="fields.summary" class="field-control"></label></div><div class="form-actions"><button type="button" class="button" :disabled="saving || receipt.status === 'posted'" @click="saveDraft">保存草稿</button></div><div v-if="receipt.status !== 'posted'" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border)"><h3 class="card-title">确认去向</h3><div class="toolbar"><label><input v-model="action" type="radio" value="create"> 创建新流水</label><label v-if="receipt.suspectedTransactionIds?.length"><input v-model="action" type="radio" value="link"> 关联已有流水</label></div><label v-if="action === 'link'" class="field" style="margin-top: 12px">选择已有流水<select v-model="linkedTransactionId" class="field-control"><option value="">请选择</option><option v-for="id in receipt.suspectedTransactionIds" :key="id" :value="id">{{ id }}</option></select></label><div class="form-actions"><button type="button" class="button button--primary" :disabled="saving" @click="confirm">{{ action === 'link' ? '确认关联' : '确认入账' }}</button></div></div><div v-else class="inline-message inline-message--success">{{ receipt.transactionId ? `已关联流水 ${receipt.transactionId}` : '服务端已标记完成' }}</div></template></section></div></template></div>
</template>
