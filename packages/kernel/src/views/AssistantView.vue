<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import { useCursorPage } from '../composables/useCursorPage.js'
import { createIdempotencyIntent, errorText, formatMetric, newIdempotencyKey, statusLabel } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const conversationsPager = useCursorPage(query => props.api.assistant.conversations(query), 20)
const conversations = conversationsPager.items
const current = ref(null)
const messagesPager = useCursorPage(query => props.api.assistant.messages(current.value.id, query), 50)
const messages = messagesPager.items
const composer = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const evidence = ref(null)
const evidenceLoading = ref(false)
const failedSubmission = ref(null)
const activeMessage = ref(null)
const conversationIntent = createIdempotencyIntent()
const cancelIntent = createIdempotencyIntent()
let pollTimer
let disposed = false
const canAsk = computed(() => props.capabilities.assistant !== false)
const pending = computed(() => activeMessage.value && ['queued', 'querying', 'calculating', 'generating'].includes(activeMessage.value.status))
const suggestions = ['这个月的收支结余为什么变化？', '哪些成本项目变化最大？', '本月收入与上期相比如何？']

function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = undefined }
async function loadConversations() {
  if (!canAsk.value) return
  loading.value = true; error.value = ''
  try {
    await conversationsPager.reload()
    if (!current.value && conversations.value.length) current.value = conversations.value[0]
    if (current.value) await loadMessages()
  } catch (cause) { error.value = errorText(cause) }
  finally { loading.value = false }
}
async function loadMessages(firstPage = false) {
  if (!current.value) { messagesPager.reset(); return }
  try { await (firstPage ? messagesPager.first() : messagesPager.reload()) }
  catch (cause) { error.value = errorText(cause) }
}
async function changeConversationPage(direction) {
  try { await conversationsPager[direction]() }
  catch (cause) { error.value = errorText(cause) }
}
async function changeMessagePage(direction) {
  try { await messagesPager[direction]() }
  catch (cause) { error.value = errorText(cause) }
}
async function selectConversation(conversation) { stopPolling(); activeMessage.value = null; current.value = conversation; evidence.value = null; messagesPager.reset(); await loadMessages(true) }
async function createConversation(query = props.query) {
  const payload = { query: { ...query } }
  const result = await props.api.assistant.createConversation(payload, { idempotencyKey: conversationIntent.keyFor(payload) })
  conversationIntent.clear()
  stopPolling()
  activeMessage.value = null
  evidence.value = null
  current.value = result.data
  messagesPager.reset()
  return result.data
}
async function newConversation() {
  if (sending.value) return
  error.value = ''
  try { await createConversation() }
  catch (cause) { error.value = errorText(cause) }
}
async function pollMessage(conversationId, messageId) {
  stopPolling()
  try {
    const result = await props.api.assistant.getMessage(conversationId, messageId)
    if (disposed || current.value?.id !== conversationId) return
    activeMessage.value = result.data
    const index = messages.value.findIndex(item => item.id === messageId)
    if (index >= 0) messages.value[index] = result.data
    if (['queued', 'querying', 'calculating', 'generating'].includes(result.data.status)) pollTimer = setTimeout(() => pollMessage(conversationId, messageId), 1800)
    else {
      const found = await messagesPager.find(item => item.id === messageId, { refresh: true })
      if (!found && current.value?.id === conversationId) messages.value.push(result.data)
    }
  } catch (cause) { error.value = errorText(cause) }
}
async function submit(retry = false) {
  if (!canAsk.value || sending.value || pending.value) return
  const attempt = retry ? failedSubmission.value : {
    payload: { text: composer.value.trim(), query: { ...props.query } },
    key: newIdempotencyKey(), conversationId: current.value?.id ?? null, conversation: current.value,
  }
  if (!attempt?.payload.text) return
  sending.value = true; error.value = ''
  try {
    if (retry && attempt.conversationId && current.value?.id !== attempt.conversationId) {
      await selectConversation(attempt.conversation)
    }
    if (!attempt.conversationId) {
      attempt.conversation = await createConversation(attempt.payload.query)
      attempt.conversationId = attempt.conversation.id
    }
    const result = await props.api.assistant.sendMessage(attempt.conversationId, attempt.payload, { idempotencyKey: attempt.key })
    composer.value = ''
    failedSubmission.value = null
    if (current.value?.id === attempt.conversationId) {
      activeMessage.value = result.data
      if (result.data?.id) {
        const found = await messagesPager.find(item => item.id === result.data.id, { refresh: true })
        if (!found && current.value?.id === attempt.conversationId) messages.value.push(result.data)
      }
      if (result.data?.id && ['queued', 'querying', 'calculating', 'generating'].includes(result.data.status)) await pollMessage(attempt.conversationId, result.data.id)
    }
  } catch (cause) { error.value = errorText(cause); failedSubmission.value = attempt }
  finally { sending.value = false }
}
async function cancel() {
  if (!current.value || !activeMessage.value || !pending.value) return
  try {
    const intent = { conversationId: current.value.id, messageId: activeMessage.value.id }
    const result = await props.api.assistant.cancelMessage(intent.conversationId, intent.messageId, { idempotencyKey: cancelIntent.keyFor(intent) })
    cancelIntent.clear()
    stopPolling(); activeMessage.value = result.data; await loadMessages()
  } catch (cause) { error.value = errorText(cause) }
}
async function openEvidence(id) {
  evidenceLoading.value = true; evidence.value = null; error.value = ''
  try { evidence.value = (await props.api.analytics.evidence(id, { limit: 20 })).data }
  catch (cause) { error.value = errorText(cause) }
  finally { evidenceLoading.value = false }
}
function runAction(action) {
  if (action.type === 'view_transactions') { if (action.payload?.startDate && action.payload?.endDate) emit('query-change', { startDate: action.payload.startDate, endDate: action.payload.endDate }); emit('navigate', 'ledger') }
  if (action.type === 'compare_period') emit('navigate', 'analytics')
  if (action.type === 'ask_followup') composer.value = action.payload?.text || ''
}
function onComposerKeydown(event) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit() } }
watch(() => props.capabilities.assistant, value => { if (value !== false) loadConversations() }, { immediate: true })
onUnmounted(() => { disposed = true; stopPolling(); conversationsPager.reset(); messagesPager.reset() })
</script>

<template>
  <div class="section-stack">
    <header class="page-header"><div><h1 class="page-title">智能问答</h1><p class="page-description">先由系统计算指标，再由 AI 解释变化，并保留证据快照。</p></div><button type="button" class="button" :disabled="!canAsk || sending" @click="newConversation">+ 新对话</button></header>
    <div v-if="!canAsk" class="phase-note">当前经营主体未开通智能问答接口。对话、任务轮询和证据查看已预留。</div>
    <div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }} <button v-if="failedSubmission" type="button" class="button button--small" @click="submit(true)">重试发送</button></div>
    <div v-if="canAsk" class="chat-layout">
      <section class="card chat-main" aria-label="对话"><div class="section-heading"><h2>{{ current?.title || '新对话' }}</h2><span class="subtle">{{ query.startDate || '—' }} 至 {{ query.endDate || '—' }} 前</span></div>
        <div class="message-list" aria-live="polite"><UiState v-if="loading" kind="loading" /><template v-else-if="!messages.length"><UiState title="问一个经营问题" description="例如：这个月的收入变化由哪些流水造成？" /><div class="suggestion-list"><button v-for="question in suggestions" :key="question" type="button" class="button button--small" @click="composer = question">{{ question }}</button></div></template><article v-for="message in messages" :key="message.id" class="message" :class="`message--${message.role}`"><span class="message__label">{{ message.role === 'user' ? '你' : 'SME-I 助手' }} · {{ statusLabel(message.status) }}</span><p class="message-text">{{ message.text || (['queued', 'querying', 'calculating', 'generating'].includes(message.status) ? '正在查询、计算并整理解释…' : '暂无回答文本') }}</p><ul v-if="message.facts?.length" class="message-facts"><li v-for="(fact, index) in message.facts" :key="index">{{ fact.label }}：{{ formatMetric({ value: fact.currentValue, unit: fact.unit }) }}<button v-if="fact.evidenceId" type="button" class="button button--plain button--small" @click="openEvidence(fact.evidenceId)">看依据</button></li></ul><div v-if="message.evidenceIds?.length" class="toolbar"><button v-for="id in message.evidenceIds" :key="id" type="button" class="button button--small" @click="openEvidence(id)">查看证据 {{ id }}</button></div><p v-for="(limitation, index) in message.limitations || []" :key="index" class="subtle">范围说明：{{ limitation }}</p><div v-if="message.actions?.length" class="toolbar"><button v-for="action in message.actions.filter(item => ['view_transactions', 'compare_period', 'ask_followup'].includes(item.type))" :key="action.type + action.label" type="button" class="button button--small" @click="runAction(action)">{{ action.label }}</button></div><span v-if="message.error?.message" class="error-text">{{ message.error.message }}</span></article></div>
        <div class="table-footer"><span>消息第 {{ messagesPager.previousCursors.value.length + 1 }} 页</span><div class="toolbar"><button type="button" class="button button--small" :disabled="!messagesPager.previousCursors.value.length || messagesPager.loading.value" @click="changeMessagePage('previous')">上一页</button><button type="button" class="button button--small" :disabled="!messagesPager.nextCursor.value || messagesPager.loading.value" @click="changeMessagePage('next')">下一页</button></div></div>
        <div v-if="pending" class="toolbar"><span class="subtle">问答任务正在处理，停止后不会删除已产生的证据。</span><button type="button" class="button button--small" @click="cancel">停止生成</button></div>
        <form class="chat-composer" @submit.prevent="submit()"><label class="visually-hidden" for="question-input">输入你的问题</label><textarea id="question-input" v-model="composer" class="field-control" maxlength="2000" placeholder="例如：本月收支结余为什么下降？" :disabled="sending || pending" @keydown="onComposerKeydown"></textarea><button type="submit" class="button button--primary" :disabled="!composer.trim() || sending || pending">发送</button></form>
      </section>
      <aside class="section-stack" aria-label="对话与证据"><section class="card"><div class="section-heading"><h2>历史对话</h2><button type="button" class="button button--small" @click="loadConversations">刷新</button></div><UiState v-if="!conversations.length" title="暂无历史对话" /><div v-else class="section-stack"><button v-for="conversation in conversations" :key="conversation.id" type="button" class="button" :class="current?.id === conversation.id ? 'button--mint' : ''" style="justify-content: flex-start; white-space: normal; text-align: left" @click="selectConversation(conversation)">{{ conversation.title || conversation.createdAt || '未命名对话' }}</button></div><button v-if="current && !conversations.some(item => item.id === current.id)" type="button" class="button button--mint" @click="selectConversation(current)">当前对话：{{ current.title || current.createdAt || current.id }}</button><div class="table-footer"><span>会话第 {{ conversationsPager.previousCursors.value.length + 1 }} 页</span><div class="toolbar"><button type="button" class="button button--small" :disabled="!conversationsPager.previousCursors.value.length || conversationsPager.loading.value" @click="changeConversationPage('previous')">上一页</button><button type="button" class="button button--small" :disabled="!conversationsPager.nextCursor.value || conversationsPager.loading.value" @click="changeConversationPage('next')">下一页</button></div></div></section><section class="card"><h2 class="card-title">计算依据</h2><UiState v-if="evidenceLoading" kind="loading" /><UiState v-else-if="!evidence" title="点击回答中的证据" description="指标口径、数据版本和来源流水会显示在这里。" /><template v-else><p class="subtle">数据版本：{{ evidence.dataVersion }}<br>快照：{{ evidence.snapshotId }}</p><div v-for="metric in evidence.metrics || []" :key="metric.id" class="evidence-panel"><strong>{{ metric.label }}</strong><p>{{ formatMetric(metric) }}</p><span class="subtle">{{ metric.definition?.formula || metric.definition?.basis || '' }}</span></div><p class="subtle">来源流水 {{ evidence.transactions?.items?.length ?? 0 }} 笔（当前页）</p><button type="button" class="button button--small" @click="emit('navigate', 'ledger')">回查流水</button></template></section></aside>
    </div>
  </div>
</template>
