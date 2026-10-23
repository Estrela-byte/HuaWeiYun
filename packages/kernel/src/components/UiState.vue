<script setup>
defineProps({
  kind: { type: String, default: 'empty' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  retry: { type: Boolean, default: false },
})
defineEmits(['retry'])
</script>

<template>
  <div class="ui-state" :class="`ui-state--${kind}`" :role="kind === 'error' ? 'alert' : 'status'">
    <div class="ui-state__symbol" aria-hidden="true">{{ kind === 'error' ? '!' : kind === 'loading' ? '◌' : '◇' }}</div>
    <strong>{{ title || (kind === 'error' ? '加载失败' : kind === 'loading' ? '正在加载' : '暂无数据') }}</strong>
    <p v-if="description">{{ description }}</p>
    <button v-if="retry" type="button" class="button" @click="$emit('retry')">重试</button>
  </div>
</template>
