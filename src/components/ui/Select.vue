<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  error: { type: String, default: '' },
})
defineEmits(['update:modelValue', 'change'])
</script>

<template>
  <select
    class="field-control"
    :value="modelValue"
    :disabled="disabled"
    :required="required"
    :aria-invalid="error ? 'true' : undefined"
    @change="$emit('update:modelValue', $event.target.value); $emit('change')"
  >
    <option v-if="placeholder" value="">{{ placeholder }}</option>
    <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
  </select>
</template>