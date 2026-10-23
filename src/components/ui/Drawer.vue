<script setup>
import { onUnmounted, ref, watch } from 'vue'
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  side: { type: String, default: 'right' },
})
const emit = defineEmits(['close'])
const root = ref(null)
let trigger = null
function handleClose() { emit('close') }
function onKey(event) { if (event.key === 'Escape' && props.open) handleClose() }
watch(() => props.open, (value) => {
  if (value) { trigger = document.activeElement; document.addEventListener('keydown', onKey); queueMicrotask(() => root.value?.focus()) }
  else { document.removeEventListener('keydown', onKey); trigger?.focus?.() }
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="drawer-overlay" @click.self="handleClose">
    <div ref="root" class="drawer" :class="`drawer--${side}`" role="dialog" aria-modal="true" tabindex="-1">
      <header class="drawer__header"><h2 class="drawer__title">{{ title }}</h2><button type="button" class="button button--small" @click="handleClose">关闭</button></header>
      <div class="drawer__body"><slot /></div>
      <footer v-if="$slots.footer" class="drawer__footer"><slot name="footer" /></footer>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.4); z-index: 55; }
.drawer { position: absolute; top: 0; bottom: 0; background: var(--surface, #fff); box-shadow: 0 8px 32px rgba(15,23,42,0.16); display: flex; flex-direction: column; outline: none; max-width: 420px; width: calc(100% - 56px); }
.drawer--right { right: 0; border-radius: 18px 0 0 18px; }
.drawer--left { left: 0; border-radius: 0 18px 18px 0; }
.drawer__header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 12px; gap: 16px; }
.drawer__title { font-size: 18px; font-weight: 600; margin: 0; }
.drawer__body { padding: 0 24px; overflow-y: auto; flex: 1; }
.drawer__footer { padding: 16px 24px 20px; display: flex; justify-content: flex-end; gap: 12px; }
</style>