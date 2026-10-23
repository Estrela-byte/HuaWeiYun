<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import MetricCard from '../components/MetricCard.vue'
import UiState from '../components/UiState.vue'
import { asItems, errorText, formatAmountMinor, formatMetric, formatRate } from '../domain/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const loading = ref(false)
const error = ref('')
const metrics = ref([])
const trends = ref([])
const structure = ref(null)
const comparisons = ref([])
const meta = ref({})
const evidence = ref(null)
const evidenceLoading = ref(false)
const evidenceError = ref('')
let controller
const comparisonMap = computed(() => Object.fromEntries(comparisons.value.map(item => [item.metricId, item])))
const chartSeries = computed(() => trends.value.filter(series => series.unit === 'currency_minor' && Array.isArray(series.points)))
const chartPoints = computed(() => chartSeries.value.flatMap(series => series.points).filter(point => point.value !== null && Number.isFinite(Number(point.value))).map(point => Number(point.value)))
const chartMin = computed(() => Math.min(0, ...chartPoints.value))
const chartMax = computed(() => Math.max(1, ...chartPoints.value))
const chartLabels = computed(() => chartSeries.value[0]?.points?.map(point => point.date) || [])
const colors = ['#2475ff', '#ff8e76', '#4ccdb5', '#8d9ed8']
const chartPaths = computed(() => chartSeries.value.map((series, seriesIndex) => {
  let parts = []
  let current = []
  const length = Math.max(series.points.length - 1, 1)
  series.points.forEach((point, index) => {
    const value = point.value === null ? NaN : Number(point.value)
    if (!Number.isFinite(value)) { if (current.length) parts.push(current.join(' ')); current = []; return }
    const x = 46 + index * 650 / length
    const y = 225 - (value - chartMin.value) / (chartMax.value - chartMin.value) * 185
    current.push(`${x},${y}`)
  })
  if (current.length) parts.push(current.join(' '))
  return { id: series.metricId, label: metrics.value.find(metric => metric.id === series.metricId)?.label || series.metricId, color: colors[seriesIndex % colors.length], parts }
}))
const chartDots = computed(() => chartSeries.value.flatMap((series, seriesIndex) => series.points.flatMap((point, index) => {
  const value = point.value === null ? NaN : Number(point.value)
  if (!Number.isFinite(value)) return []
  return [{ key: `${series.metricId}-${index}`, x: 46 + index * 650 / Math.max(series.points.length - 1, 1), y: 225 - (value - chartMin.value) / (chartMax.value - chartMin.value) * 185, color: colors[seriesIndex % colors.length], label: `${series.metricId} ${point.date} ${formatAmountMinor(point.value)}` }]
})))
const breakdown = computed(() => structure.value?.items || [])

async function load() {
  controller?.abort(); controller = new AbortController()
  const signal = controller.signal
  loading.value = true; error.value = ''; evidence.value = null
  const result = await Promise.allSettled([
    props.api.analytics.summary(props.query, { signal }),
    props.api.analytics.trends(props.query, { signal }),
    props.api.analytics.costStructure(props.query, { signal }),
    props.api.analytics.comparisons(props.query, { signal }),
  ])
  if (signal.aborted) return
  if (result[0].status === 'fulfilled') { metrics.value = result[0].value.data?.metrics || []; meta.value = result[0].value.meta || {} } else metrics.value = []
  trends.value = result[1].status === 'fulfilled' ? asItems(result[1].value.data) : []
  structure.value = result[2].status === 'fulfilled' ? result[2].value.data : null
  comparisons.value = result[3].status === 'fulfilled' ? asItems(result[3].value.data) : []
  if (result.every(item => item.status === 'rejected')) error.value = errorText(result[0].reason)
  else if (result.some(item => item.status === 'rejected')) error.value = '部分分析图表暂时不可用，可单独重试。'
  loading.value = false
}
async function openEvidence(id) {
  if (!id) return
  evidenceLoading.value = true; evidenceError.value = ''; evidence.value = null
  try { evidence.value = (await props.api.analytics.evidence(id, { limit: 20 })).data }
  catch (cause) { evidenceError.value = errorText(cause) }
  finally { evidenceLoading.value = false }
}
function inspectMetric(metric) { if (metric.evidenceId) openEvidence(metric.evidenceId) }
function openTransactions() {
  if (evidence.value?.query?.startDate && evidence.value?.query?.endDate) emit('query-change', { startDate: evidence.value.query.startDate, endDate: evidence.value.query.endDate })
  emit('navigate', 'ledger')
}
watch(() => props.query, load, { immediate: true, deep: true })
onUnmounted(() => controller?.abort())
</script>

<template>
  <div class="section-stack">
    <header class="page-header"><div><h1 class="page-title">经营分析</h1><p class="page-description">同一期间和服务端统计口径，查看指标、趋势、成本结构及对照。</p></div><button type="button" class="button" @click="load">刷新分析</button></header>
    <div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }} <button type="button" class="button button--small" @click="load">重试</button></div>
    <div class="toolbar"><span class="badge">{{ query.startDate || '—' }} 至 {{ query.endDate || '—' }} 前</span><span class="badge badge--mint">{{ { day: '按日', week: '按周', month: '按月' }[query.granularity] || '按月' }}</span><span v-if="meta.dataVersion" class="subtle">数据版本 {{ meta.dataVersion }}</span></div>
    <section aria-labelledby="analytics-metrics"><div class="section-heading"><h2 id="analytics-metrics">关键指标</h2><span class="subtle">指标名称和定义由服务端返回</span></div><UiState v-if="loading && !metrics.length" kind="loading" /><UiState v-else-if="!metrics.length" title="暂无可计算指标" description="当前期间可能没有完整数据，先核对流水。" /><div v-else class="kpi-grid"><MetricCard v-for="metric in metrics" :key="metric.id" :metric="metric" :comparison="comparisonMap[metric.id]" :clickable="!!metric.evidenceId" @open="inspectMetric" /></div></section>
    <div class="analysis-grid">
      <section class="card chart-panel" aria-labelledby="trend-title"><div class="section-heading"><h2 id="trend-title">收支趋势</h2><span class="subtle">点击下方数据行查看证据</span></div><UiState v-if="loading && !chartSeries.length" kind="loading" /><UiState v-else-if="!chartSeries.length || !chartPoints.length" title="趋势暂无数据" /><template v-else><div class="chart-legend"><span v-for="series in chartPaths" :key="series.id"><i :style="{ backgroundColor: series.color }"></i>{{ series.label }}</span></div><svg class="line-chart" viewBox="0 0 730 260" role="img" :aria-label="`显示 ${chartSeries.length} 项指标趋势的折线图，下方表格提供数值`"><line v-for="line in [40, 86, 132, 178, 225]" :key="line" class="gridline" x1="46" :y1="line" x2="696" :y2="line" /><polyline v-for="(segment, index) in chartPaths.flatMap(series => series.parts.map(part => ({ part, color: series.color })))" :key="index" :points="segment.part" fill="none" :stroke="segment.color" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /><circle v-for="dot in chartDots" :key="dot.key" :cx="dot.x" :cy="dot.y" r="4" :fill="dot.color"><title>{{ dot.label }}</title></circle><text v-for="(label, index) in chartLabels" :key="`${label}-${index}`" class="axis-label" :x="46 + index * 650 / Math.max(chartLabels.length - 1, 1)" y="250" text-anchor="middle">{{ label.slice(5) }}</text></svg><div class="table-scroll"><table class="data-table"><thead><tr><th>指标</th><th v-for="(label, index) in chartLabels" :key="index" class="numeric">{{ label }}</th></tr></thead><tbody><tr v-for="series in chartSeries" :key="series.metricId"><th>{{ metrics.find(metric => metric.id === series.metricId)?.label || series.metricId }}</th><td v-for="(point, index) in series.points" :key="index" class="numeric"><button v-if="point.evidenceId" class="button button--plain button--small" type="button" :title="`查看 ${point.date} 证据`" @click="openEvidence(point.evidenceId)">{{ formatAmountMinor(point.value) }}</button><span v-else>{{ formatAmountMinor(point.value) }}</span></td></tr></tbody></table></div></template></section>
      <section class="card"><div class="section-heading"><h2>成本结构</h2><span v-if="structure?.denominatorMetricId" class="subtle">分母：{{ structure.denominatorMetricId }}</span></div><UiState v-if="loading && !structure" kind="loading" /><UiState v-else-if="!breakdown.length" title="暂无成本构成" description="当前期间缺少可归属成本数据。" /><template v-else><p class="muted">合计 {{ formatAmountMinor(structure.totalMinor) }}</p><div class="breakdown-list"><button v-for="item in breakdown" :key="item.categoryId" type="button" class="breakdown-item" :disabled="!item.evidenceId" @click="openEvidence(item.evidenceId)"><span class="breakdown-item__meta"><strong>{{ item.label }}</strong><span>{{ formatAmountMinor(item.amountMinor) }} · {{ item.ratio == null ? '占比不可用' : `${(Number(item.ratio) * 100).toFixed(1)}%` }}</span></span><span class="bar-track"><span class="bar-fill" :style="{ width: item.ratio == null ? '0%' : `${Math.max(0, Math.min(100, Number(item.ratio) * 100))}%` }"></span></span></button></div></template></section>
    </div>
    <section class="card"><div class="section-heading"><h2>同环比对照</h2><span class="subtle">不可比较时展示后端说明</span></div><UiState v-if="loading && !comparisons.length" kind="loading" /><UiState v-else-if="!comparisons.length" title="暂无可比较数据" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>指标</th><th class="numeric">本期</th><th class="numeric">对照期</th><th class="numeric">相对变化</th><th>说明</th></tr></thead><tbody><tr v-for="item in comparisons" :key="item.metricId"><td>{{ item.current?.label || item.metricId }}</td><td class="numeric">{{ formatMetric(item.current) }}</td><td class="numeric">{{ formatMetric(item.previous) }}</td><td class="numeric"><span class="trend" :data-favorability="item.favorability">{{ formatRate(item.relativeChange) }}</span></td><td>{{ item.unavailableReason || (item.percentagePointChange == null ? '—' : `${item.percentagePointChange} 个百分点`) }}</td></tr></tbody></table></div></section>
    <section v-if="evidenceLoading || evidence || evidenceError" class="card" aria-labelledby="evidence-title"><div class="section-heading"><h2 id="evidence-title">计算证据</h2><button type="button" class="button button--small" @click="evidence = null; evidenceError = ''">关闭</button></div><UiState v-if="evidenceLoading" kind="loading" /><UiState v-else-if="evidenceError" kind="error" :description="evidenceError" /><template v-else-if="evidence"><p class="muted">快照 {{ evidence.snapshotId || '—' }} · 数据版本 {{ evidence.dataVersion || '—' }}</p><div class="toolbar"><span v-for="metric in evidence.metrics || []" :key="metric.id" class="badge badge--mint">{{ metric.label }} {{ formatMetric(metric) }}</span></div><div class="table-scroll" style="margin-top: 16px"><table class="data-table"><thead><tr><th>日期</th><th>摘要</th><th>来源</th><th class="numeric">金额</th></tr></thead><tbody><tr v-for="item in asItems(evidence.transactions)" :key="item.id"><td>{{ item.businessDate }}</td><td>{{ item.summary }}</td><td>{{ item.source?.platform || '—' }}</td><td class="numeric">{{ formatAmountMinor(item.amountMinor) }}</td></tr></tbody></table></div><div class="form-actions"><button type="button" class="button" @click="openTransactions">回查流水 →</button></div></template></section>
  </div>
</template>
