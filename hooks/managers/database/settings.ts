/**
 * CythroDash - Settings Operations (safe, non-sensitive)
 */

import { Collection } from 'mongodb'
import { connectToDatabase } from '@/database/index'
import { CythroDashSetting, SETTINGS_COLLECTION, SETTINGS_INDEXES, SAFE_SETTINGS, SettingDataType } from '@/database/tables/cythro_dash_settings'

function coerceToString(value: any, type: SettingDataType): string {
  switch (type) {
    case 'boolean': return String(Boolean(value))
    case 'number': return String(Number(value))
    case 'json': return JSON.stringify(value ?? null)
    default: return String(value ?? '')
  }
}

function parseFromString(value: string, type: SettingDataType): any {
  switch (type) {
    case 'boolean': return value === 'true'
    case 'number': return Number(value)
    case 'json': try { return JSON.parse(value) } catch { return null }
    default: return value
  }
}

class SettingsOps {
  private col!: Collection<CythroDashSetting>
  private initialized = false
  private cache = new Map<string, { value: any; at: number }>()
  private ttlMs = 15_000

  private async init() {
    if (this.initialized) return
    const db = await connectToDatabase()
    this.col = db.collection(SETTINGS_COLLECTION)
    for (const idx of SETTINGS_INDEXES) { try { await this.col.createIndex(idx.key as any, { name: idx.name, unique: (idx as any).unique }) } catch {} }
    // Ensure defaults exist
    for (const def of SAFE_SETTINGS) {
      const existing = await this.col.findOne({ key: def.key })
      if (!existing) {
        await this.col.insertOne({ key: def.key, value: coerceToString(def.default, def.data_type), category: def.category, description: def.description, data_type: def.data_type, updated_at: new Date(), updated_by_admin_id: 0 })
      }
    }
    this.initialized = true
  }

  private parse(defType: SettingDataType, val: string | undefined): any {
    if (val === undefined) return undefined
    return parseFromString(val, defType)
  }

  async getSettings() {
    await this.init()
    const docs = await this.col.find({}).toArray()
    return docs
  }

  async getByCategory(category: CythroDashSetting['category']) {
    await this.init()
    return this.col.find({ category }).toArray()
  }

  async getValue<T = any>(key: string): Promise<T | undefined> {
    await this.init()
    const now = Date.now()
    const cached = this.cache.get(key)
    if (cached && now - cached.at < this.ttlMs) return cached.value as T
    const def = SAFE_SETTINGS.find(s => s.key === key)
    if (!def) return undefined
    const doc = await this.col.findOne({ key })
    const parsed = this.parse(def.data_type, doc?.value)
    this.cache.set(key, { value: parsed, at: now })
    return parsed as T
  }

  async updateSetting(key: string, value: any, admin_id: number) {
    await this.init()
    const def = SAFE_SETTINGS.find(s => s.key === key)
    if (!def) throw new Error('Setting not allowed')
    let parsed: any
    try {
      switch (def.data_type) {
        case 'boolean': parsed = Boolean(value); break
        case 'number': parsed = Number(value); if (Number.isNaN(parsed)) throw new Error('Invalid number'); break
        case 'json': parsed = typeof value === 'string' ? JSON.parse(value) : value; break
        default: parsed = String(value)
      }
    } catch (e: any) { throw new Error('Invalid value for type ' + def.data_type) }

    const res = await this.col.updateOne({ key }, { $set: { value: coerceToString(parsed, def.data_type), updated_at: new Date(), updated_by_admin_id: admin_id } })
    // bust cache
    this.cache.delete(key)
    return res.modifiedCount > 0
  }
}

export const settingsOperations = new SettingsOps()
export default settingsOperations

