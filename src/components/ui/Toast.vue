<script setup>
defineProps({ message: { type: String, default: '' }, variant: { type: String, default: 'info' } })
defineEmits(['dismiss'])
</script>

<template>
  <div v-if="message" class="toast" :class="`toast--${variant}`" role="status">
    <span>{{ message }}</span>
    <button type="button" class="toast__close" aria-label="关闭提示" @click="$emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--surface, #fff); border-radius: 12px; box-shadow: 0 8px 24px rgba(15,23,42,0.16); padding: 12px 16px; display: flex; align-items: center; gap: 12px; z-index: 70; max-width: calc(100% - 48px); }
.toast--error { border-left: 4px solid #e5484d; }
.toast--success { border-left: 4px solid #087f73; }
.toast--warn { border-left: 4px solid #f5a623; }
.toast__close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted, #64748b); line-height: 1; }
</style>