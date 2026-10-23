<script setup>
import { computed } from 'vue'
const props = defineProps({
  modelValue: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  direction: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
defineEmits(['update:modelValue'])
const options = computed(() => {
  let list = props.categories.filter(item => !item.archived)
  if (props.direction) list = list.filter(item => item.direction === props.direction)
  return list.map(item => ({ value: item.id, label: item.name }))
})
</script>

<template>
  <select class="field-control" :value="modelValue" :disabled="disabled" :aria-invalid="error ? 'true' : undefined" @change="$emit('update:modelValue', $event.target.value)">
    <option v-if="allowEmpty" value="">暂不分类</option>
    <option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option>
  </select>
</template>