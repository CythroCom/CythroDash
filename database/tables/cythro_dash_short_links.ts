/**
 * CythroDash - Short Links Schema
 */

export interface CythroDashShortLink {
  id: number
  slug: string
  target_url: string
  created_by_admin_id: number
  created_at: Date
  click_count: number
  is_active: boolean
  description?: string
}

export const SHORT_LINKS_COLLECTION = 'cythro_dash_short_links'

export const SHORT_LINKS_INDEXES = [
  { key: { id: 1 }, name: 'id_unique', unique: true },
  { key: { slug: 1 }, name: 'slug_unique', unique: true },
  { key: { created_by_admin_id: 1, created_at: -1 }, name: 'admin_time' },
  { key: { is_active: 1, slug: 1 }, name: 'active_slug' },
]

export const slugPattern = /^[A-Za-z0-9_-]{1,64}$/

