<script setup>
import { computed } from 'vue'
const props = defineProps({
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'medium' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
defineEmits(['click'])
const classes = computed(() => [
  'button',
  props.variant === 'primary' && 'button--primary',
  props.variant === 'danger' && 'button--danger',
  props.size === 'small' && 'button--small',
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined" @click="$emit('click')">
    <slot />
  </button>
</template>