/**
 * Admin Settings Controller
 */

import settingsOperations from '@/hooks/managers/database/settings'
import { SecurityLogsController } from '@/hooks/managers/controller/Security/Logs'
import { SecurityLogAction, SecurityLogSeverity } from '@/database/tables/cythro_dash_users_logs'
import { SAFE_SETTINGS } from '@/database/tables/cythro_dash_settings'

function parseByType(type: 'string'|'number'|'boolean'|'json', value: string) {
  try {
    switch (type) {
      case 'boolean': return value === 'true'
      case 'number': return Number(value)
      case 'json': return JSON.parse(value)
      default: return value
    }
  } catch {
    return type === 'json' ? null : value
  }
}

export class AdminSettingsController {
  static async listAll() {
    const raw = await settingsOperations.getSettings()
    return raw.map(s => {
      const def = SAFE_SETTINGS.find(d => d.key === s.key)
      const typedVal = def ? parseByType(def.data_type, s.value) : s.value
      return { ...s, value: typedVal }
    })
  }
  static async listByCategory(category: 'general'|'oauth'|'features'|'security'|'appearance') {
    const raw = await settingsOperations.getByCategory(category)
    return raw.map(s => {
      const def = SAFE_SETTINGS.find(d => d.key === s.key)
      const typedVal = def ? parseByType(def.data_type, s.value) : s.value
      return { ...s, value: typedVal }
    })
  }
  static async update(key: string, value: any, admin_id: number) {
    const ok = await settingsOperations.updateSetting(key, value, admin_id)
    try {
      await SecurityLogsController.createLog({ user_id: admin_id, action: SecurityLogAction.ADMIN_ACTION_PERFORMED, severity: SecurityLogSeverity.LOW, description: `Updated setting ${key}`, details: { key } })
    } catch {}
    return ok
  }
}

export default AdminSettingsController

