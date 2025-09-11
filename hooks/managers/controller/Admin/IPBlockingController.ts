/**
 * CythroDash - Admin IP Blocking Controller
 */

import blockedIPsOperations from '@/hooks/managers/database/blocked-ips'
import { SecurityLogsController } from '@/hooks/managers/controller/Security/Logs'
import { SecurityLogAction, SecurityLogSeverity } from '@/database/tables/cythro_dash_users_logs'

export class IPBlockingController {
  static async blockIP(adminId: number, data: { ip_address: string; reason: string; expires_at?: string | null; block_type?: 'manual' | 'automatic' }) {
    const expires_at = data.expires_at ? new Date(data.expires_at) : null
    const safeType = data.block_type === 'automatic' ? 'manual' : (data.block_type || 'manual')
    const result = await blockedIPsOperations.blockIP({ ip_address: data.ip_address, reason: data.reason, blocked_by_admin_id: adminId, expires_at, block_type: safeType as any, metadata: { source: safeType } })
    try {
      await SecurityLogsController.createLog({
        user_id: adminId,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.MEDIUM,
        description: `Blocked IP ${data.ip_address}: ${data.reason}`,
        details: { ip: data.ip_address, expires_at }
      })
    } catch {}
    return result
  }

  static async unblockIP(adminId: number, ip_address: string) {
    const result = await blockedIPsOperations.unblockIP(ip_address)
    try {
      await SecurityLogsController.createLog({
        user_id: adminId,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.LOW,
        description: `Unblocked IP ${ip_address}`,
        details: { ip: ip_address }
      })
    } catch {}
    return result
  }

  static async listBlockedIPs(_adminId: number, query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))
    return blockedIPsOperations.getBlockedIPs(page, limit, query.search)
  }
}

