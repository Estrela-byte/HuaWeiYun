import test from 'node:test'
import assert from 'node:assert/strict'
import { capabilitiesFromProfile } from './profile.js'

const expectedDefaults = {
  billImport: true,
  analytics: true,
  assistant: true,
  ocr: false,
  alerts: false,
  memberManagement: false,
  backup: false,
  export: false,
}

test('capabilitiesFromProfile returns the defaults for missing or empty profiles', () => {
  for (const profile of [null, undefined, {}]) {
    const result = capabilitiesFromProfile(profile)
    for (const [key, value] of Object.entries(expectedDefaults)) {
      assert.equal(result[key], value, `${key} should default to ${value}`)
    }
  }
})

test('capabilitiesFromProfile merges advertised capabilities over the defaults', () => {
  const result = capabilitiesFromProfile({ capabilities: { ocr: true, alerts: true } })
  assert.equal(result.ocr, true)
  assert.equal(result.alerts, true)
  assert.equal(result.billImport, true)
  assert.equal(result.backup, false)
})

test('capabilitiesFromProfile lets advertised flags override default trues', () => {
  assert.equal(capabilitiesFromProfile({ capabilities: { billImport: false } }).billImport, false)
  assert.equal(capabilitiesFromProfile({ capabilities: { analytics: false } }).analytics, false)
})

test('capabilitiesFromProfile ignores non-object capability payloads', () => {
  assert.equal(capabilitiesFromProfile({ capabilities: 'nope' }).ocr, false)
  assert.equal(capabilitiesFromProfile({ capabilities: null }).ocr, false)
  assert.equal(capabilitiesFromProfile({ capabilities: [] }).billImport, true)
})

test('capabilitiesFromProfile copies supported import formats and defaults to csv', () => {
  assert.deepEqual(capabilitiesFromProfile(null).supportedImportFormats, ['csv'])
  assert.deepEqual(capabilitiesFromProfile({}).supportedImportFormats, ['csv'])
  assert.deepEqual(capabilitiesFromProfile({ supportedImportFormats: ['csv', 'xlsx'] }).supportedImportFormats, ['csv', 'xlsx'])
  assert.deepEqual(capabilitiesFromProfile({ supportedImportFormats: 'csv' }).supportedImportFormats, ['csv'])
})

test('capabilitiesFromProfile copies supported export formats and defaults to empty', () => {
  assert.deepEqual(capabilitiesFromProfile(null).supportedExportFormats, [])
  assert.deepEqual(capabilitiesFromProfile({ supportedExportFormats: ['pdf', 'xlsx'] }).supportedExportFormats, ['pdf', 'xlsx'])
})

test('capabilitiesFromProfile returns fresh array copies that do not alias the source', () => {
  const source = ['csv', 'xlsx']
  const result = capabilitiesFromProfile({ supportedImportFormats: source })
  assert.notEqual(result.supportedImportFormats, source)
  result.supportedImportFormats.push('json')
  assert.deepEqual(source, ['csv', 'xlsx'])
})