/**
 * Node-friendly app config accessor for CLI scripts
 * Mirrors the shape of the client hook useAppConfig but without React/Zustand.
 * Returns values synchronously from environment with sensible defaults.
 */

function coerce(val, fallback) {
  if (val === undefined || val === null) return fallback
  return val
}

function useAppConfig() {
  const appName = coerce(process.env.NEXT_PUBLIC_NAME, 'CythroDash')
  const description = coerce(process.env.NEXT_PUBLIC_DESCRIPTION, 'Advanced Game Server Management Dashboard')
  const url = coerce(process.env.NEXT_PUBLIC_URL, '')
  const logo = coerce(process.env.NEXT_PUBLIC_LOGO, '')
  const welcomeMessage = coerce(process.env.NEXT_PUBLIC_WELCOME_MESSAGE, 'Welcome to CythroDash')
  const panelUrl = coerce(process.env.NEXT_PUBLIC_PANEL_URL, '')
  const theme = coerce(process.env.NEXT_PUBLIC_THEME, 'default')
  const brandColor = coerce(process.env.NEXT_PUBLIC_BRAND_COLOR, '#2b32b2')
  const customCSS = coerce(process.env.NEXT_PUBLIC_CUSTOM_CSS, '')

  return {
    appName,
    description,
    url,
    logo,
    welcomeMessage,
    panelUrl,
    theme,
    brandColor,
    customCSS,
    // Keep parity with client hook
    loading: false,
  }
}

module.exports = { useAppConfig }

