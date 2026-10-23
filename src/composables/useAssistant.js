import { onUnmounted, ref } from 'vue'
import { asItems, errorText } from '../domain/navigation.js'

const terminalStatus = new Set(['completed', 'needs_clarification', 'insufficient_data', 'stopped', 'failed'])

export function useAssistant(api) {
  const conversations = ref([])
  const messages = ref([])
  const loading = ref(false)
  const sending = ref(false)
  const error = ref('')
  let pollTimer = null

  async function loadConversations(query) {
    try { conversations.value = asItems((await api.assistant.conversations(query)).data) }
    catch (cause) { error.value = errorText(cause) }
  }

  async function loadMessages(conversationId, query) {
    loading.value = true; error.value = ''
    try { messages.value = asItems((await api.assistant.messages(conversationId, query)).data) }
    catch (cause) { error.value = errorText(cause); messages.value = [] }
    finally { loading.value = false }
  }

  async function send(conversationId, payload, options) {
    if (sending.value) return null
    sending.value = true; error.value = ''
    try {
      const result = await api.assistant.sendMessage(conversationId, payload, options)
      messages.value = [...messages.value, result.data]
      if (!terminalStatus.has(result.data?.status) && result.data?.id) pollMessage(conversationId, result.data.id)
      return result
    } catch (cause) { error.value = errorText(cause); return null }
    finally { sending.value = false }
  }

  async function pollMessage(conversationId, messageId) {
    try {
      const result = await api.assistant.getMessage(conversationId, messageId)
      const index = messages.value.findIndex(msg => msg.id === messageId)
      if (index >= 0) messages.value[index] = result.data
      if (!terminalStatus.has(result.data?.status)) pollTimer = setTimeout(() => pollMessage(conversationId, messageId), 2000)
    } catch { /* stop polling on error */ }
  }

  async function stop(conversationId, messageId, options) {
    try { return await api.assistant.cancelMessage(conversationId, messageId, options) }
    catch (cause) { error.value = errorText(cause); return null }
  }

  function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null }
  onUnmounted(stopPolling)
  return { conversations, messages, loading, sending, error, loadConversations, loadMessages, send, pollMessage, stop, stopPolling }
}