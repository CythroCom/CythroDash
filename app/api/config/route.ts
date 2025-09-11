/**
 * Public config endpoint: exposes ONLY NEXT_PUBLIC_* settings
 */

import { NextRequest, NextResponse } from 'next/server'
import settingsOperations from '@/hooks/managers/database/settings'
import { SAFE_SETTINGS } from '@/database/tables/cythro_dash_settings'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  // Build env map first (fallback) with ONLY NEXT_PUBLIC_* keys
  const envMap: Record<string, any> = {}
  try {
    for (const [k, v] of Object.entries(process.env ?? {})) {
      if (!k.startsWith('NEXT_PUBLIC_')) continue
      if (v === undefined || v === null) continue
      // Best-effort type coercion for env values
      if (v === 'true') envMap[k] = true
      else if (v === 'false') envMap[k] = false
      else if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) envMap[k] = Number(v)
      else if (typeof v === 'string' && (v.trim().startsWith('{') || v.trim().startsWith('['))) {
        try { envMap[k] = JSON.parse(v as string) } catch { envMap[k] = v }
      } else envMap[k] = v
    }
  } catch {}

  // Apply SAFE default values on top of env
  const withDefaults: Record<string, any> = { ...envMap }
  for (const def of SAFE_SETTINGS) {
    if (!def.key.startsWith('NEXT_PUBLIC_')) continue
    if (withDefaults[def.key] === undefined) withDefaults[def.key] = def.default
  }

  try {
    // DB-first values override defaults and env fallback
    const all = await settingsOperations.getSettings()
    const map: Record<string, any> = { ...withDefaults }
    for (const s of all) {
      if (!s.key.startsWith('NEXT_PUBLIC_')) continue
      if (s.data_type === 'boolean') map[s.key] = s.value === 'true'
      else if (s.data_type === 'number') map[s.key] = Number(s.value)
      else if (s.data_type === 'json') { try { map[s.key] = JSON.parse(s.value) } catch { map[s.key] = null } }
      else map[s.key] = s.value
    }
    return NextResponse.json({ success: true, config: map })
  } catch (e) {
    // If DB is unavailable, return defaults+env config
    return NextResponse.json({ success: true, config: withDefaults })
  }
}

