import { ApiError, createApiClient } from './client.js'

export { ApiError, createApiClient }

function id(value) {
  if (value === undefined || value === null || !String(value).trim() || ['.', '..'].includes(String(value))) {
    throw new ApiError('A nonempty resource identifier is required.', { code: 'INVALID_REQUEST' })
  }
  return encodeURIComponent(String(value))
}

/**
 * Proposed API facade. This constructs methods only; no requests are made on startup.
 * Every method returns the complete { data, meta } envelope.
 * @param {import('./contracts').ApiClient} client
 * @returns {import('./contracts').SmeApi}
 */
export function createSmeApi(client) {
  const get = (path, query, options) => client.request(path, { ...options, method: 'GET', query })
  const send = (method, path, body, options) => client.request(path, { ...options, method, body })
  const post = (path, body, options) => send('POST', path, body, options)
  const patch = (path, body, options) => send('PATCH', path, body, options)
  const remove = (path, body, options) => send('DELETE', path, body, options)
  const account = (options, auth = true) => ({ ...options, business: false, auth })

  return {
    auth: {
      me: (options) => get('/auth/me', undefined, account(options)),
      login: (payload, options) => post('/auth/session', payload, account(options, false)),
      session: (options) => get('/auth/session', undefined, account(options)),
      logout: (options) => remove('/auth/session', undefined, account(options)),
    },
    business: {
      getProfile: (options) => get('/business/profile', undefined, options),
      createProfile: (payload, options) => post('/business/profile', payload, account(options)),
      updateProfile: (payload, options) => patch('/business/profile', payload, options),
    },
    imports: {
      create: (formData, options) => post('/imports', formData, options),
      list: (query, options) => get('/imports', query, options),
      get: (importId, options) => get(`/imports/${id(importId)}`, undefined, options),
      rows: (importId, query, options) => get(`/imports/${id(importId)}/rows`, query, options),
      mapFields: (importId, payload, options) => patch(`/imports/${id(importId)}/mapping`, payload, options),
      updateRow: (importId, rowId, payload, options) => patch(`/imports/${id(importId)}/rows/${id(rowId)}`, payload, options),
      commit: (importId, payload, options) => post(`/imports/${id(importId)}/commit`, payload, options),
      cancel: (importId, options) => post(`/imports/${id(importId)}/cancel`, {}, options),
    },
    transactions: {
      list: (query, options) => get('/transactions', query, options),
      get: (transactionId, options) => get(`/transactions/${id(transactionId)}`, undefined, options),
      create: (payload, options) => post('/transactions', payload, options),
      update: (transactionId, payload, options) => patch(`/transactions/${id(transactionId)}`, payload, options),
      void: (transactionId, payload, options) => post(`/transactions/${id(transactionId)}/void`, payload, options),
      bulkCategory: (payload, options) => patch('/transactions/bulk-category', payload, options),
    },
    categories: {
      list: (query, options) => get('/categories', query, options),
      create: (payload, options) => post('/categories', payload, options),
      update: (categoryId, payload, options) => patch(`/categories/${id(categoryId)}`, payload, options),
      archive: (categoryId, options) => post(`/categories/${id(categoryId)}/archive`, {}, options),
    },
    products: {
      list: (query, options) => get('/products', query, options),
      get: (productId, options) => get(`/products/${id(productId)}`, undefined, options),
      create: (payload, options) => post('/products', payload, options),
      update: (productId, payload, options) => patch(`/products/${id(productId)}`, payload, options),
      archive: (productId, options) => post(`/products/${id(productId)}/archive`, {}, options),
    },
    costAllocations: {
      list: (query, options) => get('/cost-allocations', query, options),
      get: (allocationId, options) => get(`/cost-allocations/${id(allocationId)}`, undefined, options),
      create: (payload, options) => post('/cost-allocations', payload, options),
      update: (allocationId, payload, options) => patch(`/cost-allocations/${id(allocationId)}`, payload, options),
      void: (allocationId, payload, options) => post(`/cost-allocations/${id(allocationId)}/void`, payload, options),
    },
    analytics: {
      summary: (query, options) => get('/analytics/summary', query, options),
      trends: (query, options) => get('/analytics/trends', query, options),
      costStructure: (query, options) => get('/analytics/cost-structure', query, options),
      comparisons: (query, options) => get('/analytics/comparisons', query, options),
      evidence: (evidenceId, query, options) => get(`/analytics/evidence/${id(evidenceId)}`, query, options),
    },
    assistant: {
      conversations: (query, options) => get('/assistant/conversations', query, options),
      createConversation: (payload, options) => post('/assistant/conversations', payload, options),
      messages: (conversationId, query, options) => get(`/assistant/conversations/${id(conversationId)}/messages`, query, options),
      sendMessage: (conversationId, payload, options) => post(`/assistant/conversations/${id(conversationId)}/messages`, payload, options),
      getMessage: (conversationId, messageId, options) => get(`/assistant/conversations/${id(conversationId)}/messages/${id(messageId)}`, undefined, options),
      cancelMessage: (conversationId, messageId, options) => post(`/assistant/conversations/${id(conversationId)}/messages/${id(messageId)}/cancel`, {}, options),
    },
    // OCR, proactive alerts and advanced administration are report phase-two reservations.
    receipts: {
      create: (formData, options) => post('/receipts', formData, options),
      get: (receiptId, options) => get(`/receipts/${id(receiptId)}`, undefined, options),
      update: (receiptId, payload, options) => patch(`/receipts/${id(receiptId)}`, payload, options),
      recognize: (receiptId, payload, options) => post(`/receipts/${id(receiptId)}/recognize`, payload, options),
      confirm: (receiptId, payload, options) => post(`/receipts/${id(receiptId)}/confirm`, payload, options),
    },
    alerts: {
      list: (query, options) => get('/alerts', query, options),
      get: (alertId, options) => get(`/alerts/${id(alertId)}`, undefined, options),
      read: (alertId, options) => post(`/alerts/${id(alertId)}/read`, {}, options),
      resolve: (alertId, payload, options) => post(`/alerts/${id(alertId)}/resolve`, payload, options),
      ignore: (alertId, payload, options) => post(`/alerts/${id(alertId)}/ignore`, payload, options),
      reopen: (alertId, options) => post(`/alerts/${id(alertId)}/reopen`, {}, options),
      rules: (query, options) => get('/alert-rules', query, options),
      createRule: (payload, options) => post('/alert-rules', payload, options),
      updateRule: (ruleId, payload, options) => patch(`/alert-rules/${id(ruleId)}`, payload, options),
    },
    members: {
      list: (query, options) => get('/members', query, options),
      invite: (payload, options) => post('/members/invitations', payload, options),
      update: (memberId, payload, options) => patch(`/members/${id(memberId)}`, payload, options),
      remove: (memberId, payload, options) => remove(`/members/${id(memberId)}`, payload, options),
      revokeInvitation: (invitationId, options) => remove(`/members/invitations/${id(invitationId)}`, undefined, options),
    },
    backups: {
      list: (query, options) => get('/backups', query, options),
      create: (payload, options) => post('/backups', payload, options),
      previewRestore: (backupId, payload, options) => post(`/backups/${id(backupId)}/restore-preview`, payload, options),
      // Restoration remains explicitly user-triggered; creation does not prove recoverability.
      restore: (backupId, payload, options) => post(`/backups/${id(backupId)}/restore`, payload, options),
    },
    exports: {
      create: (payload, options) => post('/exports', payload, options),
      get: (exportId, options) => get(`/exports/${id(exportId)}`, undefined, options),
      getDownload: (exportId, options) => get(`/exports/${id(exportId)}/download`, undefined, options),
    },
    dataDeletion: {
      preview: (payload, options) => post('/data-deletions/preview', payload, options),
      create: (payload, options) => post('/data-deletions', payload, options),
      get: (deletionId, options) => get(`/data-deletions/${id(deletionId)}`, undefined, options),
    },
    jobs: { get: (jobId, options) => get(`/jobs/${id(jobId)}`, undefined, options) },
    audit: { list: (query, options) => get('/audit-logs', query, options) },
  }
}
