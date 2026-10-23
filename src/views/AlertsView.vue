<script setup>
import { computed, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import { asItems, createIdempotencyIntent, errorText, formatMetric, statusLabel } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const tab = ref('events')
const status = ref('open')
const events = ref([])
const rules = ref([])
const selected = ref(null)
const evidence = ref(null)
const evidenceLoading = ref(false)
const reason = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const actionIntent = createIdempotencyIntent()
const ruleIntent = createIdempotencyIntent()
const ruleForm = ref({ name: '', metricId: '', operator: 'gt', threshold: '', unit: 'ratio', period: 'week', consecutivePeriods: 1, enabled: true })
const enabled = computed(() => props.capabilities.alerts === true)
async function load() {
  if (!enabled.value) return
  loading.value = true; error.value = ''
  try {
    if (tab.value === 'events') events.value = asItems((await props.api.alerts.list({ status: status.value || undefined, limit: 50 })).data)
    else rules.value = asItems((await props.api.alerts.rules({ limit: 50 })).data)
  } catch (cause) { error.value = errorText(cause) }
  finally { loading.value = false }
}
async function openEvent(event) {
  error.value = ''
  try { selected.value = (await props.api.alerts.get(event.id)).data }
  catch (cause) { error.value = errorText(cause) }
}
async function openEvidence(id) {
  if (!id) return
  evidenceLoading.value = true; evidence.value = null; error.value = ''
  try { evidence.value = (await props.api.analytics.evidence(id, { limit: 20 })).data }
  catch (cause) { error.value = errorText(cause) }
  finally { evidenceLoading.value = false }
}
async function act(type) {
  if (!selected.value || saving.value) return
  if (['resolve', 'ignore'].includes(type) && !reason.value.trim()) { error.value = '处理或忽略预警时，请填写原因。'; return }
  saving.value = true; error.value = ''
  try {
    const id = selected.value.id
    const action = { id, type, reason: reason.value.trim(), revision: selected.value.revision }
    const options = { revision: action.revision, idempotencyKey: actionIntent.keyFor(action) }
    const result = type === 'read' ? await props.api.alerts.read(id) : type === 'reopen' ? await props.api.alerts.reopen(id, options) : await props.api.alerts[type](id, { reason: reason.value.trim() }, options)
    actionIntent.clear()
    selected.value = result.data; reason.value = ''; notice.value = '预警状态已更新。'; await load()
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function createRule() {
  if (!ruleForm.value.name.trim() || !ruleForm.value.metricId.trim() || !ruleForm.value.threshold.trim()) { error.value = '规则名称、指标和阈值必填。'; return }
  if (!Number.isFinite(Number(ruleForm.value.threshold))) { error.value = '阈值必须是数字。'; return }
  saving.value = true; error.value = ''
  try {
    const payload = { ...ruleForm.value, consecutivePeriods: Number(ruleForm.value.consecutivePeriods) }
    const result = await props.api.alerts.createRule(payload, { idempotencyKey: ruleIntent.keyFor(payload) })
    ruleIntent.clear()
    notice.value = '规则已提交至服务端。'; ruleForm.value = { name: '', metricId: '', operator: 'gt', threshold: '', unit: 'ratio', period: 'week', consecutivePeriods: 1, enabled: true }; await load()
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
watch([enabled, tab, status], load, { immediate: true })
</script>

<template>
  <div class="section-stack"><header class="page-header"><div><h1 class="page-title">预警提醒</h1><p class="page-description">服务端按规则评估指标；这里查看依据、处理状态和通知结果。</p></div><span class="badge badge--warn">扩展阶段</span></header>
    <div v-if="!enabled" class="phase-note">预警属于说明书扩展阶段。当前经营主体未开通预警服务，阈值不会在浏览器里自动执行，也不会显示“已通知”。</div>
    <template v-else><div class="tab-list" role="tablist" aria-label="预警内容"><button class="tab" type="button" role="tab" :aria-selected="tab === 'events'" @click="tab = 'events'">预警事件</button><button class="tab" type="button" role="tab" :aria-selected="tab === 'rules'" @click="tab = 'rules'">阈值规则</button></div><div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div><div v-if="notice" class="inline-message inline-message--success" role="status">{{ notice }}</div>
      <template v-if="tab === 'events'"><div class="toolbar"><label class="field">状态<select v-model="status" class="field-control"><option value="open">待处理</option><option value="resolved">已处理</option><option value="ignored">已忽略</option><option value="">全部</option></select></label><button type="button" class="button" @click="load">刷新</button></div><UiState v-if="loading" kind="loading" /><UiState v-else-if="!events.length" title="当前筛选下没有预警" /><div v-else class="alert-list"><article v-for="event in events" :key="event.id" class="card alert-card" :data-severity="event.severity"><div class="section-heading"><h3>{{ event.title }}</h3><span class="badge" :class="event.status === 'open' ? 'badge--warn' : 'badge--mint'">{{ statusLabel(event.status) }}</span></div><p>实际值 {{ formatMetric(event.actual) }} · 规则 {{ event.ruleId }}</p><div class="toolbar"><span class="subtle">通知：{{ statusLabel(event.notification?.status || 'not_configured') }}{{ event.notification?.channel ? ` · ${event.notification.channel}` : '' }}</span><button type="button" class="button button--small" @click="openEvent(event)">查看明细</button></div></article></div><section v-if="selected" class="card"><div class="section-heading"><h2>{{ selected.title }}</h2><button type="button" class="button button--small" @click="selected = null">关闭</button></div><dl class="stat-list"><div><dt>实际指标</dt><dd>{{ formatMetric(selected.actual) }}</dd></div><div><dt>严重程度</dt><dd>{{ statusLabel(selected.severity) }}</dd></div><div><dt>处理状态</dt><dd>{{ statusLabel(selected.status) }}</dd></div><div><dt>已读时间</dt><dd>{{ selected.readAt || '未读' }}</dd></div><div><dt>通知状态</dt><dd>{{ statusLabel(selected.notification?.status || 'not_configured') }}</dd></div></dl><div class="toolbar" style="margin-top: 16px"><button v-if="selected.evidenceId" type="button" class="button" @click="openEvidence(selected.evidenceId)">查看分析依据 →</button><button v-if="!selected.readAt" type="button" class="button" :disabled="saving" @click="act('read')">标记已读</button></div><label class="field" style="margin-top: 16px">处理原因<input v-model.trim="reason" class="field-control" placeholder="处理或忽略时必填"></label><div class="form-actions"><button v-if="selected.status === 'open'" type="button" class="button button--primary" :disabled="saving || !reason" @click="act('resolve')">标记已处理</button><button v-if="selected.status === 'open'" type="button" class="button" :disabled="saving || !reason" @click="act('ignore')">忽略</button><button v-if="selected.status !== 'open'" type="button" class="button" :disabled="saving" @click="act('reopen')">重新打开</button></div></section><section v-if="evidenceLoading || evidence" class="card"><h2 class="card-title">预警计算依据</h2><UiState v-if="evidenceLoading" kind="loading" /><template v-else><p class="subtle">快照 {{ evidence.snapshotId }} · 数据版本 {{ evidence.dataVersion }}</p><div v-for="metric in evidence.metrics || []" :key="metric.id" class="evidence-panel">{{ metric.label }}：{{ formatMetric(metric) }}</div><p class="subtle">来源流水 {{ evidence.transactions?.items?.length ?? 0 }} 笔（当前页）</p></template></section></template>
      <template v-if="tab === 'rules'"><section class="card"><h2 class="card-title">新建阈值规则</h2><p class="card-subtitle">指标 ID、分母、单位和持续周期需与队友确认；保存后由服务端执行。</p><div class="field-row"><label class="field">规则名称<input v-model.trim="ruleForm.name" class="field-control"></label><label class="field">指标 ID<input v-model.trim="ruleForm.metricId" class="field-control"></label><label class="field">比较符<select v-model="ruleForm.operator" class="field-control"><option value="gt">大于</option><option value="gte">大于等于</option><option value="lt">小于</option><option value="lte">小于等于</option></select></label><label class="field">阈值<input v-model.trim="ruleForm.threshold" inputmode="decimal" class="field-control" placeholder="比率示例：0.40"></label><label class="field">单位<select v-model="ruleForm.unit" class="field-control"><option value="ratio">比率（0.40 表示 40%）</option><option value="currency_minor">分</option><option value="count">笔数</option></select></label><label class="field">周期<select v-model="ruleForm.period" class="field-control"><option value="day">日</option><option value="week">周</option><option value="month">月</option></select></label><label class="field">连续周期数<input v-model.number="ruleForm.consecutivePeriods" type="number" min="1" class="field-control"></label><label class="field" style="display: flex; align-items: center; gap: 8px"><input v-model="ruleForm.enabled" type="checkbox">创建后启用</label></div><div class="form-actions"><button type="button" class="button button--primary" :disabled="saving" @click="createRule">保存规则</button></div></section><section class="card"><h2 class="card-title">现有规则</h2><UiState v-if="loading" kind="loading" /><UiState v-else-if="!rules.length" title="暂无规则" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>名称</th><th>指标</th><th>条件</th><th>周期</th><th>状态</th></tr></thead><tbody><tr v-for="rule in rules" :key="rule.id"><td>{{ rule.name }}</td><td>{{ rule.metricId }}</td><td>{{ statusLabel(rule.operator) }} {{ rule.threshold }}（{{ statusLabel(rule.unit) }}）</td><td>{{ statusLabel(rule.period) }} × {{ rule.consecutivePeriods }}</td><td>{{ rule.enabled ? '启用' : '停用' }}</td></tr></tbody></table></div></section></template>
    </template>
  </div>
</template>
