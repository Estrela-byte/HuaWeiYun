import assert from 'node:assert/strict'
import test from 'node:test'
import { capabilitiesFromProfile } from './profile.js'

test('profile top-level format declarations reach upload and export views', () => {
  const result = capabilitiesFromProfile({
    capabilities: { billImport: true, ocr: true, export: true },
    supportedImportFormats: ['csv', 'xlsx'],
    supportedExportFormats: ['pdf'],
  })
  assert.deepEqual(result.supportedImportFormats, ['csv', 'xlsx'])
  assert.deepEqual(result.supportedExportFormats, ['pdf'])
  assert.equal(result.ocr, true)
  assert.equal(result.export, true)
  assert.equal(result.alerts, false)
})

test('missing declarations keep only report MVP features enabled', () => {
  const result = capabilitiesFromProfile(null)
  assert.deepEqual(result.supportedImportFormats, ['csv'])
  assert.deepEqual(result.supportedExportFormats, [])
  assert.equal(result.billImport, true)
  assert.equal(result.ocr, false)
  assert.equal(result.alerts, false)
  assert.equal(result.memberManagement, false)
})
