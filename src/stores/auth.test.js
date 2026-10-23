import test from 'node:test'
import assert from 'node:assert/strict'
import { authStore } from './auth.js'

test('authStore setSession stores user and permissions', () => {
  authStore.setSession({ id: 'u1', displayName: 'Test', permissions: ['read', 'write'] })
  assert.equal(authStore.user.id, 'u1')
  assert.deepEqual(authStore.permissions, ['read', 'write'])
})

test('authStore setBusinessId and setBusinessProfile update fields', () => {
  authStore.setBusinessId('b1')
  authStore.setBusinessProfile({ id: 'b1', name: 'Shop' })
  assert.equal(authStore.businessId, 'b1')
  assert.equal(authStore.businessProfile.name, 'Shop')
})

test('authStore clear resets all fields', () => {
  authStore.setSession({ id: 'u1', displayName: 'Test', permissions: ['read'] })
  authStore.setBusinessId('b1')
  authStore.clear()
  assert.equal(authStore.user, null)
  assert.equal(authStore.businessId, null)
  assert.equal(authStore.businessProfile, null)
  assert.deepEqual(authStore.permissions, [])
})