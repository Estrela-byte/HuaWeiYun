<script setup>
import { computed } from 'vue'
import { statusLabel } from '../../domain/navigation.js'
const props = defineProps({ platform: { type: String, default: '' } })
const label = computed(() => statusLabel(props.platform))
const mint = computed(() => props.platform === 'manual')
</script>

<template>
  <span class="badge" :class="mint ? 'badge--mint' : ''">{{ label }}</span>
</template>