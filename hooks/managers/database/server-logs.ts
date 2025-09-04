/**
 * CythroDash - Server Management Logs Operations
 */

import { Collection } from 'mongodb'
import { connectToDatabase } from '@/database/index'
import { CythroDashServerLog, SERVER_LOGS_COLLECTION, SERVER_LOGS_INDEXES, ServerLogAction } from '@/database/tables/cythro_dash_server_logs'

class ServerLogsOps {
  private collection!: Collection<CythroDashServerLog>
  private initialized = false
  private counter = 0

  private async init() {
    if (this.initialized) return
    const db = await connectToDatabase()
    this.collection = db.collection<CythroDashServerLog>(SERVER_LOGS_COLLECTION)
    for (const idx of SERVER_LOGS_INDEXES) {
      try { await this.collection.createIndex(idx.key as any, { name: idx.name }) } catch {}
    }
    const last = await this.collection.findOne({}, { sort: { id: -1 } })
    this.counter = last?.id || 0
    this.initialized = true
  }

  private nextId() { return ++this.counter }

  async log(entry: Omit<CythroDashServerLog, 'id' | 'created_at'>): Promise<void> {
    await this.init()
    const doc: CythroDashServerLog = { id: this.nextId(), created_at: new Date(), ...entry }
    await this.collection.insertOne(doc)
  }

  async query(params: { server_id?: string; user_id?: number; action?: ServerLogAction | ServerLogAction[]; page?: number; limit?: number; }): Promise<{ logs: CythroDashServerLog[]; total: number; }> {
    await this.init()
    const filter: any = {}
    if (params.server_id) filter.server_id = params.server_id
    if (params.user_id) filter.user_id = params.user_id
    if (params.action) filter.action = Array.isArray(params.action) ? { $in: params.action } : params.action
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(100, Math.max(1, params.limit || 50))
    const skip = (page - 1) * limit
    const [logs, total] = await Promise.all([
      this.collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(filter)
    ])
    return { logs, total }
  }
}

export const serverLogsOperations = new ServerLogsOps()
export default serverLogsOperations

