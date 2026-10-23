import { reactive } from 'vue'

const terminalStatuses = new Set(['succeeded', 'failed', 'cancelled'])

export const taskStore = reactive({
  tasks: {},
  set(id, task) { this.tasks[id] = task },
  remove(id) { delete this.tasks[id] },
  clear() { this.tasks = {} },
  active() { return Object.values(this.tasks).filter(task => task && !terminalStatuses.has(task.status)) },
})