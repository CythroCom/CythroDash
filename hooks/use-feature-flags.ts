/**
 * Dynamic Feature Flags Hook
 * Manages feature visibility and availability based on database settings
 */

import { useEffect, useState } from 'react'
import { usePublicSettingsStore } from '@/stores/public-settings-store'

export type FeatureFlag = 
  | 'NEXT_PUBLIC_SERVER_CREATION'
  | 'NEXT_PUBLIC_ACCOUNT_CREATION'
  | 'NEXT_PUBLIC_ACCOUNT_LOGIN'
  | 'NEXT_PUBLIC_AFK_PAGE'
  | 'NEXT_PUBLIC_REFERRAL_PROGRAM'
  | 'NEXT_PUBLIC_TRANSFERS'
  | 'NEXT_PUBLIC_REDEEM_CODES'
  | 'NEXT_PUBLIC_MAINTENANCE_MODE'
  | 'NEXT_PUBLIC_ANNOUNCEMENT'
  | 'NEXT_PUBLIC_DAILY_LOGIN_BONUS'
  | 'NEXT_PUBLIC_OAUTH_ENABLED'
  | 'NEXT_PUBLIC_ACCOUNT_VERIFICATION'

export type FeatureConfig = {
  enabled: boolean
  loading: boolean
}

export function useFeatureFlag(flag: FeatureFlag): FeatureConfig {
  const { config, loaded, load, get } = usePublicSettingsStore()
  const [loading, setLoading] = useState(!loaded)

  useEffect(() => {
    if (!loaded) {
      setLoading(true)
      load().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loaded, load])

  // Provide sensible defaults for common features while loading
  const getDefaultValue = (flagName: FeatureFlag): boolean => {
    switch (flagName) {
      case 'NEXT_PUBLIC_SERVER_CREATION':
        return true // Default to enabled
      case 'NEXT_PUBLIC_REFERRAL_PROGRAM':
        return true // Default to enabled
      case 'NEXT_PUBLIC_REDEEM_CODES':
        return false // Default to disabled
      case 'NEXT_PUBLIC_TRANSFERS':
        return false // Default to disabled
      case 'NEXT_PUBLIC_ACCOUNT_CREATION':
        return true // Default to enabled
      case 'NEXT_PUBLIC_ACCOUNT_LOGIN':
        return true // Default to enabled
      case 'NEXT_PUBLIC_DAILY_LOGIN_BONUS':
        return true // Default to enabled
      default:
        return false
    }
  }

  const enabled = loaded ? get(flag, getDefaultValue(flag)) : getDefaultValue(flag)

  return {
    enabled: Boolean(enabled),
    loading
  }
}

export function useFeatureFlags(flags: FeatureFlag[]): Record<FeatureFlag, FeatureConfig> {
  const { loaded, load, get } = usePublicSettingsStore()
  const [loading, setLoading] = useState(!loaded)

  useEffect(() => {
    if (!loaded) {
      setLoading(true)
      load().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loaded, load])

  const getDefaultValue = (flagName: FeatureFlag): boolean => {
    switch (flagName) {
      case 'NEXT_PUBLIC_SERVER_CREATION':
        return true
      case 'NEXT_PUBLIC_REFERRAL_PROGRAM':
        return true
      case 'NEXT_PUBLIC_REDEEM_CODES':
        return false
      case 'NEXT_PUBLIC_TRANSFERS':
        return false
      case 'NEXT_PUBLIC_ACCOUNT_CREATION':
        return true
      case 'NEXT_PUBLIC_ACCOUNT_LOGIN':
        return true
      case 'NEXT_PUBLIC_DAILY_LOGIN_BONUS':
        return true
      default:
        return false
    }
  }

  return flags.reduce((acc, flag) => {
    acc[flag] = {
      enabled: loaded ? Boolean(get(flag, getDefaultValue(flag))) : getDefaultValue(flag),
      loading
    }
    return acc
  }, {} as Record<FeatureFlag, FeatureConfig>)
}

export function useAppConfig() {
  const { loaded, load, get } = usePublicSettingsStore()
  const [loading, setLoading] = useState(!loaded)

  useEffect(() => {
    if (!loaded) {
      setLoading(true)
      load().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loaded, load])

  // Provide sensible defaults that work even when config is not loaded
  const defaults = {
    appName: 'CythroDash',
    description: 'Advanced Game Server Management Dashboard',
    url: '',
    logo: '',
    welcomeMessage: 'Welcome to CythroDash',
    panelUrl: '',
    theme: 'default',
    brandColor: '#2b32b2',
    customCSS: ''
  }

  return {
    appName: loaded ? get('NEXT_PUBLIC_NAME', defaults.appName) : defaults.appName,
    description: loaded ? get('NEXT_PUBLIC_DESCRIPTION', defaults.description) : defaults.description,
    url: loaded ? get('NEXT_PUBLIC_URL', defaults.url) : defaults.url,
    logo: loaded ? get('NEXT_PUBLIC_LOGO', defaults.logo) : defaults.logo,
    welcomeMessage: loaded ? get('NEXT_PUBLIC_WELCOME_MESSAGE', defaults.welcomeMessage) : defaults.welcomeMessage,
    panelUrl: loaded ? get('NEXT_PUBLIC_PANEL_URL', defaults.panelUrl) : defaults.panelUrl,
    theme: loaded ? get('NEXT_PUBLIC_THEME', defaults.theme) : defaults.theme,
    brandColor: loaded ? get('NEXT_PUBLIC_BRAND_COLOR', defaults.brandColor) : defaults.brandColor,
    customCSS: loaded ? get('NEXT_PUBLIC_CUSTOM_CSS', defaults.customCSS) : defaults.customCSS,
    loading
  }
}

// Feature-specific hooks for common use cases
export function useServerCreationEnabled() {
  return useFeatureFlag('NEXT_PUBLIC_SERVER_CREATION')
}

export function useAccountCreationEnabled() {
  return useFeatureFlag('NEXT_PUBLIC_ACCOUNT_CREATION')
}

export function useReferralProgramEnabled() {
  return useFeatureFlag('NEXT_PUBLIC_REFERRAL_PROGRAM')
}

export function useRedeemCodesEnabled() {
  return useFeatureFlag('NEXT_PUBLIC_REDEEM_CODES')
}

export function useTransfersEnabled() {
  return useFeatureFlag('NEXT_PUBLIC_TRANSFERS')
}

export function useMaintenanceMode() {
  return useFeatureFlag('NEXT_PUBLIC_MAINTENANCE_MODE')
}

export function useDailyLoginBonus() {
  const { loaded, load, get } = usePublicSettingsStore()
  const [loading, setLoading] = useState(!loaded)

  useEffect(() => {
    if (!loaded) {
      setLoading(true)
      load().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loaded, load])

  return {
    enabled: Boolean(get('NEXT_PUBLIC_DAILY_LOGIN_BONUS', true)),
    amount: Number(get('NEXT_PUBLIC_DAILY_LOGIN_BONUS_AMOUNT', 10)),
    loading
  }
}

// Navigation helper - determines which sidebar items should be visible
export function useNavigationFeatures() {
  const features = useFeatureFlags([
    'NEXT_PUBLIC_SERVER_CREATION',
    'NEXT_PUBLIC_REFERRAL_PROGRAM',
    'NEXT_PUBLIC_TRANSFERS',
    'NEXT_PUBLIC_REDEEM_CODES',
    'NEXT_PUBLIC_AFK_PAGE'
  ])

  return {
    showServers: features.NEXT_PUBLIC_SERVER_CREATION.enabled,
    showReferrals: features.NEXT_PUBLIC_REFERRAL_PROGRAM.enabled,
    showTransfers: features.NEXT_PUBLIC_TRANSFERS.enabled,
    showRedeemCodes: features.NEXT_PUBLIC_REDEEM_CODES.enabled,
    showAfkPage: features.NEXT_PUBLIC_AFK_PAGE.enabled,
    loading: Object.values(features).some(f => f.loading)
  }
}

// Security and limits
export function useSecurityConfig() {
  const { loaded, load, get } = usePublicSettingsStore()
  const [loading, setLoading] = useState(!loaded)

  useEffect(() => {
    if (!loaded) {
      setLoading(true)
      load().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loaded, load])

  return {
    rateLimit: Number(get('NEXT_PUBLIC_RATE_LIMIT', 60)),
    sessionTimeout: Number(get('NEXT_PUBLIC_SESSION_TIMEOUT_MIN', 60)),
    ipRestrictions: get('NEXT_PUBLIC_IP_RESTRICTIONS', []),
    serverCreationLimit: Number(get('NEXT_PUBLIC_SERVER_CREATION_LIMIT', 1)),
    loading
  }
}
