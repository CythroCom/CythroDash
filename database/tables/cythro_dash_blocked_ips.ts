/**
 * CythroDash - Blocked IPs Schema
 */

export type BlockType = 'manual' | 'automatic'

export interface CythroDashBlockedIP {
  ip_address: string
  reason: string
  blocked_by_admin_id?: number
  block_type: BlockType
  is_active: boolean
  blocked_at: Date
  expires_at?: Date | null
  metadata?: {
    source?: 'referral' | 'security' | 'api' | 'manual'
    cidr?: string
    notes?: string
    hit_count?: number
  }
}

export const BLOCKED_IPS_COLLECTION = 'cythro_dash_blocked_ips'

export const BLOCKED_IPS_INDEXES = [
  { key: { ip_address: 1, is_active: 1 }, name: 'ip_active' },
  { key: { is_active: 1, expires_at: 1 }, name: 'active_expiry' },
  { key: { blocked_by_admin_id: 1, blocked_at: -1 }, name: 'admin_time' },
  { key: { is_active: 1, 'metadata.cidr': 1 }, name: 'active_cidr' },
]

