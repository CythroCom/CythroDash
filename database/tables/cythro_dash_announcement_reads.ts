/**
 * CythroDash - Announcement Reads Schema
 */

export interface CythroDashAnnouncementRead {
  user_id: number
  announcement_id: number
  read_at: Date
}

export const ANNOUNCEMENT_READS_COLLECTION = 'cythro_dash_announcement_reads'

export const ANNOUNCEMENT_READS_INDEXES = [
  { key: { user_id: 1, announcement_id: 1 }, name: 'user_announcement_unique', unique: true },
  { key: { announcement_id: 1 }, name: 'by_announcement' },
]

