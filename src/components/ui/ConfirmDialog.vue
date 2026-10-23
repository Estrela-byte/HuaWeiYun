<script setup>
import Dialog from './Dialog.vue'
import BaseButton from './BaseButton.vue'
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '请确认' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: '确认' },
  cancelLabel: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Dialog :open="open" :title="title" @close="$emit('cancel')">
    <p>{{ message }}</p>
    <template #footer>
      <BaseButton @click="$emit('cancel')">{{ cancelLabel }}</BaseButton>
      <BaseButton :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="$emit('confirm')">{{ confirmLabel }}</BaseButton>
    </template>
  </Dialog>
</template>