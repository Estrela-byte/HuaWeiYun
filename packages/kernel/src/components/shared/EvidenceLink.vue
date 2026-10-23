<script setup>
defineProps({ evidenceId: { type: String, default: '' }, label: { type: String, default: '查看依据' } })
defineEmits(['open'])
</script>

<template>
  <button v-if="evidenceId" type="button" class="evidence-link" @click="$emit('open', evidenceId)">{{ label }}</button>
</template>

<style scoped>
.evidence-link { background: none; border: none; color: var(--accent, #2475ff); cursor: pointer; padding: 0; font-size: inherit; text-decoration: underline; }
</style>