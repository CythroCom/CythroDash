import { create } from 'zustand'

export type UserAnnouncement = {
  id: number
  title: string
  content: string
  created_at: string
  is_visible: boolean
  priority: number
}

type State = {
  items: UserAnnouncement[]
  reads: Record<number, boolean>
  loading: boolean
  error?: string
  fetch: () => Promise<boolean>
  markRead: (id: number) => Promise<boolean>
}

export const useUserAnnouncementsStore = create<State>((set, get) => ({
  items: [],
  reads: {},
  loading: false,
  fetch: async () => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/announcements', { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to fetch' }); return false }
      set({ items: json.items || [], reads: json.reads || {}, loading: false })
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
  markRead: async (id) => {
    try {
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch(`/api/announcements/${id}/read`, { method: 'POST', headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) return false
      set(s => ({ reads: { ...s.reads, [id]: true } }))
      return true
    } catch { return false }
  }
}))

