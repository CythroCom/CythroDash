import { create } from 'zustand'

export type Setting = {
  key: string
  value: any
  category: 'general'|'oauth'|'features'|'security'|'appearance'
  description?: string
  data_type: 'string'|'number'|'boolean'|'json'
  updated_at: string
  updated_by_admin_id: number
}

type State = {
  items: Setting[]
  loading: boolean
  error?: string
  fetchAll: () => Promise<boolean>
  fetchCategory: (category: Setting['category']) => Promise<boolean>
  update: (key: string, value: any) => Promise<boolean>
  import: (json: Setting[]) => Promise<boolean>
  export: () => string
}

export const useAdminSettingsStore = create<State>((set, get) => ({
  items: [],
  loading: false,
  fetchAll: async () => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/admin/settings', { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to fetch settings' }); return false }
      set({ items: json.items, loading: false })
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
  fetchCategory: async (category) => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch(`/api/admin/settings/${category}`, { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to fetch settings' }); return false }
      set({ items: json.items, loading: false })
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
  update: async (key, value) => {
    try {
      const prev = get().items
      const idx = prev.findIndex(s => s.key === key)
      const updated = [...prev]
      if (idx !== -1) updated[idx] = { ...updated[idx], value }
      set({ items: updated })

      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/admin/settings', { method: 'PUT', headers, credentials: 'include', body: JSON.stringify({ key, value }) })
      const json = await res.json()
      if (!json.success) { set({ items: prev, error: json.message || 'Failed to update setting' }); return false }
      return true
    } catch (e: any) { set({ error: e?.message || 'Unexpected error' }); return false }
  },
  import: async (data) => {
    try {
      // naive client-side import by PUTting each record
      for (const s of data) { await get().update(s.key, s.value) }
      return true
    } catch { return false }
  },
  export: () => {
    const items = get().items
    return JSON.stringify(items, null, 2)
  },
}))

