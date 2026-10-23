<script setup>
import { computed } from 'vue'
import { formatMetric, formatRate } from '../../domain/navigation.js'
const props = defineProps({
  metric: { type: Object, required: true },
  comparison: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
})
defineEmits(['drilldown'])
const display = computed(() => formatMetric(props.metric))
const change = computed(() => props.comparison?.relativeChange == null ? '' : formatRate(props.comparison?.relativeChange))
const qualityNote = computed(() => {
  if (!props.metric.quality || props.metric.quality === 'complete') return ''
  return props.metric.quality === 'unavailable' ? '暂无可计算数据' : '部分数据'
})
</script>

<template>
  <component :is="clickable ? 'button' : 'div'" class="card metric-card" :class="{ 'metric-card--clickable': clickable }" :type="clickable ? 'button' : undefined" @click="clickable && $emit('drilldown', metric)">
    <span class="eyebrow">{{ metric.label }}</span>
    <span class="metric-value">{{ display }}</span>
    <span v-if="qualityNote" class="quality-note">{{ qualityNote }}{{ metric.qualityReason ? ` · ${metric.qualityReason}` : '' }}</span>
    <span v-if="comparison" class="trend" :data-favorability="comparison.favorability">
      {{ change || comparison.unavailableReason || '不可比较' }} <span v-if="change">较对照期</span>
    </span>
    <small v-if="metric.definition?.basis" class="muted">{{ metric.definition.basis }}</small>
  </component>
</template>