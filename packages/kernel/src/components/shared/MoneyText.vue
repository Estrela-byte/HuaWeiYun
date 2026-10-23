<script setup>
import { computed } from 'vue'
import { formatAmountMinor } from '../../domain/navigation.js'
const props = defineProps({
  amountMinor: { type: String, default: '' },
  direction: { type: String, default: '' },
  currency: { type: String, default: 'CNY' },
})
const text = computed(() => {
  const formatted = formatAmountMinor(props.amountMinor, props.currency)
  if (formatted === '—') return formatted
  const sign = props.direction === 'outflow' ? '−' : props.direction === 'inflow' ? '+' : ''
  return `${sign}${formatted}`
})
</script>

<template>
  <span class="money-text">{{ text }}</span>
</template>

<style scoped>
.money-text { font-variant-numeric: tabular-nums; }
</style>