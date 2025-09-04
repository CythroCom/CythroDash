/**
 * CythroDash - Rewards/Earnings Ledger Operations
 */

import { Collection } from 'mongodb'
import { connectToDatabase } from '@/database/index'
import { CythroDashRewardLedgerEntry, REWARDS_LEDGER_COLLECTION, REWARDS_LEDGER_INDEXES, RewardAction, RewardSourceCategory } from '@/database/tables/cythro_dash_rewards_ledger'

class RewardsLedgerOps {
  private collection!: Collection<CythroDashRewardLedgerEntry>
  private initialized = false
  private counter = 0

  private async init() {
    if (this.initialized) return
    const db = await connectToDatabase()
    this.collection = db.collection<CythroDashRewardLedgerEntry>(REWARDS_LEDGER_COLLECTION)
    for (const idx of REWARDS_LEDGER_INDEXES) {
      try { await this.collection.createIndex(idx.key as any, { name: idx.name }) } catch {}
    }
    const last = await this.collection.findOne({}, { sort: { id: -1 } })
    this.counter = last?.id || 0
    this.initialized = true
  }

  private nextId() { return ++this.counter }

  async add(entry: Omit<CythroDashRewardLedgerEntry, 'id' | 'created_at'>): Promise<CythroDashRewardLedgerEntry> {
    await this.init()
    const doc: CythroDashRewardLedgerEntry = { id: this.nextId(), created_at: new Date(), ...entry }
    await this.collection.insertOne(doc)
    return doc
  }

  async query(params: { user_id?: number; source_category?: RewardSourceCategory; page?: number; limit?: number; }): Promise<{ entries: CythroDashRewardLedgerEntry[]; total: number; }> {
    await this.init()
    const filter: any = {}
    if (params.user_id) filter.user_id = params.user_id
    if (params.source_category) filter.source_category = params.source_category
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(100, Math.max(1, params.limit || 50))
    const skip = (page - 1) * limit
    const [entries, total] = await Promise.all([
      this.collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(filter)
    ])
    return { entries, total }
  }
}

export const rewardsLedgerOperations = new RewardsLedgerOps()
export default rewardsLedgerOperations

