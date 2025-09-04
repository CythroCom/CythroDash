/**
 * Admin Settings Controller
 */

import settingsOperations from '@/hooks/managers/database/settings'
import { SecurityLogsController } from '@/hooks/managers/controller/Security/Logs'
import { SecurityLogAction, SecurityLogSeverity } from '@/database/tables/cythro_dash_users_logs'

export class AdminSettingsController {
  static async listAll() {
    return settingsOperations.getSettings()
  }
  static async listByCategory(category: 'general'|'oauth'|'features'|'security'|'appearance') {
    return settingsOperations.getByCategory(category)
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

