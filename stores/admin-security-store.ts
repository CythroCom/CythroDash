import { create } from 'zustand'

export type SecurityMetrics = {
  threat_level: 'low'|'medium'|'high'
  summary: {
    total_events_24h: number
    suspicious_24h: number
    failed_logins_24h: number
  }
  recent_events: Array<{
    id: number
    user_id: number
    action: string
    severity: string
    message: string
    ip_address?: string
    created_at: string
  }>
  blocked_ips: Array<{ ip_address: string; count: number; last_seen: string; reason?: string }>
  active_sessions: { users_active_30m: number; examples: Array<{ id: number; username: string; last_activity?: string }> }
}

type State = {
  data: SecurityMetrics | null
  loading: boolean
  error?: string
  fetchSecurityData: () => Promise<boolean>
  refreshMetrics: () => Promise<boolean>
  blockIP: (ip: string, reason: string, expires_at?: string | null) => Promise<boolean>
  unblockIP: (ip: string) => Promise<boolean>
  blockedPage: number
  blockedPerPage: number
  blockedSearch?: string
  setBlockedFilter: (p: Partial<{ page: number; perPage: number; search?: string }>) => void
  fetchBlocked: () => Promise<boolean>
}

export const useAdminSecurityStore = create<State>((set, get) => ({
  data: null,
  loading: false,
  error: undefined,
  blockedPage: 1,
  blockedPerPage: 10,
  blockedSearch: undefined,

  fetchSecurityData: async () => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/admin/security', { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) {
        set({ loading: false, error: json.message || 'Failed to fetch security data' })
        return false
      }
      set({ data: json.data, loading: false })
      return true
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Unexpected error' })
      return false
    }
  },

  refreshMetrics: async () => get().fetchSecurityData(),

  setBlockedFilter: (p) => set(s => ({
    blockedPage: p.page ?? s.blockedPage,
    blockedPerPage: p.perPage ?? s.blockedPerPage,
    blockedSearch: p.search ?? s.blockedSearch
  })),

  fetchBlocked: async () => {
    try {
      const state = get()
      const page = state.blockedPage
      const limit = state.blockedPerPage
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (state.blockedSearch) params.set('search', state.blockedSearch)
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch(`/api/admin/security/blocked-ips?${params.toString()}`, { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ error: json.message || 'Failed to fetch blocked IPs' }); return false }
      const mapped = (json.items || []).map((d: any) => ({ ip_address: d.ip_address, count: d.metadata?.hit_count || 0, last_seen: d.expires_at || d.blocked_at, reason: d.reason }))
      set(s => ({ data: { ...(s.data || {}), blocked_ips: mapped } as any }))
      return true
    } catch (e: any) { set({ error: e?.message || 'Unexpected error' }); return false }
  },

  blockIP: async (ip, reason, expires_at) => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/admin/security/block-ip', { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ ip_address: ip, reason, expires_at }) })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to block IP' }); return false }
      await get().fetchBlocked()
      await get().fetchSecurityData()
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },

  unblockIP: async (ip) => {
    try {
      set({ loading: true, error: undefined })
      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))
      const res = await fetch('/api/admin/security/unblock-ip', { method: 'DELETE', headers, credentials: 'include', body: JSON.stringify({ ip_address: ip }) })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to unblock IP' }); return false }
      await get().fetchBlocked()
      await get().fetchSecurityData()
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },
}))

