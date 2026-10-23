import { reactive } from 'vue'

export const authStore = reactive({
  user: null,
  businessId: null,
  businessProfile: null,
  permissions: [],
  setSession(user) { this.user = user; this.permissions = user?.permissions || [] },
  setBusinessId(id) { this.businessId = id },
  setBusinessProfile(profile) { this.businessProfile = profile },
  clear() { this.user = null; this.businessId = null; this.businessProfile = null; this.permissions = [] },
})