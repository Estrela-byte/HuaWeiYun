import { reactive } from 'vue'

export const queryStore = reactive({
  startDate: '',
  endDate: '',
  timezone: 'Asia/Shanghai',
  granularity: 'month',
  comparison: 'previous_period',
  set(patch) { Object.assign(this, patch) },
  reset(period) {
    Object.assign(this, { timezone: 'Asia/Shanghai', granularity: 'month', comparison: 'previous_period', ...period })
  },
})