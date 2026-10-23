<script setup>
import { ref, watch } from 'vue'
import { navigation } from '../domain/navigation.js'

const props = defineProps({
  currentPage: { type: String, default: 'overview' },
  query: { type: Object, default: () => ({}) },
  businessProfile: { type: Object, default: null },
  apiMode: { type: String, default: 'unconfigured' },
})
const emit = defineEmits(['navigate', 'query-change'])
const menuOpen = ref(false)
const startDate = ref(props.query.startDate || '')
const endDate = ref(props.query.endDate || '')
const granularity = ref(props.query.granularity || 'month')
watch(() => props.query, next => {
  startDate.value = next.startDate || ''
  endDate.value = next.endDate || ''
  granularity.value = next.granularity || 'month'
}, { deep: true })
watch(() => props.currentPage, () => { menuOpen.value = false })
function navigate(page) {
  emit('navigate', page)
  menuOpen.value = false
}
function applyPeriod() {
  if (startDate.value && endDate.value && startDate.value >= endDate.value) return
  emit('query-change', { startDate: startDate.value, endDate: endDate.value, granularity: granularity.value })
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand"><span class="brand-mark" aria-hidden="true">S</span><span>SME-I</span></div>
      <div class="app-header__right">
        <span class="business-name" :title="businessProfile?.name || ''">{{ businessProfile?.name || '经营主体待接入' }}</span>
        <span class="mode-badge" :data-mode="apiMode">{{ apiMode === 'demo' ? '演示数据' : apiMode === 'live' ? '联调环境' : '接口待接入' }}</span>
        <button class="button mobile-nav-toggle" type="button" :aria-expanded="menuOpen" aria-controls="mobile-menu" @click="menuOpen = !menuOpen">☰ <span class="visually-hidden">打开导航</span></button>
      </div>
    </header>
    <aside class="app-sidebar" aria-label="主导航">
      <nav>
        <button v-for="item in navigation" :key="item.key" class="nav-link" type="button" :aria-current="currentPage === item.key || (currentPage === 'receipt' && item.key === 'ingestion') ? 'page' : undefined" :aria-label="item.label" @click="navigate(item.key)">
          <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span><span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>
      <div class="sidebar-note">先核对账单，再看经营结果</div>
    </aside>
    <main id="main-content" class="app-main">
      <div class="context-bar card no-print">
        <span class="context-bar__label">分析范围</span>
        <label class="compact-field"><span>开始</span><input v-model="startDate" type="date" class="field-control" @change="applyPeriod"></label>
        <label class="compact-field"><span>结束前（不含）</span><input v-model="endDate" type="date" class="field-control" @change="applyPeriod"></label>
        <label class="compact-field"><span>粒度</span><select v-model="granularity" class="field-control" @change="applyPeriod"><option value="day">日</option><option value="week">周</option><option value="month">月</option></select></label>
        <span v-if="startDate && endDate && startDate >= endDate" class="field-error">结束日期必须晚于开始日期</span>
      </div>
      <slot />
    </main>
    <nav v-if="menuOpen" id="mobile-menu" class="mobile-nav" aria-label="移动端导航">
      <button v-for="item in navigation" :key="item.key" type="button" class="nav-link" :aria-current="currentPage === item.key ? 'page' : undefined" @click="navigate(item.key)"><span aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</button>
    </nav>
  </div>
</template>
