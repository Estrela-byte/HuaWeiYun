<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import KpiCard from '../components/shared/KpiCard.vue'
import MascotAssistant from '../components/shared/MascotAssistant.vue'
import { asItems, errorText, formatAmountMinor, navigation, statusLabel } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const busy = ref(false)
const error = ref('')
const metrics = ref([])
const recentTransactions = ref([])
const recentImports = ref([])
const dataVersion = ref('')
let controller
const featureCards = navigation.filter(item => item.key !== 'overview')
const highlightedMetrics = computed(() => metrics.value.slice(0, 4))
const pendingImports = computed(() => recentImports.value.filter(batch => batch.status === 'review' || batch.status === 'failed'))

async function load() {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  busy.value = true
  error.value = ''
  const outcomes = await Promise.allSettled([
    props.api.analytics.summary(props.query, { signal }),
    props.api.transactions.list({ limit: 5, sort: '-businessDate' }, { signal }),
    props.api.imports.list({ limit: 5 }, { signal }),
  ])
  if (signal.aborted) return
  const [summary, transactions, imports] = outcomes
  if (summary.status === 'fulfilled') { metrics.value = summary.value.data?.metrics || []; dataVersion.value = summary.value.meta?.dataVersion || '' }
  else metrics.value = []
  recentTransactions.value = transactions.status === 'fulfilled' ? asItems(transactions.value.data) : []
  recentImports.value = imports.status === 'fulfilled' ? asItems(imports.value.data) : []
  if (outcomes.every(result => result.status === 'rejected')) error.value = errorText(summary.reason)
  busy.value = false
}
watch(() => props.query, load, { immediate: true, deep: true })
onUnmounted(() => controller?.abort())
</script>

<template>
  <div class="section-stack">
    <header class="page-header"><div><h1 class="page-title">功能总览</h1><p class="page-description">从一笔清楚的流水开始，逐步看懂经营变化。</p></div><button type="button" class="button button--primary" @click="emit('navigate', 'ingestion')">导入账单 →</button></header>
    <div v-if="apiMode === 'demo'" class="inline-message inline-message--warn">当前为演示数据，页面展示仅用于前端体验与接口联调。</div>
    <div v-if="error" class="card"><UiState kind="error" :description="error" retry @retry="load" /></div>
    <section aria-labelledby="overview-modules"><div class="section-heading"><h2 id="overview-modules">工作模块</h2><span class="subtle">六大业务模块</span></div>
      <div class="feature-grid"><button v-for="item in featureCards" :key="item.key" class="card feature-card" type="button" @click="emit('navigate', item.key)"><span class="feature-card__icon" aria-hidden="true">{{ item.icon }}</span><h3>{{ item.label }}</h3><p>{{ item.description }}</p><span class="feature-link">打开模块 →</span></button></div>
    </section>
    <section aria-labelledby="overview-metrics"><div class="section-heading"><h2 id="overview-metrics">经营概览</h2><span v-if="dataVersion" class="subtle">数据版本 {{ dataVersion }}</span></div>
      <div v-if="highlightedMetrics.length" class="kpi-grid"><KpiCard v-for="metric in highlightedMetrics" :key="metric.id" :metric="metric" clickable @drilldown="emit('navigate', 'analytics')" /></div>
      <div v-else class="card"><UiState :kind="busy ? 'loading' : 'empty'" :title="busy ? '正在读取指标' : '暂无经营指标'" :description="busy ? '' : '导入或录入流水后，可在这里查看服务端计算的结果。'" /><MascotAssistant v-if="!busy" scene="welcome" @open-help="emit('navigate', 'ingestion')" /></div>
    </section>
    <div class="two-column">
      <section class="card" aria-labelledby="overview-tasks"><div class="section-heading"><h2 id="overview-tasks">需要处理</h2><button type="button" class="button button--small" @click="emit('navigate', 'ingestion')">查看导入</button></div>
        <UiState v-if="busy && !recentImports.length" kind="loading" />
        <UiState v-else-if="!pendingImports.length" title="暂无待处理导入" description="新上传的账单会先进入预览区，核对后再入账。" />
        <div v-else class="section-stack"><button v-for="batch in pendingImports" :key="batch.id" type="button" class="button" style="justify-content: space-between" @click="emit('navigate', 'ingestion')"><span>{{ batch.filename }}</span><span class="badge" :class="batch.status === 'failed' ? 'badge--danger' : 'badge--warn'">{{ statusLabel(batch.status) }}</span></button></div>
      </section>
      <section class="card" aria-labelledby="overview-recent"><div class="section-heading"><h2 id="overview-recent">近期流水</h2><button type="button" class="button button--small" @click="emit('navigate', 'ledger')">查看全部</button></div>
        <UiState v-if="busy && !recentTransactions.length" kind="loading" />
        <UiState v-else-if="!recentTransactions.length" title="还没有流水" description="手动记一笔，或先导入账单。" />
        <div v-else class="table-scroll"><table class="data-table"><thead><tr><th>日期</th><th>摘要</th><th class="numeric">金额</th></tr></thead><tbody><tr v-for="transaction in recentTransactions" :key="transaction.id"><td>{{ transaction.businessDate }}</td><td>{{ transaction.summary }}</td><td class="numeric">{{ transaction.direction === 'outflow' ? '−' : '+' }}{{ formatAmountMinor(transaction.amountMinor) }}</td></tr></tbody></table></div>
      </section>
    </div>
  </div>
</template>
