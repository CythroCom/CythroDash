/**
 * CythroDash - Admin Logs Controller (Unified)
 */

import { userLogsOperations } from '@/hooks/managers/database/user-logs'
import { transferOperations } from '@/hooks/managers/database/transfers'
import { rewardsLedgerOperations } from '@/hooks/managers/database/rewards-ledger'
import { serverLogsOperations } from '@/hooks/managers/database/server-logs'
import { ReferralLogType } from '@/database/tables/cythro_dash_referral_logs'
import { SecurityLogAction, SecurityLogSeverity } from '@/database/tables/cythro_dash_users_logs'
import { codeRedemptionsCollectionName } from '@/database/tables/cythro_dash_codes'
import { connectToDatabase } from '@/database/index'

export type AdminLogCategory = 'user' | 'redeem' | 'referral' | 'rewards' | 'transfer' | 'server'

export interface AdminLogsQuery {
  page?: number
  limit?: number
  category?: AdminLogCategory | AdminLogCategory[]
  user_id?: number
  server_id?: string
  action?: string
  date_from?: string
  date_to?: string
  search?: string
}

export class AdminLogsController {
  static async getLogs(query: AdminLogsQuery, adminUserId: number) {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25))

    const categories = Array.isArray(query.category) ? query.category : (query.category ? [query.category] : ['user','redeem','referral','rewards','transfer','server'])

    const results: any[] = []

    // User activity (security) logs
    if (categories.includes('user')) {
      const logs = await userLogsOperations.queryLogs({
        user_id: query.user_id,
        limit,
        offset: (page-1)*limit,
        sort_by: 'created_at',
        sort_order: 'desc'
      })
      results.push(...logs.map(l => ({
        _type: 'user',
        time: l.created_at,
        user_id: l.user_id,
        action: l.action,
        severity: l.severity,
        message: l.description,
        details: l.details
      })))
    }

    // Redeem code logs (from redemptions collection)
    if (categories.includes('redeem')) {
      const db = await connectToDatabase()
      const col = db.collection(codeRedemptionsCollectionName)
      const filter: any = {}
      if (query.user_id) filter.user_id = query.user_id
      const docs = await col.find(filter).sort({ redeemed_at: -1 }).skip((page-1)*limit).limit(limit).toArray()
      results.push(...docs.map(d => ({
        _type: 'redeem',
        time: d.redeemed_at,
        user_id: d.user_id,
        action: 'redeem_code',
        message: `Code ${d.code} redeemed for ${d.coins_awarded} coins`,
        amount: d.coins_awarded,
        details: d
      })))
    }

    // Referral logs
    if (categories.includes('referral')) {
      const db = await connectToDatabase()
      const col = db.collection('cythro_dash_referral_logs')
      const filter: any = {}
      if (query.user_id) filter.$or = [{ referrer_id: query.user_id }, { referred_user_id: query.user_id }, { user_id: query.user_id }]
      const docs = await col.find(filter).sort({ timestamp: -1 }).skip((page-1)*limit).limit(limit).toArray()
      results.push(...docs.map(d => ({
        _type: 'referral',
        time: d.timestamp,
        user_id: d.user_id || d.referrer_id || d.referred_user_id,
        action: d.log_type,
        message: d.validation_notes || d.activity_data?.claim_type || d.activity_data?.tier_name,
        details: d
      })))
    }

    // Rewards ledger
    if (categories.includes('rewards')) {
      const { entries } = await rewardsLedgerOperations.query({ user_id: query.user_id, page, limit })
      results.push(...entries.map(e => ({
        _type: 'rewards',
        time: e.created_at,
        user_id: e.user_id,
        action: e.source_action,
        message: `${e.delta > 0 ? '+' : ''}${e.delta} coins via ${e.source_category}`,
        amount: e.delta,
        details: e
      })))
    }

    // Transfers
    if (categories.includes('transfer')) {
      const transfers = await transferOperations.getUserTransfers(query.user_id || 0, limit, (page-1)*limit)
      results.push(...transfers.transfers.map(t => ({
        _type: 'transfer',
        time: t.created_at,
        user_id: t.from_user_id,
        action: t.status,
        message: `Transfer ${t.amount} from ${t.from_username} to ${t.to_username}`,
        amount: t.amount,
        details: t
      })))
    }

    // Server management
    if (categories.includes('server')) {
      const { logs } = await serverLogsOperations.query({ server_id: query.server_id, user_id: query.user_id, page, limit })
      results.push(...logs.map(l => ({
        _type: 'server',
        time: l.created_at,
        user_id: l.user_id,
        action: l.action,
        message: l.message,
        details: l
      })))
    }

    // Merge and sort by time desc
    results.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    // Pagination note: since we merge streams, page/limit are approximate per category.
    return {
      success: true,
      logs: results.slice(0, limit),
      pagination: {
        current_page: page,
        per_page: limit,
        total_estimated: results.length
      }
    }
  }
}

