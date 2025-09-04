/**
 * CythroDash - Settings Schema (safe, non-sensitive)
 */

export type SettingDataType = 'string' | 'number' | 'boolean' | 'json'

export interface CythroDashSetting {
  key: string
  value: string // stored as string; parse based on data_type
  category: 'general' | 'oauth' | 'features' | 'security' | 'appearance'
  description?: string
  data_type: SettingDataType
  updated_at: Date
  updated_by_admin_id: number
}

export const SETTINGS_COLLECTION = 'cythro_dash_settings'

export const SETTINGS_INDEXES = [
  { key: { key: 1 }, name: 'key_unique', unique: true },
  { key: { category: 1 }, name: 'by_category' },
]

export const SAFE_SETTINGS: Array<{ key: string; category: CythroDashSetting['category']; data_type: SettingDataType; description?: string; default?: any }> = [
  // General (branding & URLs)
  { key: 'NEXT_PUBLIC_NAME', category: 'general', data_type: 'string', description: 'Application display name', default: 'CythroDash' },
  { key: 'NEXT_PUBLIC_DESCRIPTION', category: 'general', data_type: 'string', description: 'App description', default: '' },
  { key: 'NEXT_PUBLIC_URL', category: 'general', data_type: 'string', description: 'Base site URL', default: '' },
  { key: 'NEXT_PUBLIC_LOGO', category: 'general', data_type: 'string', description: 'Logo URL', default: '' },
  { key: 'NEXT_PUBLIC_WELCOME_MESSAGE', category: 'general', data_type: 'string', description: 'Welcome banner message', default: '' },
  { key: 'NEXT_PUBLIC_PANEL_URL', category: 'general', data_type: 'string', description: 'External panel base URL (public)', default: '' },

  // OAuth (non-sensitive public toggles/urls only if needed)
  { key: 'NEXT_PUBLIC_OAUTH_ENABLED', category: 'oauth', data_type: 'boolean', description: 'Enable OAuth providers', default: false },
  { key: 'NEXT_PUBLIC_OAUTH_REDIRECT_URL', category: 'oauth', data_type: 'string', description: 'OAuth redirect URL', default: '' },

  // Features (dashboard feature flags)
  { key: 'NEXT_PUBLIC_ACCOUNT_VERIFICATION', category: 'features', data_type: 'boolean', description: 'Require account verification', default: false },
  { key: 'NEXT_PUBLIC_SERVER_CREATION', category: 'features', data_type: 'boolean', description: 'Enable server creation UI', default: false },
  { key: 'NEXT_PUBLIC_ACCOUNT_CREATION', category: 'features', data_type: 'boolean', description: 'Enable account registration UI', default: true },
  { key: 'NEXT_PUBLIC_ACCOUNT_LOGIN', category: 'features', data_type: 'boolean', description: 'Enable account login UI', default: true },
  { key: 'NEXT_PUBLIC_AFK_PAGE', category: 'features', data_type: 'boolean', description: 'Enable AFK page', default: false },
  { key: 'NEXT_PUBLIC_REFERRAL_PROGRAM', category: 'features', data_type: 'boolean', description: 'Enable referral program', default: true },
  { key: 'NEXT_PUBLIC_TRANSFERS', category: 'features', data_type: 'boolean', description: 'Enable coin transfers', default: false },
  { key: 'NEXT_PUBLIC_REDEEM_CODES', category: 'features', data_type: 'boolean', description: 'Enable redeem codes', default: false },
  { key: 'NEXT_PUBLIC_MAINTENANCE_MODE', category: 'features', data_type: 'boolean', description: 'Enable maintenance mode banner', default: false },
  { key: 'NEXT_PUBLIC_ANNOUNCEMENT', category: 'features', data_type: 'boolean', description: 'Enable announcement system', default: false },
  { key: 'NEXT_PUBLIC_DAILY_LOGIN_BONUS', category: 'features', data_type: 'boolean', description: 'Enable daily login bonus', default: true },
  { key: 'NEXT_PUBLIC_DAILY_LOGIN_BONUS_AMOUNT', category: 'features', data_type: 'number', description: 'Daily bonus amount', default: 10 },
  { key: 'NEXT_PUBLIC_SERVER_CREATION_LIMIT', category: 'features', data_type: 'number', description: 'Max servers per user', default: 1 },
  { key: 'NEXT_PUBLIC_DISCORD_GUILD_ID', category: 'features', data_type: 'string', description: 'Discord guild id (public)', default: '' },

  // Security (non-sensitive public knobs only)
  { key: 'NEXT_PUBLIC_RATE_LIMIT', category: 'security', data_type: 'number', description: 'Global rate limit (req/min)', default: 60 },
  { key: 'NEXT_PUBLIC_SESSION_TIMEOUT_MIN', category: 'security', data_type: 'number', description: 'Session timeout (minutes)', default: 60 },
  { key: 'NEXT_PUBLIC_IP_RESTRICTIONS', category: 'security', data_type: 'json', description: 'Allowed IP ranges (array)', default: [] },

  // Appearance
  { key: 'NEXT_PUBLIC_THEME', category: 'appearance', data_type: 'string', description: 'Theme name', default: 'default' },
  { key: 'NEXT_PUBLIC_BRAND_COLOR', category: 'appearance', data_type: 'string', description: 'Brand accent color', default: '#2b32b2' },
  { key: 'NEXT_PUBLIC_CUSTOM_CSS', category: 'appearance', data_type: 'string', description: 'Custom CSS string', default: '' },
]

