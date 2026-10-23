<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import { asItems, createIdempotencyIntent, errorText, statusLabel } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const profile = ref(null)
const form = ref({ name: '', industry: '', currency: 'CNY', timezone: 'Asia/Shanghai' })
const members = ref([])
const backups = ref([])
const exportTask = ref(null)
const exportRequest = ref(null)
const downloadGrant = ref(null)
const exportFormat = ref('xlsx')
const exportScope = ref('transactions')
const invitation = ref({ contact: '', role: 'accountant' })
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const invitationIntent = createIdempotencyIntent()
const backupIntent = createIdempotencyIntent()
const exportIntent = createIdempotencyIntent()
let timer
const canMembers = computed(() => props.capabilities.memberManagement === true)
const canBackup = computed(() => props.capabilities.backup === true)
const canExport = computed(() => props.capabilities.export === true)
const exportFormats = computed(() => props.capabilities.supportedExportFormats?.length ? props.capabilities.supportedExportFormats : [])
function clearPoll() { if (timer) clearTimeout(timer); timer = undefined }
async function load() {
  loading.value = true; error.value = ''
  const requests = [props.api.business.getProfile()]
  if (canMembers.value) requests.push(props.api.members.list({ limit: 30 }))
  if (canBackup.value) requests.push(props.api.backups.list({ limit: 10 }))
  const results = await Promise.allSettled(requests)
  if (results[0].status === 'fulfilled') { profile.value = results[0].value.data; form.value = { name: profile.value.name || '', industry: profile.value.industry || '', currency: profile.value.currency || 'CNY', timezone: profile.value.timezone || 'Asia/Shanghai' } }
  else error.value = errorText(results[0].reason)
  let index = 1
  if (canMembers.value) { const outcome = results[index++]; members.value = outcome.status === 'fulfilled' ? asItems(outcome.value.data) : []; if (outcome.status === 'rejected') error.value = errorText(outcome.reason) }
  if (canBackup.value) { const outcome = results[index]; backups.value = outcome.status === 'fulfilled' ? asItems(outcome.value.data) : []; if (outcome.status === 'rejected') error.value = errorText(outcome.reason) }
  loading.value = false
}
async function saveProfile() {
  if (!profile.value || !form.value.name.trim() || saving.value) return
  saving.value = true; error.value = ''
  try { const result = await props.api.business.updateProfile(form.value, { revision: profile.value.revision }); profile.value = result.data; notice.value = '经营主体资料已更新。'; emit('data-changed', result.meta) }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function invite() {
  if (!invitation.value.contact.trim() || saving.value) return
  saving.value = true; error.value = ''
  try {
    const payload = { ...invitation.value }
    await props.api.members.invite(payload, { idempotencyKey: invitationIntent.keyFor(payload) })
    invitationIntent.clear()
    notice.value = '邀请已提交，实际送达状态以服务端为准。'; invitation.value.contact = ''
    members.value = asItems((await props.api.members.list({ limit: 30 })).data)
  }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function createBackup() {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    const payload = {}
    const result = await props.api.backups.create(payload, { idempotencyKey: backupIntent.keyFor(payload) })
    backupIntent.clear()
    notice.value = `备份任务已创建，状态：${statusLabel(result.data?.status)}。完成状态以服务端任务为准。`
    backups.value = asItems((await props.api.backups.list({ limit: 10 })).data)
  }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function pollExport() {
  if (!exportTask.value?.id) return
  clearPoll()
  try {
    exportTask.value = (await props.api.exports.get(exportTask.value.id)).data
    if (['queued', 'running'].includes(exportTask.value.status)) timer = setTimeout(pollExport, 2000)
    else if (exportTask.value.status === 'succeeded') {
      const result = await props.api.exports.getDownload(exportTask.value.id)
      const url = result.data?.url
      if (url && ['https:', 'http:'].includes(new URL(url, location.href).protocol)) downloadGrant.value = result.data
      else error.value = '服务端未返回有效的下载地址。'
    } else if (exportTask.value.status === 'failed') error.value = exportTask.value.error?.message || '导出任务失败。'
  } catch (cause) { error.value = errorText(cause) }
}
async function createExport() {
  if (!exportFormats.value.includes(exportFormat.value) || saving.value) return
  saving.value = true; error.value = ''
  try {
    const payload = { format: exportFormat.value, scope: exportScope.value, query: { ...props.query } }
    if (exportTask.value?.id && !downloadGrant.value && JSON.stringify(exportRequest.value) === JSON.stringify(payload) && ['queued', 'running', 'succeeded'].includes(exportTask.value.status)) {
      await pollExport()
      return
    }
    const result = await props.api.exports.create(payload, { idempotencyKey: exportIntent.keyFor(payload) })
    exportIntent.clear()
    exportTask.value = result.data; exportRequest.value = payload; downloadGrant.value = null
    await pollExport()
  }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
watch(() => [canMembers.value, canBackup.value], load, { immediate: true })
onUnmounted(clearPoll)
</script>

<template>
  <div class="section-stack"><header class="page-header"><div><h1 class="page-title">系统管理</h1><p class="page-description">经营主体资料，以及后续开放的成员、备份与导出能力。</p></div><span class="badge badge--warn">高级管理按能力开放</span></header><div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div><div v-if="notice" class="inline-message inline-message--success" role="status">{{ notice }}</div>
    <section class="card"><div class="section-heading"><h2>经营主体资料</h2><button type="button" class="button button--small" @click="load">刷新</button></div><UiState v-if="loading && !profile" kind="loading" /><UiState v-else-if="!profile" title="资料尚未接入" description="请先完成经营主体初始化。" /><form v-else @submit.prevent="saveProfile"><div class="field-row"><label class="field">名称<input v-model.trim="form.name" class="field-control" required></label><label class="field">行业<input v-model.trim="form.industry" class="field-control"></label><label class="field">币种<input v-model="form.currency" class="field-control" disabled></label><label class="field">时区<input v-model="form.timezone" class="field-control" disabled></label></div><p class="subtle">主体 ID：{{ profile.id }} · 版本：{{ profile.revision }}</p><div class="form-actions"><button type="submit" class="button button--primary" :disabled="saving">保存资料</button></div></form></section>
    <div class="settings-grid"><section class="card"><h2 class="card-title">账号与权限</h2><div v-if="!canMembers" class="phase-note">成员与角色管理是扩展阶段；当前未开放接口。</div><template v-else><UiState v-if="loading" kind="loading" /><UiState v-else-if="!members.length" title="暂无成员记录" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>成员</th><th>角色</th><th>状态</th></tr></thead><tbody><tr v-for="item in members" :key="item.id"><td>{{ item.displayName }}</td><td>{{ statusLabel(item.role) }}</td><td>{{ item.active ? '启用' : '停用' }}</td></tr></tbody></table></div><form class="field-row" style="margin-top: 18px" @submit.prevent="invite"><label class="field">邀请联系信息<input v-model.trim="invitation.contact" class="field-control" required></label><label class="field">角色<select v-model="invitation.role" class="field-control"><option value="accountant">会计</option><option value="clerk">店员</option></select></label><div class="form-actions"><button type="submit" class="button button--primary" :disabled="saving">邀请成员</button></div></form></template></section>
      <section class="card"><h2 class="card-title">数据备份</h2><div v-if="!canBackup" class="phase-note">备份任务是扩展阶段；没有服务端能力时不能显示“已备份”。</div><template v-else><p class="muted">备份需等待服务端任务完成；恢复能力由队友单独验收。</p><button type="button" class="button button--primary" :disabled="saving" @click="createBackup">创建备份任务</button><UiState v-if="!backups.length" title="暂无备份任务" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>创建时间</th><th>状态</th><th>可恢复</th></tr></thead><tbody><tr v-for="item in backups" :key="item.id"><td>{{ item.createdAt }}</td><td>{{ statusLabel(item.status) }}</td><td>{{ item.restorable ? '服务端标记可恢复' : '未确认' }}</td></tr></tbody></table></div></template></section></div>
    <section class="card"><h2 class="card-title">数据导出</h2><div v-if="!canExport" class="phase-note">导出属于扩展阶段；当前未开放接口。</div><template v-else><div v-if="!exportFormats.length" class="phase-note">服务端没有声明可用导出格式。</div><div v-else class="toolbar"><label class="field">范围<select v-model="exportScope" class="field-control"><option value="transactions">流水</option><option value="analytics">经营分析</option></select></label><label class="field">格式<select v-model="exportFormat" class="field-control"><option v-for="format in exportFormats" :key="format" :value="format">{{ format.toUpperCase() }}</option></select></label><button type="button" class="button button--primary" style="align-self: end" :disabled="saving || !exportFormats.includes(exportFormat)" @click="createExport">创建导出任务</button></div><div v-if="exportTask" class="inline-message">导出任务状态：{{ statusLabel(exportTask.status) }}</div><a v-if="downloadGrant" class="button" :href="downloadGrant.url" target="_blank" rel="noopener noreferrer">下载 {{ downloadGrant.filename }}</a></template></section>
    <div class="phase-note">操作审计、数据删除预览与恢复流程已在接口层预留；启用前须和队友确认权限、任务状态及受影响范围。</div>
  </div>
</template>
