/**
 * CythroDash - Announcements Schema
 */

export interface CythroDashAnnouncement {
  id: number
  title: string
  content: string
  created_by_admin_id: number
  created_at: Date
  updated_at: Date
  is_visible: boolean
  priority: number
}

export const ANNOUNCEMENTS_COLLECTION = 'cythro_dash_announcements'

export const ANNOUNCEMENTS_INDEXES = [
  { key: { id: 1 }, name: 'id_unique', unique: true },
  { key: { is_visible: 1, priority: -1, created_at: -1 }, name: 'visible_priority_time' },
  { key: { created_by_admin_id: 1, created_at: -1 }, name: 'admin_time' },
]

