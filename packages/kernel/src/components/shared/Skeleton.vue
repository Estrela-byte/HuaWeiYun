<script setup>
defineProps({
  lines: { type: Number, default: 3 },
  label: { type: String, default: '正在加载' },
})
</script>

<template>
  <div class="ui-state ui-state--loading" role="status" aria-live="polite">
    <div class="ui-state__symbol" aria-hidden="true">◌</div>
    <strong>{{ label }}</strong>
    <div class="skeleton-lines">
      <div v-for="n in lines" :key="n" class="skeleton-line" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-lines { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; width: 100%; }
.skeleton-line { height: 14px; border-radius: 6px; background: linear-gradient(90deg, #eef2f7 25%, #f6f8fc 50%, #eef2f7 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.4s ease-in-out infinite; }
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton-line { animation: none; } }
</style>