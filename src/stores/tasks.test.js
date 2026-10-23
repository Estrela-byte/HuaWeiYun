import test from 'node:test'
import assert from 'node:assert/strict'
import { taskStore } from './tasks.js'

test('taskStore set and remove manage tasks', () => {
  taskStore.clear()
  taskStore.set('job1', { id: 'job1', status: 'running' })
  assert.ok(taskStore.tasks.job1)
  taskStore.remove('job1')
  assert.equal(taskStore.tasks.job1, undefined)
})

test('taskStore active filters terminal statuses', () => {
  taskStore.clear()
  taskStore.set('j1', { id: 'j1', status: 'running' })
  taskStore.set('j2', { id: 'j2', status: 'succeeded' })
  taskStore.set('j3', { id: 'j3', status: 'queued' })
  const active = taskStore.active()
  assert.equal(active.length, 2)
  assert.ok(active.some(t => t.id === 'j1'))
  assert.ok(active.some(t => t.id === 'j3'))
})

test('taskStore clear empties all tasks', () => {
  taskStore.set('j1', { id: 'j1', status: 'running' })
  taskStore.clear()
  assert.equal(Object.keys(taskStore.tasks).length, 0)
})