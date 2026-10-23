<script setup>
defineProps({
  title: { type: String, default: '' },
  unit: { type: String, default: '' },
  range: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  quality: { type: String, default: '' },
})
defineEmits(['refresh', 'drilldown'])
</script>

<template>
  <section class="card chart-panel">
    <div class="section-heading">
      <div><h2 class="card-title">{{ title }}</h2><span v-if="unit || range" class="subtle">{{ unit }}<span v-if="unit && range"> · </span>{{ range }}</span></div>
      <slot name="actions" />
    </div>
    <div v-if="loading" class="chart-panel__loading" role="status">正在绘制…</div>
    <div v-else-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div>
    <slot v-else />
    <small v-if="quality" class="muted">{{ quality }}</small>
  </section>
</template>

<style scoped>
.chart-panel__loading { padding: 48px; text-align: center; color: var(--text-muted, #64748b); }
</style>