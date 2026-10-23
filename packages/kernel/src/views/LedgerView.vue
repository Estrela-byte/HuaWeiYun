<script setup>
import { computed, ref, watch } from 'vue'
import UiState from '../components/UiState.vue'
import { asItems, createIdempotencyIntent, errorText, formatAmountMinor, newIdempotencyKey, statusLabel, yuanToMinor } from '../domain/navigation.js'
import { businessToday } from '../app/navigation.js'

const props = defineProps({ api: { type: Object, required: true }, query: { type: Object, required: true }, capabilities: { type: Object, default: () => ({}) }, apiMode: { type: String, default: '' } })
const emit = defineEmits(['navigate', 'data-changed', 'query-change'])
const tab = ref('transactions')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const transactions = ref([])
const nextCursor = ref(null)
const cursor = ref(null)
const cursorStack = ref([])
const categories = ref([])
const products = ref([])
const allocations = ref([])
const selected = ref([])
const bulkCategoryId = ref('')
const active = ref(null)
const showForm = ref(false)
const voidReason = ref('')
const filter = ref({ search: '', direction: '', status: 'posted' })
const amountYuan = ref('')
const form = ref(freshTransaction())
const categoryForm = ref({ name: '', direction: 'outflow', metricRole: 'operating_expense' })
const productForm = ref({ name: '', sku: '', priceYuan: '', costYuan: '' })
const allocationForm = ref({ name: '', amountYuan: '', categoryId: '', periodStart: '', periodEnd: '', sourceTransactionId: '', note: '' })
const createIntent = ref({ signature: '', key: '' })
const voidIntent = createIdempotencyIntent()
const bulkCategoryIntent = createIdempotencyIntent()
const categoryIntent = createIdempotencyIntent()
const productIntent = createIdempotencyIntent()
const allocationIntent = createIdempotencyIntent()
const selectedRecords = computed(() => transactions.value.filter(item => selected.value.includes(item.id)))
function freshTransaction() { return { businessDate: businessToday(props.query.timezone || 'Asia/Shanghai'), direction: 'outflow', kind: 'expense', summary: '', categoryId: '', originalTransactionId: '', note: '' } }
function resetMessages() { error.value = ''; notice.value = '' }
function queryForTransactions() {
  return { startDate: props.query.startDate || undefined, endDate: props.query.endDate || undefined, search: filter.value.search || undefined, direction: filter.value.direction || undefined, status: filter.value.status || undefined, cursor: cursor.value || undefined, limit: 20, sort: '-businessDate' }
}
async function loadTransactions() {
  loading.value = true; error.value = ''
  try { const result = await props.api.transactions.list(queryForTransactions()); transactions.value = asItems(result.data); nextCursor.value = result.data?.nextCursor || null; selected.value = [] }
  catch (cause) { error.value = errorText(cause); transactions.value = [] }
  finally { loading.value = false }
}
async function loadCategories() {
  try { categories.value = asItems((await props.api.categories.list({ limit: 100 })).data) }
  catch (cause) { if (tab.value === 'categories') error.value = errorText(cause) }
}
async function loadTab() {
  resetMessages(); loading.value = true
  try {
    if (tab.value === 'transactions') { await loadTransactions(); await loadCategories() }
    if (tab.value === 'categories') await loadCategories()
    if (tab.value === 'products') products.value = asItems((await props.api.products.list({ limit: 100 })).data)
    if (tab.value === 'costs') { allocations.value = asItems((await props.api.costAllocations.list({ limit: 100 })).data); await loadCategories() }
  } catch (cause) { error.value = errorText(cause) }
  finally { loading.value = false }
}
function chooseTab(value) { tab.value = value; loadTab() }
function applyFilter() { cursor.value = null; cursorStack.value = []; loadTransactions() }
function nextPage() { if (!nextCursor.value) return; cursorStack.value.push(cursor.value); cursor.value = nextCursor.value; loadTransactions() }
function previousPage() { if (!cursorStack.value.length) return; cursor.value = cursorStack.value.pop(); loadTransactions() }
function openCreate() { active.value = null; form.value = freshTransaction(); amountYuan.value = ''; showForm.value = true; resetMessages() }
function openEdit(record) {
  active.value = record
  form.value = { businessDate: record.businessDate, direction: record.direction, kind: record.kind, summary: record.summary, categoryId: record.categoryId || '', originalTransactionId: record.originalTransactionId || '', note: record.note || '' }
  amountYuan.value = record.amountMinor ? `${BigInt(record.amountMinor) / 100n}.${String(BigInt(record.amountMinor) % 100n).padStart(2, '0')}` : ''
  showForm.value = true
  resetMessages()
}
async function saveTransaction() {
  if (saving.value) return
  const amountMinor = yuanToMinor(amountYuan.value)
  if (!amountMinor) { error.value = '金额必须大于 0，最多保留两位小数。'; return }
  if (!form.value.businessDate || !form.value.summary.trim()) { error.value = '日期和摘要均为必填。'; return }
  if (form.value.kind === 'refund' && !form.value.originalTransactionId.trim()) { error.value = '退款必须填写已入账的原流水 ID。'; return }
  saving.value = true; resetMessages()
  const payload = { ...form.value, originalTransactionId: form.value.originalTransactionId || undefined, categoryId: form.value.categoryId || null, amountMinor, currency: 'CNY' }
  try {
    const signature = JSON.stringify(payload)
    if (!active.value && createIntent.value.signature !== signature) createIntent.value = { signature, key: newIdempotencyKey() }
    const result = active.value
      ? await props.api.transactions.update(active.value.id, payload, { revision: active.value.revision })
      : await props.api.transactions.create(payload, { idempotencyKey: createIntent.value.key })
    createIntent.value = { signature: '', key: '' }
    showForm.value = false; active.value = null
    notice.value = '流水已保存。'
    emit('data-changed', result.meta)
    await loadTransactions()
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function voidTransaction() {
  if (!active.value || !voidReason.value.trim() || saving.value) return
  saving.value = true; resetMessages()
  try {
    const payload = { reason: voidReason.value.trim() }
    const intent = { id: active.value.id, revision: active.value.revision, payload }
    const result = await props.api.transactions.void(active.value.id, payload, { revision: active.value.revision, idempotencyKey: voidIntent.keyFor(intent) })
    voidIntent.clear()
    active.value = null; showForm.value = false; voidReason.value = ''; notice.value = '流水已作废，历史来源仍保留。'
    emit('data-changed', result.meta); await loadTransactions()
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function applyBulkCategory() {
  if (!bulkCategoryId.value || !selectedRecords.value.length || saving.value) return
  saving.value = true; resetMessages()
  try {
    const payload = { items: selectedRecords.value.map(item => ({ id: item.id, revision: item.revision })), categoryId: bulkCategoryId.value }
    const result = await props.api.transactions.bulkCategory(payload, { idempotencyKey: bulkCategoryIntent.keyFor(payload) })
    bulkCategoryIntent.clear()
    const items = result.data?.items || []
    notice.value = `分类更新：成功 ${items.filter(item => item.status === 'updated').length} 笔，失败 ${items.filter(item => item.status === 'failed').length} 笔。`
    emit('data-changed', result.meta); await loadTransactions()
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function saveCategory() {
  if (!categoryForm.value.name.trim() || saving.value) return
  saving.value = true; resetMessages()
  try {
    const payload = { ...categoryForm.value, name: categoryForm.value.name.trim() }
    const result = await props.api.categories.create(payload, { idempotencyKey: categoryIntent.keyFor(payload) })
    categoryIntent.clear()
    categoryForm.value.name = ''; notice.value = '分类已创建。'; emit('data-changed', result.meta); await loadCategories()
  }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function saveProduct() {
  if (saving.value) return
  const priceMinor = yuanToMinor(productForm.value.priceYuan)
  const costMinor = yuanToMinor(productForm.value.costYuan)
  if (!productForm.value.name.trim() || !priceMinor || !costMinor) { error.value = '请填写商品名称，以及大于 0 的参考售价和成本。'; return }
  saving.value = true; resetMessages()
  try {
    const payload = { name: productForm.value.name.trim(), sku: productForm.value.sku || undefined, priceMinor, costMinor, currency: 'CNY' }
    const result = await props.api.products.create(payload, { idempotencyKey: productIntent.keyFor(payload) })
    productIntent.clear()
    productForm.value = { name: '', sku: '', priceYuan: '', costYuan: '' }; notice.value = '商品已创建，售价和成本是参考值。'; emit('data-changed', result.meta)
    products.value = asItems((await props.api.products.list({ limit: 100 })).data)
  }
  catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
async function saveAllocation() {
  if (saving.value) return
  const amountMinor = yuanToMinor(allocationForm.value.amountYuan)
  if (!allocationForm.value.name.trim() || !amountMinor || !allocationForm.value.categoryId || !allocationForm.value.periodStart || !allocationForm.value.periodEnd || allocationForm.value.periodStart > allocationForm.value.periodEnd) { error.value = '请填写名称、金额、分类和有效的归属期间。'; return }
  saving.value = true; resetMessages()
  try {
    const { amountYuan: ignored, ...fields } = allocationForm.value
    const payload = { ...fields, amountMinor, currency: 'CNY', sourceTransactionId: fields.sourceTransactionId || undefined }
    const result = await props.api.costAllocations.create(payload, { idempotencyKey: allocationIntent.keyFor(payload) })
    allocationIntent.clear()
    allocationForm.value = { name: '', amountYuan: '', categoryId: '', periodStart: '', periodEnd: '', sourceTransactionId: '', note: '' }
    notice.value = '成本归集已保存。'; emit('data-changed', result.meta)
    allocations.value = asItems((await props.api.costAllocations.list({ limit: 100 })).data)
  } catch (cause) { error.value = errorText(cause) }
  finally { saving.value = false }
}
watch(() => props.query, () => { cursor.value = null; cursorStack.value = []; if (tab.value === 'transactions') { loadTransactions(); loadCategories() } }, { immediate: true, deep: true })
</script>

<template>
  <div class="section-stack">
    <header class="page-header"><div><h1 class="page-title">记账管理</h1><p class="page-description">流水、分类、商品与成本归集，保持来源和版本可追溯。</p></div><button type="button" class="button button--primary" @click="chooseTab('transactions'); openCreate()">+ 手工记一笔</button></header>
    <div role="tablist" class="tab-list" aria-label="记账内容"><button v-for="item in [{ key: 'transactions', label: '流水' }, { key: 'categories', label: '分类' }, { key: 'products', label: '商品' }, { key: 'costs', label: '成本归集' }]" :key="item.key" class="tab" role="tab" type="button" :aria-selected="tab === item.key" @click="chooseTab(item.key)">{{ item.label }}</button></div>
    <div v-if="error" class="inline-message inline-message--error" role="alert">{{ error }}</div><div v-if="notice" class="inline-message inline-message--success" role="status">{{ notice }}</div>
    <template v-if="tab === 'transactions'">
      <section class="card"><div class="toolbar"><label class="field" style="flex: 2; min-width: 190px">搜索摘要<input v-model.trim="filter.search" class="field-control" type="search" placeholder="输入关键词" @keydown.enter="applyFilter"></label><label class="field" style="min-width: 125px">收支<select v-model="filter.direction" class="field-control" @change="applyFilter"><option value="">全部</option><option value="inflow">收入</option><option value="outflow">支出</option></select></label><label class="field" style="min-width: 125px">状态<select v-model="filter.status" class="field-control" @change="applyFilter"><option value="posted">正常</option><option value="voided">已作废</option></select></label><button type="button" class="button" style="align-self: end" @click="applyFilter">查询</button></div></section>
      <section class="card"><div class="section-heading"><h2>流水明细</h2><span class="subtle">金额、来源、分类均以服务端记录为准</span></div><UiState v-if="loading" kind="loading" /><UiState v-else-if="!transactions.length" title="该范围内暂无流水" description="可以调整筛选条件，或手工录入一笔。" /><template v-else><div class="table-scroll"><table class="data-table"><thead><tr><th><span class="visually-hidden">选择</span></th><th>日期</th><th>摘要</th><th>分类</th><th>来源</th><th class="numeric">金额</th><th class="actions">操作</th></tr></thead><tbody><tr v-for="item in transactions" :key="item.id"><td><input v-model="selected" type="checkbox" :value="item.id" :aria-label="`选择 ${item.summary}`" :disabled="item.status === 'voided'"></td><td>{{ item.businessDate }}</td><td>{{ item.summary }}</td><td>{{ categories.find(category => category.id === item.categoryId)?.name || (item.categoryId ? item.categoryId : '未分类') }}</td><td><span class="badge" :class="item.source?.platform === 'manual' ? 'badge--mint' : ''">{{ statusLabel(item.source?.platform) }}</span></td><td class="numeric">{{ item.direction === 'outflow' ? '−' : '+' }}{{ formatAmountMinor(item.amountMinor) }}</td><td class="actions"><button type="button" class="button button--small" @click="openEdit(item)">详情 / 编辑</button></td></tr></tbody></table></div><div class="table-footer"><span>当前页 {{ transactions.length }} 笔</span><div class="toolbar"><button type="button" class="button button--small" :disabled="!cursorStack.length" @click="previousPage">上一页</button><button type="button" class="button button--small" :disabled="!nextCursor" @click="nextPage">下一页</button></div></div></template></section>
      <section v-if="selectedRecords.length" class="card"><h2 class="card-title">批量分类 · 已选择 {{ selectedRecords.length }} 笔</h2><div class="toolbar"><select v-model="bulkCategoryId" class="field-control" style="max-width: 250px"><option value="">选择分类</option><option v-for="category in categories.filter(value => !value.archived)" :key="category.id" :value="category.id">{{ category.name }}</option></select><button type="button" class="button button--primary" :disabled="!bulkCategoryId || saving" @click="applyBulkCategory">更新选中流水</button></div></section>
      <section v-if="showForm" class="card">
        <div class="section-heading"><h2>{{ active ? '流水详情与编辑' : '手工录入' }}</h2><button type="button" class="button button--small" @click="showForm = false">关闭</button></div>
        <div v-if="active" class="inline-message">来源：{{ statusLabel(active.source?.platform) }} · 记录版本：{{ active.revision }} · 记录 ID：{{ active.id }}</div>
        <form @submit.prevent="saveTransaction">
          <div class="field-row">
            <label class="field">业务日期<input v-model="form.businessDate" type="date" class="field-control" required></label>
            <label class="field">金额（元）<input v-model="amountYuan" class="field-control" inputmode="decimal" placeholder="128.50" required></label>
            <label class="field">方向<select v-model="form.direction" class="field-control"><option value="inflow">收入</option><option value="outflow">支出</option></select></label>
            <label class="field">业务类型<select v-model="form.kind" class="field-control">
              <option value="sale">销售</option><option value="expense">经营支出</option><option value="refund">退款</option><option value="transfer">转账</option>
              <option value="settlement">结算</option><option value="loan">借款</option><option value="owner_contribution">业主投入</option><option value="other">其他</option>
            </select></label>
            <label class="field">分类<select v-model="form.categoryId" class="field-control"><option value="">暂不分类</option><option v-for="category in categories.filter(value => !value.archived && (form.kind === 'refund' || value.direction === form.direction))" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
            <label class="field">摘要<input v-model.trim="form.summary" class="field-control" required></label>
            <label v-if="form.kind === 'refund'" class="field">原流水 ID<input v-model.trim="form.originalTransactionId" class="field-control" placeholder="对应已入账销售或支出流水" required></label>
          </div>
          <label class="field" style="margin-top: 12px">备注<textarea v-model="form.note" class="field-control" rows="2"></textarea></label>
          <p v-if="form.kind === 'refund'" class="subtle">退款按原流水冲减经营指标，分类需沿用原流水。</p>
          <div class="form-actions"><button class="button button--primary" type="submit" :disabled="saving || active?.status === 'voided'">{{ saving ? '保存中…' : '保存流水' }}</button></div>
        </form>
        <div v-if="active && active.status !== 'voided'" class="toolbar" style="padding-top: 18px; border-top: 1px solid var(--border)">
          <label class="field" style="flex: 1">作废原因<input v-model.trim="voidReason" class="field-control" placeholder="请填写作废原因"></label>
          <button class="button button--danger" type="button" :disabled="!voidReason || saving" style="align-self: end" @click="voidTransaction">作废这笔流水</button>
        </div>
      </section>
    </template>
    <template v-if="tab === 'categories'"><section class="card"><h2 class="card-title">新增分类</h2><form class="field-row" @submit.prevent="saveCategory"><label class="field">分类名称<input v-model.trim="categoryForm.name" class="field-control" required></label><label class="field">方向<select v-model="categoryForm.direction" class="field-control"><option value="inflow">收入</option><option value="outflow">支出</option></select></label><label class="field">指标角色<input v-model.trim="categoryForm.metricRole" class="field-control" required placeholder="由队友约定的 metricRole"></label><div class="form-actions" style="align-items: end"><button class="button button--primary" type="submit" :disabled="saving">保存分类</button></div></form></section><section class="card"><h2 class="card-title">分类列表</h2><UiState v-if="loading" kind="loading" /><UiState v-else-if="!categories.length" title="暂无分类" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>名称</th><th>方向</th><th>指标角色</th><th>状态</th></tr></thead><tbody><tr v-for="item in categories" :key="item.id"><td>{{ item.name }}</td><td>{{ item.direction === 'inflow' ? '收入' : '支出' }}</td><td>{{ item.metricRole }}</td><td>{{ item.archived ? '已归档' : '启用' }}</td></tr></tbody></table></div></section></template>
    <template v-if="tab === 'products'"><div class="phase-note">商品售价与成本仅用于参考单件毛利；期间利润需要真实销售与成本归属数据。</div><section class="card"><h2 class="card-title">新增商品或服务</h2><form class="field-row" @submit.prevent="saveProduct"><label class="field">名称<input v-model.trim="productForm.name" class="field-control" required></label><label class="field">SKU（可选）<input v-model.trim="productForm.sku" class="field-control"></label><label class="field">参考售价（元）<input v-model="productForm.priceYuan" class="field-control" inputmode="decimal" required></label><label class="field">参考成本（元）<input v-model="productForm.costYuan" class="field-control" inputmode="decimal" required></label><div class="form-actions"><button class="button button--primary" type="submit" :disabled="saving">保存商品</button></div></form></section><section class="card"><h2 class="card-title">商品列表</h2><UiState v-if="loading" kind="loading" /><UiState v-else-if="!products.length" title="暂无商品" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>名称</th><th>SKU</th><th class="numeric">参考售价</th><th class="numeric">参考成本</th><th>状态</th></tr></thead><tbody><tr v-for="item in products" :key="item.id"><td>{{ item.name }}</td><td>{{ item.sku || '—' }}</td><td class="numeric">{{ formatAmountMinor(item.priceMinor) }}</td><td class="numeric">{{ formatAmountMinor(item.costMinor) }}</td><td>{{ item.archived ? '已归档' : '启用' }}</td></tr></tbody></table></div></section></template>
    <template v-if="tab === 'costs'"><div class="phase-note">成本归集需说明归属期间。关联原流水时，后端应避免同一支出重复计入指标。</div><section class="card"><h2 class="card-title">新增成本归集</h2><form class="field-row" @submit.prevent="saveAllocation"><label class="field">成本名称<input v-model.trim="allocationForm.name" class="field-control" required></label><label class="field">金额（元）<input v-model="allocationForm.amountYuan" class="field-control" inputmode="decimal" required></label><label class="field">分类<select v-model="allocationForm.categoryId" class="field-control" required><option value="">选择分类</option><option v-for="item in categories.filter(value => value.direction === 'outflow' && !value.archived)" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label class="field">关联流水 ID（可选）<input v-model.trim="allocationForm.sourceTransactionId" class="field-control"></label><label class="field">归属开始日期<input v-model="allocationForm.periodStart" type="date" class="field-control" required></label><label class="field">归属结束日期<input v-model="allocationForm.periodEnd" type="date" class="field-control" required></label></form><label class="field" style="margin-top: 12px">备注<input v-model.trim="allocationForm.note" class="field-control"></label><div class="form-actions"><button class="button button--primary" type="button" :disabled="saving" @click="saveAllocation">保存成本归集</button></div></section><section class="card"><h2 class="card-title">归集记录</h2><UiState v-if="loading" kind="loading" /><UiState v-else-if="!allocations.length" title="暂无归集记录" /><div v-else class="table-scroll"><table class="data-table"><thead><tr><th>名称</th><th>期间</th><th>分类</th><th>来源流水</th><th class="numeric">金额</th></tr></thead><tbody><tr v-for="item in allocations" :key="item.id"><td>{{ item.name }}</td><td>{{ item.periodStart }} — {{ item.periodEnd }}</td><td>{{ categories.find(category => category.id === item.categoryId)?.name || item.categoryId }}</td><td>{{ item.sourceTransactionId || '—' }}</td><td class="numeric">{{ formatAmountMinor(item.amountMinor) }}</td></tr></tbody></table></div></section></template>
  </div>
</template>
