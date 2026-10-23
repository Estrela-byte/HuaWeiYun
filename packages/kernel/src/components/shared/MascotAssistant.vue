<script setup>
import { computed } from 'vue'
const props = defineProps({
  scene: { type: String, default: 'welcome' },
  state: { type: String, default: 'idle' },
  message: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
defineEmits(['dismiss', 'openHelp'])
const sceneMessages = {
  welcome: '从一笔清楚的流水开始，逐步看懂经营变化。',
  importing: '正在处理账单，请稍候。',
  'needs-review': '有行需要核对，点击去核对。',
  success: '操作已完成。',
  analyzing: '正在计算经营指标…',
  warning: '有待处理的预警，请查看。',
  'backup-success': '备份已完成。',
}
const text = computed(() => props.message || sceneMessages[props.scene] || '')
</script>

<template>
  <aside class="mascot" :class="`mascot--${scene}`" :data-compact="compact" role="complementary" aria-label="经营助手">
    <div class="mascot__avatar" aria-hidden="true"><span class="mascot__symbol">S</span></div>
    <div v-if="!compact" class="mascot__content">
      <p class="mascot__message">{{ text }}</p>
      <div class="mascot__actions">
        <button type="button" class="button button--small" @click="$emit('openHelp')">帮助</button>
        <button type="button" class="mascot__dismiss" aria-label="关闭助手" @click="$emit('dismiss')">×</button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.mascot { display: flex; gap: 12px; align-items: flex-start; padding: 16px; border-radius: 14px; background: var(--mint-bg, #e6f8f3); }
.mascot__avatar { width: 48px; height: 48px; border-radius: 50%; background: #087f73; display: grid; place-items: center; flex-shrink: 0; }
.mascot__symbol { color: #fff; font-size: 22px; font-weight: 700; }
.mascot__content { flex: 1; min-width: 0; }
.mascot__message { margin: 0 0 8px; font-size: 14px; color: #087f73; line-height: 1.5; }
.mascot__actions { display: flex; gap: 8px; align-items: center; }
.mascot__dismiss { background: none; border: none; font-size: 16px; cursor: pointer; color: var(--text-muted, #64748b); line-height: 1; }
.mascot[data-compact="true"] { padding: 8px; }
.mascot[data-compact="true"] .mascot__avatar { width: 36px; height: 36px; }
@media (prefers-reduced-motion: reduce) { .mascot { animation: none; } }
</style>