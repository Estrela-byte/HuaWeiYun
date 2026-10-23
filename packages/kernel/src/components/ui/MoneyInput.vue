<script setup>
import { computed } from 'vue'
import { yuanToMinor } from '../../domain/navigation.js'
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
  placeholder: { type: String, default: '0.00' },
})
const emit = defineEmits(['update:modelValue', 'update:valid'])
const yuan = computed({
  get: () => {
    if (!props.modelValue) return ''
    try {
      const minor = BigInt(props.modelValue)
      return `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`
    } catch { return '' }
  },
  set: (value) => {
    const minor = yuanToMinor(value)
    emit('update:modelValue', minor || '')
    emit('update:valid', !!minor)
  },
})
</script>

<template>
  <input
    v-model="yuan"
    class="field-control"
    inputmode="decimal"
    :disabled="disabled"
    :required="required"
    :placeholder="placeholder"
    :aria-invalid="error ? 'true' : undefined"
  />
</template>