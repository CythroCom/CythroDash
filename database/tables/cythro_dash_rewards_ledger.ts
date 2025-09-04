/**
 * CythroDash - Rewards/Earnings Ledger Schema
 */

export type RewardSourceCategory = 'referral' | 'daily_login' | 'promotion' | 'transfer' | 'redeem_code' | 'admin_adjustment'
export type RewardAction = 'earn' | 'spend' | 'adjust'

export interface CythroDashRewardLedgerEntry {
  id: number
  user_id: number
  delta: number // positive for earn, negative for spend
  balance_before: number
  balance_after: number
  source_category: RewardSourceCategory
  source_action: RewardAction
  reference_id?: string | number // e.g., code redemption id, transfer id
  message?: string
  created_at: Date
}

export const REWARDS_LEDGER_COLLECTION = 'cythro_dash_rewards_ledger'

export const REWARDS_LEDGER_INDEXES = [
  { key: { user_id: 1, created_at: -1 }, name: 'user_time' },
  { key: { source_category: 1, created_at: -1 }, name: 'source_time' },
  { key: { created_at: -1 }, name: 'created_desc' },
]

