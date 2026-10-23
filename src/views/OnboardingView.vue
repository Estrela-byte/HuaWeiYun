<script setup>
import { ref } from 'vue'
import { createIdempotencyIntent, errorText } from '../domain/navigation.js'
const props = defineProps({ api: { type: Object, required: true } })
const emit = defineEmits(['navigate', 'created'])
const form = ref({ name: '', industry: 'catering', currency: 'CNY', timezone: 'Asia/Shanghai' })
const loading = ref(false)
const error = ref('')
const createIntent = createIdempotencyIntent()
const industryOptions = [
  { value: 'catering', label: '餐饮' },
  { value: 'beverage', label: '茶饮' },
  { value: 'convenience', label: '便利店' },
  { value: 'retail', label: '小型零售' },
  { value: 'service', label: '个体服务' },
  { value: 'other', label: '其他' },
]
async function submit() {
  if (loading.value || !form.value.name.trim()) return
  loading.value = true
  error.value = ''
  try {
    const payload = { name: form.value.name.trim(), industry: form.value.industry, currency: form.value.currency, timezone: form.value.timezone }
    const result = await props.api.business.createProfile(
      payload,
      { idempotencyKey: createIntent.keyFor(payload) }
    )
    if (!result.data?.id) throw new Error('服务端未返回经营主体编号。')
    createIntent.clear()
    emit('created', result.data)
    emit('navigate', 'overview')
  } catch (cause) {
    error.value = errorText(cause) || '创建经营主体失败，请重试。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <h1 class="page-title">配置经营主体</h1>
      <p class="page-description">首次使用请填写经营主体基本信息，完成后可开始录账。</p>
      <div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div>
      <form @submit.prevent="submit">
        <label class="field">主体名称<input v-model.trim="form.name" class="field-control" required placeholder="如：XX 餐饮店"></label>
        <label class="field">行业<select v-model="form.industry" class="field-control"><option v-for="opt in industryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></label>
        <label class="field">币种<select v-model="form.currency" class="field-control"><option value="CNY">人民币（CNY）</option></select></label>
        <label class="field">时区<select v-model="form.timezone" class="field-control"><option value="Asia/Shanghai">Asia/Shanghai</option></select></label>
        <div class="form-actions"><button class="button button--primary" type="submit" :disabled="loading || !form.name.trim()">{{ loading ? '保存中…' : '完成配置' }}</button></div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.auth-card { max-width: 420px; width: 100%; padding: 32px; }
</style>
