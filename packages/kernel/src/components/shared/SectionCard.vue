<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <section class="card">
    <div v-if="title || $slots.actions" class="section-heading">
      <div><h2 v-if="title" class="card-title">{{ title }}</h2><span v-if="subtitle" class="subtle">{{ subtitle }}</span></div>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>