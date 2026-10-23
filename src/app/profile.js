const defaultCapabilities = Object.freeze({
  billImport: true,
  analytics: true,
  assistant: true,
  ocr: false,
  alerts: false,
  memberManagement: false,
  backup: false,
  export: false,
})

/** Map the business profile into the page-level capability and format flags. */
export function capabilitiesFromProfile(profile) {
  const advertised = profile?.capabilities && typeof profile.capabilities === 'object'
    ? profile.capabilities
    : {}

  return {
    ...defaultCapabilities,
    ...advertised,
    supportedImportFormats: Array.isArray(profile?.supportedImportFormats)
      ? [...profile.supportedImportFormats]
      : ['csv'],
    supportedExportFormats: Array.isArray(profile?.supportedExportFormats)
      ? [...profile.supportedExportFormats]
      : [],
  }
}
