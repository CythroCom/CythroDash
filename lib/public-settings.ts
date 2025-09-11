import settingsOperations from '@/hooks/managers/database/settings'
import { SAFE_SETTINGS } from '@/database/tables/cythro_dash_settings'

function defaultFor(key: string): any | undefined {
  const def = SAFE_SETTINGS.find(s => s.key === key)
  return def?.default
}

export async function getPublicSetting<T = any>(key: string, fallback?: T): Promise<T | undefined> {
  try {
    if (!key.startsWith('NEXT_PUBLIC_')) return fallback
    const val = await settingsOperations.getValue<T>(key)
    if (val !== undefined && val !== null) return val
    const envVal = (process.env as any)?.[key]
    if (envVal !== undefined) return envVal as any
    const def = defaultFor(key)
    return (def as any) ?? fallback
  } catch {
    const envVal = (process.env as any)?.[key]
    if (envVal !== undefined) return envVal as any
    const def = defaultFor(key)
    return (def as any) ?? fallback
  }
}

export async function getPublicFlag(key: string, fallback?: boolean): Promise<boolean> {
  const val = await getPublicSetting<any>(key, undefined)
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val === 'true'
  const envVal = (process.env as any)?.[key]
  if (envVal !== undefined) return String(envVal) === 'true'
  const def = defaultFor(key)
  if (typeof def === 'boolean') return def
  return Boolean(fallback)
}

export async function getPublicNumber(key: string, fallback?: number): Promise<number | undefined> {
  const val = await getPublicSetting<any>(key, undefined)
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = Number(val)
    return Number.isNaN(n) ? fallback : n
  }
  const envVal = (process.env as any)?.[key]
  if (envVal !== undefined) {
    const n = Number(envVal)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}

