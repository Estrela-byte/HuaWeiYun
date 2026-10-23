<script setup>
defineProps({
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' },
  filtered: { type: Boolean, default: false },
})
</script>

<template>
  <div class="ui-state ui-state--empty" role="status">
    <div class="ui-state__symbol" aria-hidden="true">◇</div>
    <strong>{{ filtered ? '没有符合条件的结果' : title }}</strong>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>