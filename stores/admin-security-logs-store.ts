import { create } from 'zustand'
import { SecurityLogAction, SecurityLogSeverity, SecurityLogStatus } from '@/database/tables/cythro_dash_users_logs'

export type AdminSecurityLog = {
  id: number
  user_id: number
  action: SecurityLogAction
  severity: SecurityLogSeverity
  status: SecurityLogStatus
  description: string
  ip_address?: string
  user_agent?: string
  request_id?: string
  device_type?: string
  browser?: string
  os?: string
  is_suspicious?: boolean
  requires_attention?: boolean
  created_at: string | Date
}

export type SecurityLogsFilters = {
  page?: number
  limit?: number
  user_id?: number
  action?: SecurityLogAction | SecurityLogAction[]
  severity?: SecurityLogSeverity | SecurityLogSeverity[]
  status?: SecurityLogStatus | SecurityLogStatus[]
  ip_address?: string
  is_suspicious?: boolean
  requires_attention?: boolean
  date_from?: string
  date_to?: string
  sort_by?: 'created_at'|'severity'|'action'
  sort_order?: 'asc'|'desc'
}

type State = {
  logs: AdminSecurityLog[]
  loading: boolean
  error?: string
  page: number
  perPage: number
  total: number
  autoRefresh: boolean
  filters: SecurityLogsFilters
  setFilters: (patch: Partial<SecurityLogsFilters>) => void
  setAutoRefresh: (v: boolean) => void
  fetchLogs: (overrides?: Partial<SecurityLogsFilters>) => Promise<boolean>
  exportCsv: () => string
}

function buildParams(filters: SecurityLogsFilters) {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.user_id) params.set('user_id', String(filters.user_id))
  if (filters.action) params.set('action', Array.isArray(filters.action) ? filters.action.join(',') : filters.action)
  if (filters.severity) params.set('severity', Array.isArray(filters.severity) ? filters.severity.join(',') : filters.severity)
  if (filters.status) params.set('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
  if (filters.ip_address) params.set('ip_address', filters.ip_address)
  if (filters.is_suspicious !== undefined) params.set('is_suspicious', String(filters.is_suspicious))
  if (filters.requires_attention !== undefined) params.set('requires_attention', String(filters.requires_attention))
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_order) params.set('sort_order', filters.sort_order)
  return params
}

export const useAdminSecurityLogsStore = create<State>((set, get) => ({
  logs: [],
  loading: false,
  error: undefined,
  page: 1,
  perPage: 50,
  total: 0,
  autoRefresh: true,
  filters: { page: 1, limit: 50, sort_by: 'created_at', sort_order: 'desc' },

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch }, page: 1 })),
  setAutoRefresh: (v) => set({ autoRefresh: v }),

  fetchLogs: async (overrides) => {
    try {
      set({ loading: true, error: undefined })
      const state = get()
      const effective: SecurityLogsFilters = { ...state.filters, ...(overrides || {}) }
      const params = buildParams(effective)

      const { useAuthStore } = await import('@/stores/user-store')
      const u = useAuthStore.getState().currentUser
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (u) headers['x-user-data'] = encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role }))

      const res = await fetch(`/api/admin/security-logs?${params.toString()}`, { headers, credentials: 'include' })
      const json = await res.json()
      if (!json.success) { set({ loading: false, error: json.message || 'Failed to fetch security logs' }); return false }
      set({ logs: json.logs || [], loading: false, page: effective.page || 1, perPage: effective.limit || 50, total: json.pagination?.count || 0 })
      return true
    } catch (e: any) { set({ loading: false, error: e?.message || 'Unexpected error' }); return false }
  },

  exportCsv: () => {
    const rows = get().logs
    const header = ['id','user_id','action','severity','status','description','ip_address','created_at']
    const escape = (v: any) => {
      if (v === null || v === undefined) return ''
      const s = String(v).replace(/"/g, '""')
      if (/[",\n]/.test(s)) return `"${s}"`
      return s
    }
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push([
        r.id,
        r.user_id,
        r.action,
        r.severity,
        r.status,
        r.description,
        r.ip_address || '',
        new Date(r.created_at).toISOString(),
      ].map(escape).join(','))
    }
    return lines.join('\n')
  },
}))

