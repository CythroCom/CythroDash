/**
 * CythroDash - Announcements Operations
 */

import { Collection } from 'mongodb'
import { connectToDatabase } from '@/database/index'
import { ANNOUNCEMENTS_COLLECTION, ANNOUNCEMENTS_INDEXES, CythroDashAnnouncement } from '@/database/tables/cythro_dash_announcements'
import { ANNOUNCEMENT_READS_COLLECTION, ANNOUNCEMENT_READS_INDEXES, CythroDashAnnouncementRead } from '@/database/tables/cythro_dash_announcement_reads'

class AnnouncementsOps {
  private col!: Collection<CythroDashAnnouncement>
  private reads!: Collection<CythroDashAnnouncementRead>
  private initialized = false
  private counter = 0

  private async init() {
    if (this.initialized) return
    const db = await connectToDatabase()
    this.col = db.collection(ANNOUNCEMENTS_COLLECTION)
    this.reads = db.collection(ANNOUNCEMENT_READS_COLLECTION)
    for (const idx of ANNOUNCEMENTS_INDEXES) { try { await this.col.createIndex(idx.key as any, { name: idx.name, unique: (idx as any).unique }) } catch {} }
    for (const idx of ANNOUNCEMENT_READS_INDEXES) { try { await this.reads.createIndex(idx.key as any, { name: idx.name, unique: (idx as any).unique }) } catch {} }
    const last = await this.col.findOne({}, { sort: { id: -1 } })
    this.counter = last?.id || 0
    this.initialized = true
  }
  private nextId() { return ++this.counter }

  async createAnnouncement(data: { title: string; content: string; created_by_admin_id: number; is_visible?: boolean; priority?: number }) {
    await this.init()
    const now = new Date()
    const doc: CythroDashAnnouncement = {
      id: this.nextId(),
      title: data.title.trim(),
      content: data.content,
      created_by_admin_id: data.created_by_admin_id,
      created_at: now,
      updated_at: now,
      is_visible: data.is_visible ?? true,
      priority: Number.isFinite(data.priority) ? Number(data.priority) : 0,
    }
    await this.col.insertOne(doc)
    return doc
  }

  async updateAnnouncement(id: number, changes: Partial<Pick<CythroDashAnnouncement, 'title'|'content'|'is_visible'|'priority'>>) {
    await this.init()
    const set: any = {}
    if (changes.title !== undefined) set.title = changes.title
    if (changes.content !== undefined) set.content = changes.content
    if (changes.is_visible !== undefined) set.is_visible = changes.is_visible
    if (changes.priority !== undefined) set.priority = Number(changes.priority) || 0
    set.updated_at = new Date()
    const res = await this.col.updateOne({ id }, { $set: set })
    if (!res.matchedCount) throw new Error('Announcement not found')
    return this.col.findOne({ id })
  }

  async deleteAnnouncement(id: number) {
    await this.init()
    const res = await this.col.deleteOne({ id })
    return res.deletedCount > 0
  }

  async getAnnouncements(params: { page?: number; limit?: number; search?: string }) {
    await this.init()
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25))
    const skip = (page - 1) * limit
    const filter: any = {}
    if (params.search) filter.$or = [
      { title: { $regex: params.search, $options: 'i' } },
      { content: { $regex: params.search, $options: 'i' } },
    ]
    const [items, total] = await Promise.all([
      this.col.find(filter).sort({ is_visible: -1, priority: -1, created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.col.countDocuments(filter)
    ])
    return { items, total, page, limit }
  }

  async getVisibleAnnouncements() {
    await this.init()
    return this.col.find({ is_visible: true }).sort({ priority: -1, created_at: -1 }).toArray()
  }

  async markAnnouncementAsRead(user_id: number, announcement_id: number) {
    await this.init()
    const read: CythroDashAnnouncementRead = { user_id, announcement_id, read_at: new Date() }
    await this.reads.updateOne({ user_id, announcement_id }, { $set: read }, { upsert: true })
    return true
  }

  async getUserReadStatus(user_id: number, announcement_id: number) {
    await this.init()
    const rec = await this.reads.findOne({ user_id, announcement_id })
    return !!rec
  }
}

export const announcementsOperations = new AnnouncementsOps()
export default announcementsOperations

