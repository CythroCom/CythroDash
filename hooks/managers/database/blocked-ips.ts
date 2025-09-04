/**
 * CythroDash - Blocked IPs Operations
 */

import { Collection } from 'mongodb'
import { connectToDatabase } from '@/database/index'
import { BLOCKED_IPS_COLLECTION, BLOCKED_IPS_INDEXES, CythroDashBlockedIP, BlockType } from '@/database/tables/cythro_dash_blocked_ips'

class BlockedIPsOps {
  private collection!: Collection<CythroDashBlockedIP>
  private initialized = false

  private async init() {
    if (this.initialized) return
    const db = await connectToDatabase()
    this.collection = db.collection<CythroDashBlockedIP>(BLOCKED_IPS_COLLECTION)
    for (const idx of BLOCKED_IPS_INDEXES) {
      try { await this.collection.createIndex(idx.key as any, { name: idx.name }) } catch {}
    }
    this.initialized = true
  }

  private isExpired(doc: CythroDashBlockedIP) {
    return !!doc.expires_at && new Date(doc.expires_at) < new Date()
  }

  async blockIP(params: { ip_address: string; reason: string; blocked_by_admin_id?: number; expires_at?: Date | null; block_type?: BlockType; metadata?: CythroDashBlockedIP['metadata'] }): Promise<{ success: boolean; record?: CythroDashBlockedIP; message?: string }>{
    await this.init()
    const ip = String(params.ip_address).trim()
    if (!ip) return { success: false, message: 'Invalid IP address' }

    const now = new Date()
    const record: CythroDashBlockedIP = {
      ip_address: ip,
      reason: params.reason,
      blocked_by_admin_id: params.blocked_by_admin_id,
      block_type: params.block_type || 'manual',
      is_active: true,
      blocked_at: now,
      expires_at: params.expires_at ?? null,
      metadata: { ...params.metadata, hit_count: 0 }
    }

    const existing = await this.collection.findOne({ ip_address: ip, is_active: true })
    if (existing) {
      await this.collection.updateOne({ ip_address: ip, is_active: true }, { $set: { reason: record.reason, expires_at: record.expires_at, metadata: record.metadata } })
      return { success: true, record: { ...existing, ...record } }
    }

    await this.collection.insertOne(record)
    return { success: true, record }
  }

  async unblockIP(ip_address: string): Promise<{ success: boolean; message?: string }>{
    await this.init()
    const res = await this.collection.updateMany({ ip_address: ip_address.trim(), is_active: true }, { $set: { is_active: false } })
    return { success: res.modifiedCount > 0, message: res.modifiedCount > 0 ? 'Unblocked' : 'Not found' }
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      // Simple IPv4 CIDR check
      const [range, bitsStr] = cidr.split('/')
      const bits = parseInt(bitsStr, 10)
      const ipToLong = (x: string) => x.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      const base = ipToLong(range)
      const num = ipToLong(ip)
      return (base & mask) === (num & mask)
    } catch { return false }
  }

  async isIPBlocked(ip_address: string): Promise<{ blocked: boolean; record?: CythroDashBlockedIP }>{
    await this.init()
    const ip = ip_address.trim()

    // Exact match first
    let rec = await this.collection.findOne({ ip_address: ip, is_active: true })

    // CIDR match if not found
    if (!rec) {
      const cursor = this.collection.find({ is_active: true, 'metadata.cidr': { $exists: true, $ne: null } })
      for await (const doc of cursor) {
        if (doc.metadata?.cidr && this.ipInCidr(ip, doc.metadata.cidr)) { rec = doc; break }
      }
    }

    if (!rec) return { blocked: false }
    if (this.isExpired(rec)) {
      await this.collection.updateOne({ ip_address: rec.ip_address, is_active: true }, { $set: { is_active: false } })
      return { blocked: false }
    }
    return { blocked: true, record: rec }
  }

  async getBlockedIPs(page = 1, limit = 25, search?: string): Promise<{ items: CythroDashBlockedIP[]; total: number }>{
    await this.init()
    const filter: any = {}
    if (search) filter.ip_address = { $regex: search, $options: 'i' }
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit))
    const [items, total] = await Promise.all([
      this.collection.find(filter).sort({ blocked_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(filter)
    ])
    return { items, total }
  }

  async cleanupExpiredBlocks(): Promise<number> {
    await this.init()
    const now = new Date()
    const res = await this.collection.updateMany({ is_active: true, expires_at: { $ne: null, $lt: now } }, { $set: { is_active: false } })
    return res.modifiedCount
  }

  async incrementHit(ip: string) {
    await this.init()
    await this.collection.updateOne({ ip_address: ip, is_active: true }, { $inc: { 'metadata.hit_count': 1 } })
  }
}

export const blockedIPsOperations = new BlockedIPsOps()
export default blockedIPsOperations

