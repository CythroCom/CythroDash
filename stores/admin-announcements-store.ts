import { create } from 'zustand'

export type AdminAnnouncement = {
  id: number
  title: string
  content: string
  created_by_admin_id: number
  created_at: string
  updated_at: string
  is_visible: boolean
  priority: number
}

type State = {
  items: AdminAnnouncement[]
  total: number
  page: number
  perPage: number
  search?: string
  loading: boolean
  error?: string
  fetch: () => Promise<boolean>
  setSearch: (s: string) => void
  setPage: (p: number) => void
  create: (payload: { title: string; content: string; is_visible?: boolean; priority?: number }) => Promise<boolean>
  update: (id: number, updates: Partial<{ title: string; content: string; is_visible?: boolean; priority?: number }>) => Promise<boolean>
  remove: (id: number) => Promise<boolean>
}

export const useAdminAnnouncementsStore = create<State>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  perPage: 25,
  loading: false,
  fetch: async () => {
    try {
      set({ loading: true, error: undefined })
      const state = get()
      const params = new URLSearchParams()
      params.set('page', String(state.page))
      params.set('limit', String(state.perPage))
      if (state.search) params.set('search', state.search)

      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))

      const res = await fetch(`/api/admin/announcements?${params.toString()}`, { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to fetch' }); return false }
      set({ items: json.items || [], total: json.total || 0, loading: false })
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
  setSearch: (s) => set({ search: s, page: 1 }),
  setPage: (p) => set({ page: p }),
  create: async (payload) => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/admin/announcements', { method: 'POST', headers, credentials: 'include', body: JSON.stringify(payload) })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to create' }); return false }
      await get().fetch()
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
  update: async (id, updates) => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'PUT', headers, credentials: 'include', body: JSON.stringify(updates) })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to update' }); return false }
      await get().fetch()
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
  remove: async (id) => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE', headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to delete' }); return false }
      await get().fetch()
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
}))

