/**
 * CythroDash - Admin Security Analytics Controller
 */

import { connectToDatabase } from '@/database/index'
import { USER_LOGS_COLLECTION, SecurityLogSeverity, SecurityLogAction } from '@/database/tables/cythro_dash_users_logs'
import { BLOCKED_IPS_COLLECTION } from '@/database/tables/cythro_dash_blocked_ips'
import { userOperations } from '@/hooks/managers/database/user'

export interface SecurityAnalytics {
  threat_level: 'low' | 'medium' | 'high'
  summary: {
    total_events_24h: number
    suspicious_24h: number
    failed_logins_24h: number
  }
  recent_events: Array<{
    id: number
    user_id: number
    action: string
    severity: SecurityLogSeverity
    message: string
    ip_address?: string
    created_at: Date
  }>
  blocked_ips: Array<{
    ip_address: string
    count: number
    last_seen: Date
    reason?: string
  }>
  active_sessions: {
    users_active_30m: number
    examples: Array<{ id: number; username: string; last_activity?: Date }>
  }
}

export class AdminSecurityController {
  static async getAnalytics(): Promise<{ success: boolean; data?: SecurityAnalytics; message?: string }> {
    try {
      const db = await connectToDatabase()
      const logsCol = db.collection(USER_LOGS_COLLECTION)
      const now = new Date()
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Totals last 24h
      const [totalEvents24h, suspicious24h, failedLogins24h] = await Promise.all([
        logsCol.countDocuments({ created_at: { $gte: since24h } }),
        logsCol.countDocuments({ created_at: { $gte: since24h }, is_suspicious: true }),
        logsCol.countDocuments({ created_at: { $gte: since24h }, action: SecurityLogAction.LOGIN_FAILED })
      ])

      // Recent security events (last 20)
      const recentDocs = await logsCol.find({}).sort({ created_at: -1 }).limit(20).toArray()
      const recent = recentDocs.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        action: d.action,
        severity: d.severity,
        message: d.description,
        ip_address: d.ip_address,
        created_at: d.created_at,
      }))

      // Blocked IPs from dedicated collection (active ones)
      const blockedCol = db.collection(BLOCKED_IPS_COLLECTION)
      const activeBlocked = await blockedCol.find({ is_active: true }).sort({ blocked_at: -1 }).limit(20).toArray()
      const blocked_ips = activeBlocked.map((d: any) => ({ ip_address: d.ip_address, count: d.metadata?.hit_count || 0, last_seen: d.expires_at || d.blocked_at, reason: d.reason }))

      // Active sessions: based on users with last_activity in last 30 minutes
      const activeUsers = await userOperations.getActiveUsers(30)
      const active_sessions = {
        users_active_30m: activeUsers.length,
        examples: activeUsers.slice(0, 10).map(u => ({ id: u.id, username: u.username, last_activity: (u as any).last_activity }))
      }

      // Compute threat_level (simple heuristic)
      const threat_level: SecurityAnalytics['threat_level'] = suspicious24h > 50 || failedLogins24h > 100 ? 'high'
        : (suspicious24h > 10 || failedLogins24h > 25 ? 'medium' : 'low')

      return {
        success: true,
        data: {
          threat_level,
          summary: { total_events_24h: totalEvents24h, suspicious_24h: suspicious24h, failed_logins_24h: failedLogins24h },
          recent_events: recent,
          blocked_ips,
          active_sessions,
        }
      }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to get security analytics' }
    }
  }
}

