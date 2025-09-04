/**
 * CythroDash - Short Links Operations
 */

import { Collection } from 'mongodb'
import { connectToDatabase } from '@/database/index'
import { CythroDashShortLink, SHORT_LINKS_COLLECTION, SHORT_LINKS_INDEXES, slugPattern } from '@/database/tables/cythro_dash_short_links'

class ShortLinksOps {
  private collection!: Collection<CythroDashShortLink>
  private initialized = false
  private counter = 0

  private async init() {
    if (this.initialized) return
    const db = await connectToDatabase()
    this.collection = db.collection<CythroDashShortLink>(SHORT_LINKS_COLLECTION)
    for (const idx of SHORT_LINKS_INDEXES) {
      try { await this.collection.createIndex(idx.key as any, { name: idx.name, unique: (idx as any).unique }) } catch {}
    }
    const last = await this.collection.findOne({}, { sort: { id: -1 } })
    this.counter = last?.id || 0
    this.initialized = true
  }
  private nextId() { return ++this.counter }

  async createLink(data: { slug: string; target_url: string; created_by_admin_id: number; description?: string; is_active?: boolean }) {
    await this.init()
    const slug = data.slug.trim()
    if (!slugPattern.test(slug)) throw new Error('Invalid slug format')
    try { new URL(data.target_url) } catch { throw new Error('Invalid target URL') }

    const existing = await this.collection.findOne({ slug })
    if (existing) throw new Error('Slug already exists')

    const doc: CythroDashShortLink = {
      id: this.nextId(),
      slug,
      target_url: data.target_url,
      created_by_admin_id: data.created_by_admin_id,
      created_at: new Date(),
      click_count: 0,
      is_active: data.is_active ?? true,
      description: data.description,
    }
    await this.collection.insertOne(doc)
    return doc
  }

  async updateLink(id: number, updates: Partial<Pick<CythroDashShortLink, 'slug' | 'target_url' | 'description' | 'is_active'>>) {
    await this.init()
    const set: any = {}
    if (updates.slug !== undefined) {
      if (!slugPattern.test(updates.slug)) throw new Error('Invalid slug format')
      const dup = await this.collection.findOne({ slug: updates.slug, id: { $ne: id } })
      if (dup) throw new Error('Slug already exists')
      set.slug = updates.slug
    }
    if (updates.target_url !== undefined) {
      try { new URL(updates.target_url) } catch { throw new Error('Invalid target URL') }
      set.target_url = updates.target_url
    }
    if (updates.description !== undefined) set.description = updates.description
    if (updates.is_active !== undefined) set.is_active = updates.is_active

    const res = await this.collection.updateOne({ id }, { $set: set })
    if (!res.matchedCount) throw new Error('Link not found')
    return await this.collection.findOne({ id })
  }

  async deleteLink(id: number) {
    await this.init()
    const res = await this.collection.deleteOne({ id })
    return res.deletedCount > 0
  }

  async getLinks(params: { page?: number; limit?: number; search?: string }) {
    await this.init()
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25))
    const skip = (page - 1) * limit
    const filter: any = {}
    if (params.search) filter.$or = [
      { slug: { $regex: params.search, $options: 'i' } },
      { target_url: { $regex: params.search, $options: 'i' } },
      { description: { $regex: params.search, $options: 'i' } },
    ]
    const [items, total] = await Promise.all([
      this.collection.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(filter)
    ])
    return { items, total, page, limit }
  }

  async getBySlug(slug: string) {
    await this.init()
    return this.collection.findOne({ slug })
  }

  async incrementClickCount(slug: string) {
    await this.init()
    await this.collection.updateOne({ slug }, { $inc: { click_count: 1 } })
  }
}

export const shortLinksOperations = new ShortLinksOps()
export default shortLinksOperations

