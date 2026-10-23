<script setup>
defineProps({
  message: { type: String, default: '加载失败' },
  description: { type: String, default: '' },
  retry: { type: Boolean, default: true },
})
defineEmits(['retry'])
</script>

<template>
  <div class="ui-state ui-state--error" role="alert">
    <div class="ui-state__symbol" aria-hidden="true">!</div>
    <strong>{{ message }}</strong>
    <p v-if="description">{{ description }}</p>
    <button v-if="retry" type="button" class="button" @click="$emit('retry')">重试</button>
  </div>
</template>