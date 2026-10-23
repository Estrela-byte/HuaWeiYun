<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  error: { type: String, default: '' },
  inputmode: { type: String, default: '' },
})
defineEmits(['update:modelValue', 'enter'])
</script>

<template>
  <input
    :type="type"
    class="field-control"
    :value="modelValue"
    :disabled="disabled"
    :required="required"
    :placeholder="placeholder"
    :inputmode="inputmode || undefined"
    :aria-invalid="error ? 'true' : undefined"
    @input="$emit('update:modelValue', $event.target.value)"
    @keydown.enter="$emit('enter')"
  />
</template>