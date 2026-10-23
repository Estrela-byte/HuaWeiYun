<script setup>
import { ref } from 'vue'
import { errorText } from '../domain/navigation.js'
const props = defineProps({ api: { type: Object, required: true }, redirectPage: { type: String, default: 'overview' } })
const emit = defineEmits(['navigate', 'authenticated'])
const provider = ref('wechat')
const code = ref('')
const loading = ref(false)
const error = ref('')
const providerOptions = [
  { value: 'wechat', label: '微信' },
  { value: 'phone', label: '手机号' },
  { value: 'email', label: '邮箱' },
]
async function submit() {
  if (loading.value || !code.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    await props.api.auth.login({ provider: provider.value, code: code.value.trim() })
    emit('authenticated')
    emit('navigate', props.redirectPage || 'overview')
  } catch (cause) {
    error.value = errorText(cause) || '登录失败，请重试。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <h1 class="page-title">登录 SME-I</h1>
      <p class="page-description">选择登录方式并输入凭据，登录后可继续经营管理工作。</p>
      <div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div>
      <form @submit.prevent="submit">
        <label class="field">登录方式<select v-model="provider" class="field-control"><option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></label>
        <label class="field">凭据 / 授权码<input v-model.trim="code" class="field-control" required placeholder="输入授权码或凭据"></label>
        <div class="form-actions"><button class="button button--primary" type="submit" :disabled="loading || !code.trim()">{{ loading ? '登录中…' : '登录' }}</button></div>
      </form>
      <p class="subtle">登录方式需与后端队友确认；密钥与密码不会保存在前端。</p>
    </div>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.auth-card { max-width: 420px; width: 100%; padding: 32px; }
</style>