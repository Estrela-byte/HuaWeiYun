<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { createApiClient, createSmeApi } from './services/api/index.js'
import { createDemoFetch } from './services/demo/index.js'
import { currentShanghaiMonth, monthPeriod, pathForPage, queryFromSearch, resolvePage, searchForQuery } from './app/navigation.js'
import { capabilitiesFromProfile } from './app/profile.js'
import { errorText } from './domain/navigation.js'
import AppShell from './components/AppShell.vue'
import LandingView from './views/LandingView.vue'
import LoginView from './views/LoginView.vue'
import OnboardingView from './views/OnboardingView.vue'
import OverviewView from './views/OverviewView.vue'
import IngestionView from './views/IngestionView.vue'
import LedgerView from './views/LedgerView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import AssistantView from './views/AssistantView.vue'
import AlertsView from './views/AlertsView.vue'
import SettingsView from './views/SettingsView.vue'
import ReceiptView from './views/ReceiptView.vue'

const apiMode = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'demo'
const demoMode = apiMode === 'demo'
const fallbackMonth = demoMode ? '2026-06' : currentShanghaiMonth()
const initialRoute = resolvePage(window.location.pathname)
const currentPage = ref(initialRoute.page)
const receiptId = ref(initialRoute.receiptId)
const redirectTarget = ref('overview')
const query = ref(queryFromSearch(window.location.search, fallbackMonth))
const selectedBusinessId = ref(demoMode ? 'demo-business' : null)
const accessToken = ref(null)
const businessProfile = ref(null)
const bootstrapState = ref('loading')
const bootstrapError = ref('')

// Backend authentication may use a same-origin session cookie. If the team chooses
// bearer tokens, connect the agreed auth provider through getAccessToken here.
const client = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  fetchImpl: demoMode ? createDemoFetch() : undefined,
  getAccessToken: () => accessToken.value,
  getBusinessId: () => selectedBusinessId.value,
})
const api = createSmeApi(client)

const capabilities = ref(capabilitiesFromProfile(null))

const views = {
  overview: OverviewView,
  ingestion: IngestionView,
  ledger: LedgerView,
  analytics: AnalyticsView,
  assistant: AssistantView,
  alerts: AlertsView,
  settings: SettingsView,
  receipt: ReceiptView,
}
const currentView = computed(() => views[currentPage.value] || OverviewView)

function readLocation() {
  const route = resolvePage(window.location.pathname)
  currentPage.value = route.page
  receiptId.value = route.receiptId
  query.value = queryFromSearch(window.location.search, fallbackMonth)
}

function writeLocation(page, id = null, replace = false) {
  const path = pathForPage(page, id)
  const url = (page === 'landing' || page === 'login' || page === 'onboarding') ? path : `${path}?${searchForQuery(query.value)}`
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url)
  currentPage.value = page
  receiptId.value = id
}

function navigate(target) {
  const page = typeof target === 'string' ? target : target?.page
  const id = typeof target === 'object' ? target.receiptId : null
  if (!page) return
  try { writeLocation(page, id) } catch { return }
  window.scrollTo({ top: 0, behavior: 'auto' })
}

function updateQuery(patch) {
  if (!patch || typeof patch !== 'object') return
  const requestedMonth = patch.month || (patch.startDate && !patch.endDate ? patch.startDate.slice(0, 7) : null)
  const period = requestedMonth ? monthPeriod(requestedMonth) : null
  const { month: _month, ...updates } = patch
  const nextQuery = { ...query.value, ...(period || {}), ...updates }
  if (!nextQuery.startDate || !nextQuery.endDate || nextQuery.startDate >= nextQuery.endDate) return
  query.value = nextQuery
  const safeMonth = query.value.startDate?.slice(0, 7)
  if (monthPeriod(safeMonth) && currentPage.value !== 'landing') {
    writeLocation(currentPage.value, receiptId.value, true)
  }
}

async function onDataChanged() {
  // Keep the active form mounted so its confirmation remains visible. Views that
  // query this range will refetch; other views refetch when navigated to.
  query.value = { ...query.value }
  try {
    const response = await api.business.getProfile()
    businessProfile.value = response.data
    capabilities.value = capabilitiesFromProfile(response.data)
  } catch {
    // The active view already owns the failed write or reload message.
  }
}

function onBusinessCreated(profile) {
  selectedBusinessId.value = profile.id
  businessProfile.value = profile
  capabilities.value = capabilitiesFromProfile(profile)
  bootstrapState.value = 'ready'
  bootstrapError.value = ''
}

async function bootstrap() {
  bootstrapState.value = 'loading'
  bootstrapError.value = ''
  try {
    const session = await api.auth.me()
    if (!session.data?.businessIds?.length) {
      navigate('onboarding')
      return
    }
    if (!selectedBusinessId.value) selectedBusinessId.value = session.data.businessIds[0]
    const response = await api.business.getProfile()
    businessProfile.value = response.data
    capabilities.value = capabilitiesFromProfile(response.data)
    bootstrapState.value = 'ready'
  } catch (error) {
    if (error?.status === 401 || error?.code === 'HTTP_401') {
      if (currentPage.value !== 'landing' && currentPage.value !== 'login') redirectTarget.value = currentPage.value
      navigate('login')
      return
    }
    bootstrapState.value = 'error'
    bootstrapError.value = errorText(error) || '无法读取经营主体，请检查接口连接。'
  }
}
function onAuthenticated() { bootstrap() }

onMounted(() => {
  window.addEventListener('popstate', readLocation)
  bootstrap()
})
onUnmounted(() => window.removeEventListener('popstate', readLocation))
</script>

<template>
  <LandingView v-if="currentPage === 'landing'" :api-mode="apiMode" @navigate="navigate" />
  <LoginView v-else-if="currentPage === 'login'" :api="api" :redirect-page="redirectTarget" @navigate="navigate" @authenticated="onAuthenticated" />
  <OnboardingView v-else-if="currentPage === 'onboarding'" :api="api" @navigate="navigate" @created="onBusinessCreated" />
  <AppShell
    v-else
    :current-page="currentPage"
    :query="query"
    :business-profile="businessProfile"
    :api-mode="apiMode"
    @navigate="navigate"
    @query-change="updateQuery"
  >
    <div v-if="bootstrapState === 'loading'" class="boot-state" role="status">正在读取经营主体…</div>
    <div v-else-if="bootstrapState === 'error'" class="boot-state boot-state--error" role="alert">
      <p>{{ bootstrapError }}</p>
      <button class="button" type="button" @click="bootstrap">重试连接</button>
    </div>
    <component
      :is="currentView"
      v-else
      :key="`${currentPage}-${receiptId ?? ''}`"
      :api="api"
      :query="query"
      :capabilities="capabilities"
      :api-mode="apiMode"
      :receipt-id="receiptId"
      @navigate="navigate"
      @query-change="updateQuery"
      @data-changed="onDataChanged"
    />
  </AppShell>
</template>
