import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApiClient, createSmeApi } from '../api/index.js'
import { createDemoFetch } from './index.js'

const june = { startDate: '2026-06-01', endDate: '2026-07-01', timezone: 'Asia/Shanghai', granularity: 'month', comparison: 'previous_period' }
const may = { ...june, startDate: '2026-05-01', endDate: '2026-06-01' }

function api(businessId = 'demo-business', fetchImpl = createDemoFetch()) {
  return createSmeApi(createApiClient({ fetchImpl, getBusinessId: () => businessId, getAccessToken: () => null }))
}
function values(summary) { return Object.fromEntries(summary.data.metrics.map((item) => [item.id, item.value])) }

test('May and June operating metrics reconcile to one ledger and the 36.0% display rate', async () => {
  const client = api()
  assert.deepEqual(values(await client.analytics.summary(june)), {
    sales_revenue: '12840000', operating_expense: '8215000', operating_surplus: '4625000', operating_surplus_rate: '0.3602',
  })
  assert.deepEqual(values(await client.analytics.summary(may)), {
    sales_revenue: '13520000', operating_expense: '8233680', operating_surplus: '5286320', operating_surplus_rate: '0.3910',
  })
  const structure = await client.analytics.costStructure(june)
  assert.equal(structure.data.totalMinor, '8215000')
  assert.deepEqual(Object.fromEntries(structure.data.items.map((item) => [item.categoryId, item.amountMinor])), {
    cat_materials: '3690000', cat_labor: '2200000', cat_rent: '1480000', cat_other: '845000',
  })
  const comparisons = await client.analytics.comparisons(june)
  const surplus = comparisons.data.find((item) => item.metricId === 'operating_surplus')
  assert.equal(surplus.absoluteChange, '-661320')
  assert.equal(comparisons.data.find((item) => item.metricId === 'operating_surplus_rate').percentagePointChange, '-3.1')
})

test('transfer is visible in the ledger but never counted as operating revenue or expense', async () => {
  const client = api()
  const transfer = await client.transactions.list({ kind: 'transfer', startDate: june.startDate, endDate: june.endDate })
  assert.equal(transfer.data.total, 1)
  assert.equal(transfer.data.items[0].amountMinor, '500000')
  const summary = await client.analytics.summary(june)
  assert.equal(values(summary).sales_revenue, '12840000')
  assert.equal(values(summary).operating_expense, '8215000')
})

test('manual create and edit update the data version, ledger and derived metrics', async () => {
  const client = api()
  const before = await client.analytics.summary(june)
  const created = await client.transactions.create({ businessDate: '2026-06-18', direction: 'inflow', kind: 'sale', amountMinor: '10000', currency: 'CNY', categoryId: 'cat_sales', summary: '新增销售' }, { idempotencyKey: 'manual-1' })
  assert.notEqual(created.meta.dataVersion, before.meta.dataVersion)
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12850000')
  const edited = await client.transactions.update(created.data.id, { amountMinor: '20000' }, { revision: created.data.revision })
  assert.equal(edited.data.revision, '2')
  assert.equal(values(await client.analytics.summary(june)).operating_surplus, '4645000')
  const found = await client.transactions.get(created.data.id)
  assert.equal(found.data.amountMinor, '20000')
})

test('CSV stays in review until explicit commit; repeated key cannot post twice', async () => {
  const client = api()
  const form = new FormData()
  form.set('platform', 'wechat')
  form.set('file', new Blob(['交易时间,收支,金额(元),商品,交易单号\n2026-06-18,收入,100.00,奶茶销售,wc-demo-1\n'], { type: 'text/csv' }), 'bill.csv')
  const created = await client.imports.create(form, { idempotencyKey: 'upload-1' })
  assert.equal(created.data.status, 'review')
  assert.equal(created.data.counts.ready, 1)
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12840000')
  const rows = await client.imports.rows(created.data.id)
  const selection = rows.data.items.map((row) => ({ id: row.id, revision: row.revision }))
  const first = await client.imports.commit(created.data.id, { rows: selection }, { idempotencyKey: 'commit-1', revision: created.data.revision })
  const replay = await client.imports.commit(created.data.id, { rows: selection }, { idempotencyKey: 'commit-1', revision: created.data.revision })
  assert.equal((await client.jobs.get(first.data.id)).data.status, 'succeeded')
  assert.deepEqual(replay.data.result.postedTransactionIds, first.data.result.postedTransactionIds)
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12850000')
  const ledger = await client.transactions.list({ importId: created.data.id })
  assert.equal(ledger.data.total, 1)
  assert.equal(ledger.data.items[0].source.platform, 'wechat')
  assert.equal(ledger.data.items[0].source.sourceTransactionId, 'wc-demo-1')
})

test('OCR and backup expose unavailable instead of inventing success', async () => {
  const client = api()
  await assert.rejects(client.receipts.create(new FormData(), { idempotencyKey: 'ocr-1' }), (error) => error instanceof ApiError && error.code === 'FEATURE_NOT_AVAILABLE' && error.status === 501)
  await assert.rejects(client.backups.list(), (error) => error instanceof ApiError && error.code === 'FEATURE_NOT_AVAILABLE' && error.status === 501)
})

test('other business contexts cannot inspect the demo ledger', async () => {
  const client = api('other-business')
  await assert.rejects(client.transactions.list(), (error) => error instanceof ApiError && error.code === 'BUSINESS_FORBIDDEN' && error.status === 403)
  await assert.rejects(client.analytics.summary(june), (error) => error instanceof ApiError && error.code === 'BUSINESS_FORBIDDEN' && error.status === 403)
})

test('metric evidence excludes transfers and remains an immutable snapshot after later edits', async () => {
  const client = api()
  const first = await client.analytics.summary(june)
  const sales = first.data.metrics.find((item) => item.id === 'sales_revenue')
  const evidenceBefore = await client.analytics.evidence(sales.evidenceId)
  assert.equal(evidenceBefore.data.transactions.total, 3)
  assert.ok(evidenceBefore.data.transactions.items.every((item) => item.kind === 'sale'))
  await client.transactions.create({ businessDate: '2026-06-28', direction: 'inflow', kind: 'sale', amountMinor: '12000', currency: 'CNY', categoryId: 'cat_sales', summary: '后来补录' }, { idempotencyKey: 'later-entry' })
  const evidenceAfter = await client.analytics.evidence(sales.evidenceId)
  assert.equal(evidenceAfter.data.dataVersion, first.meta.dataVersion)
  assert.equal(evidenceAfter.data.transactions.total, 3)
})

test('one import source ID cannot be posted twice and the same upload key rejects different content', async () => {
  const client = api()
  const makeFile = (second) => {
    const form = new FormData()
    form.set('platform', 'alipay')
    form.set('file', new Blob([`日期,收支,金额(元),商品,交易单号\n2026-06-20,收入,10.00,销售,ali-1\n2026-06-21,收入,${second},销售,ali-1\n`], { type: 'text/csv' }), 'alipay.csv')
    return form
  }
  const created = await client.imports.create(makeFile('20.00'), { idempotencyKey: 'same-upload-key' })
  assert.equal(created.data.counts.duplicate, 1)
  await assert.rejects(client.imports.create(makeFile('30.00'), { idempotencyKey: 'same-upload-key' }), (error) => error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409)
  const rows = await client.imports.rows(created.data.id)
  const ready = rows.data.items.filter((row) => row.status === 'ready')
  await client.imports.commit(created.data.id, { rows: ready.map((row) => ({ id: row.id, revision: row.revision })) }, { idempotencyKey: 'source-commit', revision: created.data.revision })
  const imported = await client.transactions.list({ importId: created.data.id })
  assert.equal(imported.data.total, 1)
})

test('idempotency replay is scoped to the business header and preserves original version', async () => {
  const transport = createDemoFetch()
  const owner = api('demo-business', transport)
  const outsider = api('other-business', transport)
  const input = { businessDate: '2026-06-20', direction: 'inflow', kind: 'sale', amountMinor: '30000', currency: 'CNY', categoryId: 'cat_sales', summary: '幂等订单' }
  const first = await owner.transactions.create(input, { idempotencyKey: 'tenant-key' })
  await owner.transactions.create({ ...input, summary: '其他订单' }, { idempotencyKey: 'other-key' })
  const replay = await owner.transactions.create(input, { idempotencyKey: 'tenant-key' })
  assert.equal(replay.data.id, first.data.id)
  assert.equal(replay.meta.dataVersion, first.meta.dataVersion)
  await assert.rejects(outsider.transactions.create(input, { idempotencyKey: 'tenant-key' }), (error) => error.code === 'BUSINESS_FORBIDDEN' && error.status === 403)
})

test('all MVP maintenance resources preserve revisions and allocations do not double count costs', async () => {
  const client = api()
  const category = await client.categories.create({ name: '包装材料', direction: 'outflow', parentId: null, metricRole: 'operating_expense' }, { idempotencyKey: 'cat-create' })
  const renamed = await client.categories.update(category.data.id, { name: '包装耗材' }, { revision: category.data.revision })
  assert.equal(renamed.data.revision, '2')
  await assert.rejects(client.categories.update(category.data.id, { name: '旧表单' }, { revision: '1' }), (error) => error.code === 'REVISION_CONFLICT' && error.status === 412)
  const product = await client.products.create({ name: '招牌奶茶', priceMinor: '1800', costMinor: '700', currency: 'CNY' }, { idempotencyKey: 'product-create' })
  assert.equal((await client.products.get(product.data.id)).data.priceMinor, '1800')
  const revisedProduct = await client.products.update(product.data.id, { priceMinor: '2000' }, { revision: product.data.revision })
  assert.equal(revisedProduct.data.priceMinor, '2000')
  assert.equal((await client.products.archive(product.data.id, { idempotencyKey: 'product-archive', revision: revisedProduct.data.revision })).data.archived, true)
  const source = (await client.transactions.list({ kind: 'expense', categoryId: 'cat_materials', startDate: june.startDate, endDate: june.endDate })).data.items[0]
  const before = values(await client.analytics.summary(june))
  const allocation = await client.costAllocations.create({ name: '六月原材料归集', amountMinor: source.amountMinor, currency: 'CNY', categoryId: 'cat_materials', periodStart: june.startDate, periodEnd: '2026-06-30', sourceTransactionId: source.id }, { idempotencyKey: 'cost-create' })
  assert.equal((await client.costAllocations.get(allocation.data.id)).data.sourceTransactionId, source.id)
  assert.deepEqual(values(await client.analytics.summary(june)), before)
  assert.equal((await client.costAllocations.void(allocation.data.id, { reason: '重新归集' }, { idempotencyKey: 'cost-void', revision: allocation.data.revision })).data.status, 'voided')
  assert.equal((await client.categories.archive(category.data.id, { idempotencyKey: 'cat-archive', revision: renamed.data.revision })).data.archived, true)
})

test('trends, paged filters, assistant messages and transaction void share computed facts', async () => {
  const client = api()
  const trend = await client.analytics.trends({ ...june, startDate: '2026-05-01' })
  const sales = trend.data.find((series) => series.metricId === 'sales_revenue')
  assert.deepEqual(sales.points.map((point) => point.value), ['13520000', '12840000'])
  const pageOne = await client.transactions.list({ startDate: june.startDate, endDate: june.endDate, limit: 2 })
  const pageTwo = await client.transactions.list({ startDate: june.startDate, endDate: june.endDate, limit: 2, cursor: pageOne.data.nextCursor })
  assert.equal(pageOne.data.items.length, 2)
  assert.notEqual(pageOne.data.items[0].id, pageTwo.data.items[0].id)
  const conversation = await client.assistant.createConversation({ title: '六月经营', query: june }, { idempotencyKey: 'conversation-1' })
  const answer = await client.assistant.sendMessage(conversation.data.id, { text: '为什么经营结余下降？', query: june }, { idempotencyKey: 'message-1' })
  assert.equal(answer.data.status, 'completed')
  assert.match(answer.data.text, /经营结余/)
  assert.ok(answer.data.evidenceIds.length > 0)
  assert.equal((await client.assistant.getMessage(conversation.data.id, answer.data.id)).data.id, answer.data.id)
  assert.equal((await client.assistant.messages(conversation.data.id)).data.total, 2)
  const sale = (await client.transactions.list({ kind: 'sale', startDate: june.startDate, endDate: june.endDate })).data.items[0]
  await assert.rejects(client.transactions.void(sale.id, { reason: '重复记账' }, { idempotencyKey: 'void-no-revision' }), (error) => error.code === 'REVISION_REQUIRED' && error.status === 428)
  await client.transactions.void(sale.id, { reason: '重复记账' }, { idempotencyKey: 'void-sale', revision: sale.revision })
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, String(12840000 - Number(sale.amountMinor)))
})

test('unrecognized CSV headers can be mapped from source columns without posting during review', async () => {
  const client = api()
  const form = new FormData()
  form.set('file', new Blob(['发生日,收付,售价(元),说明字\n2026-06-25,收入,18.50,奶茶销售\n'], { type: 'text/csv' }), 'unknown.csv')
  const batch = await client.imports.create(form, { idempotencyKey: 'unknown-upload' })
  assert.ok(batch.data.detectedColumns.includes('发生日'))
  const mapped = await client.imports.mapFields(batch.data.id, { columns: { 发生日: 'businessDate', 收付: 'direction', '售价(元)': 'amountMinor', 说明字: 'summary' } }, { revision: batch.data.revision })
  assert.equal(mapped.data.counts.ready, 1)
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12840000')
  const rows = await client.imports.rows(batch.data.id)
  assert.equal(rows.data.items[0].draft.amountMinor, '1850')
})

test('imported transfer and ambiguous rows cannot silently inflate operating metrics', async () => {
  const client = api()
  const form = new FormData()
  form.set('file', new Blob([
    '日期,收支,金额(元),交易类型,商品,交易单号\n' +
    '2026-06-26,支出,500.00,transfer,账户间转账,move-1\n' +
    '2026-06-26,收入,80.00,,未知收款,unknown-1\n',
  ], { type: 'text/csv' }), 'mixed.csv')
  const batch = await client.imports.create(form, { idempotencyKey: 'mixed-upload' })
  assert.equal(batch.data.counts.ready, 1)
  assert.equal(batch.data.counts.needsReview, 1)
  const rows = (await client.imports.rows(batch.data.id)).data.items
  assert.equal(rows[0].draft.kind, 'transfer')
  assert.equal(rows[1].draft.kind, 'other')
  const committed = await client.imports.commit(batch.data.id, { rows: [{ id: rows[0].id, revision: rows[0].revision }] }, { idempotencyKey: 'mixed-commit', revision: batch.data.revision })
  assert.equal(committed.data.result.postedTransactionIds.length, 1)
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12840000')
  assert.equal(values(await client.analytics.summary(june)).operating_expense, '8215000')
  const confirmed = await client.imports.updateRow(batch.data.id, rows[1].id, { draft: { kind: 'sale', categoryId: 'cat_sales' }, kindConfirmed: true, categoryConfirmed: true }, { revision: rows[1].revision })
  assert.equal(confirmed.data.status, 'ready')
  const afterReview = await client.imports.get(batch.data.id)
  await client.imports.commit(batch.data.id, { rows: [{ id: confirmed.data.id, revision: confirmed.data.revision }] }, { idempotencyKey: 'mixed-second-commit', revision: afterReview.data.revision })
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12848000')
})

test('refund import requires a valid original transaction before it can offset revenue', async () => {
  const client = api()
  const sale = await client.transactions.create({ businessDate: '2026-06-24', direction: 'inflow', kind: 'sale', amountMinor: '10000', currency: 'CNY', categoryId: 'cat_sales', summary: '测试销售' }, { idempotencyKey: 'refund-original' })
  const form = new FormData()
  form.set('file', new Blob([
    '日期,收支,金额(元),交易类型,商品,交易单号,原流水ID\n' +
    `2026-06-25,支出,20.00,refund,订单退款,refund-1,${sale.data.id}\n`,
  ], { type: 'text/csv' }), 'refund.csv')
  const batch = await client.imports.create(form, { idempotencyKey: 'refund-upload' })
  assert.equal(batch.data.counts.needsReview, 1)
  const row = (await client.imports.rows(batch.data.id)).data.items[0]
  assert.equal(row.draft.originalTransactionId, sale.data.id)
  const reviewed = await client.imports.updateRow(batch.data.id, row.id, { kindConfirmed: true, categoryConfirmed: true }, { revision: row.revision })
  assert.equal(reviewed.data.status, 'ready')
  const current = await client.imports.get(batch.data.id)
  await client.imports.commit(batch.data.id, { rows: [{ id: reviewed.data.id, revision: reviewed.data.revision }] }, { idempotencyKey: 'refund-commit', revision: current.data.revision })
  assert.equal(values(await client.analytics.summary(june)).sales_revenue, '12848000')
  await assert.rejects(client.transactions.create({ businessDate: '2026-06-25', direction: 'outflow', kind: 'refund', amountMinor: '100', currency: 'CNY', categoryId: 'cat_sales', summary: '没有原交易的退款' }, { idempotencyKey: 'orphan-refund' }), error => error.code === 'INVALID_REFUND_LINK')
})

test('more than 100 import rows remain accessible and can be confirmed by page', async () => {
  const client = api()
  const lines = Array.from({ length: 101 }, (_, index) => `2026-06-26,收入,1.00,销售,order-${index + 1}`)
  const form = new FormData()
  form.set('file', new Blob([`日期,收支,金额(元),商品,交易单号\n${lines.join('\n')}\n`], { type: 'text/csv' }), 'many.csv')
  const batch = await client.imports.create(form, { idempotencyKey: 'many-upload' })
  assert.equal(batch.data.counts.ready, 101)
  const first = await client.imports.rows(batch.data.id, { limit: 100 })
  assert.equal(first.data.items.length, 100)
  assert.ok(first.data.nextCursor)
  const second = await client.imports.rows(batch.data.id, { limit: 100, cursor: first.data.nextCursor })
  assert.equal(second.data.items.length, 1)
  assert.equal(second.data.nextCursor, null)
  const last = second.data.items[0]
  const result = await client.imports.commit(batch.data.id, { rows: [{ id: last.id, revision: last.revision }] }, { idempotencyKey: 'many-last-commit', revision: batch.data.revision })
  assert.equal(result.data.result.postedTransactionIds.length, 1)
  assert.equal((await client.transactions.list({ importId: batch.data.id })).data.total, 1)
})

test('invalid calendar dates cannot enter the operating ledger', async () => {
  const client = api()
  await assert.rejects(client.transactions.create({ businessDate: '2026-02-31', direction: 'inflow', kind: 'sale', amountMinor: '100', currency: 'CNY', categoryId: 'cat_sales', summary: '不存在的日期' }, { idempotencyKey: 'bad-date' }), error => error.code === 'VALIDATION_ERROR')
  const form = new FormData()
  form.set('file', new Blob(['日期,收支,金额(元),商品\n2026-02-31,收入,1.00,销售\n'], { type: 'text/csv' }), 'bad-date.csv')
  const batch = await client.imports.create(form, { idempotencyKey: 'bad-date-upload' })
  assert.equal(batch.data.counts.invalid, 1)
})

test('posted import rows remain posted after remapping and cannot be edited into a second transaction', async () => {
  for (const revisit of ['mapping', 'edit']) {
    const client = api()
    const form = new FormData()
    form.set('platform', 'wechat')
    form.set('file', new Blob([
      'businessDate,direction,amount,summary,kind\n' +
      '2026-07-10,inflow,10.00,Sale,sale\n' +
      '2026-07-99,inflow,5.00,Invalid,sale\n',
    ], { type: 'text/csv' }), 'partial.csv')
    const batch = await client.imports.create(form, { idempotencyKey: `partial-upload-${revisit}` })
    const row = (await client.imports.rows(batch.data.id)).data.items.find(item => item.status === 'ready')
    assert.ok(row)
    await client.imports.commit(batch.data.id, { rows: [{ id: row.id, revision: row.revision }] }, {
      idempotencyKey: `partial-commit-${revisit}`, revision: batch.data.revision,
    })
    const current = (await client.imports.get(batch.data.id)).data
    assert.equal(current.status, 'review')
    assert.equal(current.counts.posted, 1)
    if (revisit === 'mapping') {
      const mapped = await client.imports.mapFields(batch.data.id, { columns: {} }, { revision: current.revision })
      assert.equal(mapped.data.counts.posted, 1)
    } else {
      const posted = (await client.imports.rows(batch.data.id)).data.items.find(item => item.id === row.id)
      await assert.rejects(
        client.imports.updateRow(batch.data.id, row.id, { draft: { summary: 'Changed' } }, { revision: posted.revision }),
        error => error.code === 'INVALID_IMPORT_ROW_STATE' && error.status === 409,
      )
    }
    const after = (await client.imports.get(batch.data.id)).data
    const posted = (await client.imports.rows(batch.data.id)).data.items.find(item => item.id === row.id)
    assert.equal(posted.status, 'posted')
    await client.imports.commit(batch.data.id, { rows: [{ id: posted.id, revision: posted.revision }] }, {
      idempotencyKey: `partial-replay-${revisit}`, revision: after.revision,
    })
    assert.equal((await client.transactions.list({ importId: batch.data.id })).data.total, 1)
  }
})

test('editing or voiding an original transaction cannot invalidate its posted refunds', async () => {
  const client = api()
  const sale = await client.transactions.create({ businessDate: '2026-07-10', direction: 'inflow', kind: 'sale', amountMinor: '1000', currency: 'CNY', categoryId: 'cat_sales', summary: 'Original sale' }, { idempotencyKey: 'refund-sale' })
  const refund = await client.transactions.create({ businessDate: '2026-07-11', direction: 'outflow', kind: 'refund', amountMinor: '900', currency: 'CNY', categoryId: 'cat_sales', originalTransactionId: sale.data.id, summary: 'Refund' }, { idempotencyKey: 'refund-child' })
  await assert.rejects(client.transactions.update(sale.data.id, { amountMinor: '100' }, { revision: sale.data.revision }), error => error.code === 'REFUND_EXCEEDS_ORIGINAL' && error.status === 422)
  await assert.rejects(client.transactions.update(sale.data.id, { kind: 'transfer' }, { revision: sale.data.revision }), error => error.code === 'ORIGINAL_HAS_REFUNDS' && error.status === 409)
  await assert.rejects(client.transactions.void(sale.data.id, { reason: 'void original' }, { revision: sale.data.revision, idempotencyKey: 'void-refund-original' }), error => error.code === 'ORIGINAL_HAS_REFUNDS' && error.status === 409)
  const otherIncome = await client.categories.create({ name: 'Other income', direction: 'inflow' }, { idempotencyKey: 'other-income-category' })
  await assert.rejects(client.transactions.update(sale.data.id, { categoryId: otherIncome.data.id }, { revision: sale.data.revision }), error => error.code === 'ORIGINAL_HAS_REFUNDS' && error.status === 409)
  const recategorizedSale = await client.transactions.bulkCategory({ categoryId: otherIncome.data.id, items: [{ id: sale.data.id, revision: sale.data.revision }] }, { idempotencyKey: 'bulk-original-with-refund' })
  assert.equal(recategorizedSale.data.items[0].status, 'failed')
  const recategorizedRefund = await client.transactions.bulkCategory({ categoryId: 'cat_other', items: [{ id: refund.data.id, revision: refund.data.revision }] }, { idempotencyKey: 'bulk-refund-category' })
  assert.equal(recategorizedRefund.data.items[0].status, 'failed')
  assert.equal((await client.transactions.get(refund.data.id)).data.categoryId, 'cat_sales')
  assert.equal((await client.transactions.get(sale.data.id)).data.amountMinor, '1000')
  assert.equal((await client.transactions.get(sale.data.id)).data.categoryId, 'cat_sales')
})

test('a refund in a later month produces a valid ratio with negative revenue', async () => {
  const client = api()
  await client.transactions.create({ businessDate: '2026-07-10', direction: 'outflow', kind: 'refund', amountMinor: '100', currency: 'CNY', categoryId: 'cat_sales', originalTransactionId: 'txn_demo_009', summary: 'Later refund' }, { idempotencyKey: 'later-month-refund' })
  const july = { ...june, startDate: '2026-07-01', endDate: '2026-08-01' }
  assert.deepEqual(values(await client.analytics.summary(july)), {
    sales_revenue: '-100', operating_expense: '0', operating_surplus: '-100', operating_surplus_rate: '1.0000',
  })
})
