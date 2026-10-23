<script setup>
import { onUnmounted, ref, watch } from 'vue'
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const root = ref(null)
let trigger = null
function handleClose() { emit('close') }
function onKey(event) { if (event.key === 'Escape' && props.open) handleClose() }
watch(() => props.open, (value) => {
  if (value) {
    trigger = document.activeElement
    document.addEventListener('keydown', onKey)
    queueMicrotask(() => root.value?.focus())
  } else {
    document.removeEventListener('keydown', onKey)
    trigger?.focus?.()
  }
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="dialog-overlay" @click.self="handleClose">
    <div ref="root" class="dialog" role="dialog" aria-modal="true" tabindex="-1">
      <header class="dialog__header">
        <h2 class="dialog__title">{{ title }}</h2>
        <button type="button" class="button button--small" @click="handleClose">关闭</button>
      </header>
      <div class="dialog__body"><slot /></div>
      <footer v-if="$slots.footer" class="dialog__footer"><slot name="footer" /></footer>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: grid; place-items: center; z-index: 60; }
.dialog { background: var(--surface, #fff); border-radius: 18px; box-shadow: 0 12px 40px rgba(15,23,42,0.18); max-width: 520px; width: calc(100% - 32px); max-height: calc(100vh - 64px); display: flex; flex-direction: column; outline: none; }
.dialog__header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 12px; gap: 16px; }
.dialog__title { font-size: 20px; font-weight: 600; margin: 0; }
.dialog__body { padding: 0 24px; overflow-y: auto; flex: 1; }
.dialog__footer { padding: 16px 24px 20px; display: flex; justify-content: flex-end; gap: 12px; }
</style>