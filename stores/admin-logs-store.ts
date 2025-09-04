import { create } from 'zustand'

export type AdminLog = {
  _type: 'user'|'redeem'|'referral'|'rewards'|'transfer'|'server'
  time: string | Date
  user_id?: number
  action?: string
  message?: string
  amount?: number
  details?: any
}

type Filters = {
  category?: AdminLog['_type'] | AdminLog['_type'][]
  user_id?: number
  server_id?: string
  search?: string
}

type State = {
  logs: AdminLog[]
  loading: boolean
  error?: string
  page: number
  perPage: number
  totalEstimated: number
  filters: Filters
  fetchLogs: (overrides?: Partial<Filters & { page: number; perPage: number }>) => Promise<boolean>
  setFilters: (filters: Partial<Filters>) => void
}

export const useAdminLogsStore = create<State>((set, get) => ({
  logs: [],
  loading: false,
  page: 1,
  perPage: 25,
  totalEstimated: 0,
  filters: {},
  setFilters: (filters) => set({ filters: { ...get().filters, ...filters }, page: 1 }),
  fetchLogs: async (overrides) => {
    try {
      set({ loading: true, error: undefined })
      const state = get()
      const page = overrides?.page ?? state.page
      const limit = overrides?.perPage ?? state.perPage
      const filters = { ...state.filters, ...(overrides || {}) }

      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (filters.category) params.set('category', Array.isArray(filters.category) ? filters.category.join(',') : filters.category)
      if (filters.user_id) params.set('user_id', String(filters.user_id))
      if (filters.server_id) params.set('server_id', String(filters.server_id))
      if (filters.search) params.set('search', filters.search)

      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))

      const res = await fetch(`/api/admin/logs?${params.toString()}`, { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) {
        set({ loading: false, error: json.message || 'Failed to fetch logs' })
        return false
      }
      set({ logs: json.logs || [], page, perPage: limit, totalEstimated: json.pagination?.total_estimated || 0, loading: false })
      return true
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Unexpected error' })
      return false
    }
  },
}))

