<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['change'])
const start = ref(props.startDate)
const end = ref(props.endDate)
watch(() => props.startDate, (value) => { start.value = value })
watch(() => props.endDate, (value) => { end.value = value })
const invalid = computed(() => !!(start.value && end.value && start.value >= end.value))
function apply() { if (invalid.value) return; emit('change', { startDate: start.value, endDate: end.value }) }
</script>

<template>
  <div class="toolbar">
    <label class="compact-field"><span>开始</span><input v-model="start" type="date" class="field-control" :disabled="disabled" @change="apply"></label>
    <label class="compact-field"><span>结束前（不含）</span><input v-model="end" type="date" class="field-control" :disabled="disabled" @change="apply"></label>
    <span v-if="invalid" class="field-error">结束日期必须晚于开始日期</span>
  </div>
</template>