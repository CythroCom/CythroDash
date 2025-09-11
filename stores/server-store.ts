"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ServerStatus = "online" | "offline" | "starting" | "stopping" | "unknown"
// Format uptime as Hh Mm Ss (compact)
const formatUptime = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export type ServerType = "Minecraft" | "Rust" | "CS:GO" | "Valheim" | "ARK" | "Discord" | "Web" | "Database" | "Game" | "Unknown"

export interface ServerResources {
  memory: {
    used: number
    limit: number
    percentage: number
  }
  disk: {
    used: number
    limit: number
    percentage: number
  }
  cpu: {
    used: number
    limit: number
    percentage: number
  }
  swap?: number
  io?: number
}

export interface ServerAllocation {
  id: number
  ip: string
  port: number
  alias?: string
  assigned: boolean
}

export type Server = {
  id: string
  pterodactyl_id?: number
  pterodactyl_identifier?: string
  name: string
  description?: string
  status: ServerStatus
  power_state?: ServerStatus | 'crashed'
  billing_status?: 'active' | 'overdue' | 'suspended' | 'cancelled' | 'terminated'

  // Resource information
  resources?: ServerResources

  // Server configuration
  startup?: string
  environment?: Record<string, string>

  // Server details
  node_id?: number
  egg_id?: number
  allocation?: number
  allocations?: ServerAllocation[]

  // Timestamps
  created_at?: string
  updated_at?: string

  // Display information (legacy compatibility)
  players: string
  cpu: string
  memory: string
  uptime: string
  uptime_seconds?: number
  type: ServerType
}

export interface UserPermissions {
  can_create_servers: boolean
  max_servers: number | null
  current_servers: number
  requires_verification: boolean
}

type ServerStore = {
  // Data state
  servers: Server[]
  userPermissions: UserPermissions | null

  // UI state
  isLoading: boolean
  error: string | null
  lastFetch: Date | null

  // Actions
  fetchServers: (filters?: { status?: ServerStatus; sort_by?: string; sort_order?: string }) => Promise<boolean>
  fetchServerById: (id: string) => Promise<Server | null>
  refreshServer: (id: string) => Promise<boolean>

  // Live client API actions
  fetchLiveStatus: (server: { id: string; pterodactyl_id?: number | string }) => Promise<{
    success: boolean;
    data?: {
      state: 'running' | 'offline' | 'starting' | 'stopping' | 'unknown'
      is_suspended: boolean
      cpu_absolute: number
      memory_bytes: number
      memory_limit_bytes: number
      disk_bytes: number
      network_rx_bytes: number
      network_tx_bytes: number
      uptime_ms: number
    }
  }>
  fetchLiveDetails: (server: { id: string; pterodactyl_id?: number | string }) => Promise<any>
  powerAction: (server: { id: string; pterodactyl_id?: number | string }, action: 'start'|'stop'|'restart'|'kill') => Promise<boolean>

  // Centralized live updates
  startLivePolling: (ids?: string[]) => void
  stopLivePolling: () => void
  startUptimeTicker: () => void
  stopUptimeTicker: () => void

  // Legacy actions (for backward compatibility)
  create: (data: Partial<Server>) => Server
  remove: (id: string) => void
  update: (id: string, patch: Partial<Server>) => void
  getById: (id?: string | string[]) => Server | undefined

  // New actions
  clearError: () => void
  clearCache: () => void
}

// Cache duration: 2 minutes
const CACHE_DURATION = 2 * 60 * 1000

export const useServerStore = create<ServerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      servers: [],
      userPermissions: null,
      isLoading: false,
      error: null,
      lastFetch: null,

      // Check if cache is valid
      isCacheValid: () => {
        const { lastFetch } = get()
        if (!lastFetch) return false
        return new Date().getTime() - lastFetch.getTime() < CACHE_DURATION
      },

      // Fetch servers from API
      fetchServers: async (filters = {}) => {
        const state = get()

        // Check cache
        if ((state as any).isCacheValid() && state.servers.length > 0) {
          return true
        }

        set({ isLoading: true, error: null })

        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return false
          }

          const params = new URLSearchParams()
          if (filters.status) params.append('status', filters.status)
          if (filters.sort_by) params.append('sort_by', filters.sort_by)
          if (filters.sort_order) params.append('sort_order', filters.sort_order)
          params.append('include_details', 'true')

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role
          }))

          const response = await fetch(`/api/servers/user?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success) {
            const servers = (result.servers || []) as Server[]
            set({
              servers,
              userPermissions: result.user_permissions || null,
              lastFetch: new Date()
            })
            return true
          } else {
            set({ error: result.message || 'Failed to fetch servers' })
            return false
          }
        } catch (error) {
          console.error('Error fetching servers:', error)
          set({ error: 'Network error occurred while fetching servers' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      // Fetch individual server by ID
      fetchServerById: async (id: string): Promise<Server | null> => {
        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return null
          }

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role
          }))

          // Try to find server in current servers list first
          const existingServer = get().servers.find(s => s.id === id)
          if (existingServer) {
            return existingServer
          }

          // If not found, fetch from user servers API and find the specific server
          const response = await fetch(`/api/servers/user`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success && result.servers) {
            // Find the specific server in the response
            const foundServer = result.servers.find((server: any) => server.id === id)

            if (foundServer) {
              // Update the servers list with all servers from the response
              set({
                servers: result.servers,
                userPermissions: result.user_permissions || null
              })
              return foundServer
            } else {
              set({ error: `Server with ID ${id} not found` })
              return null
            }
          } else {
            set({ error: result.message || 'Failed to fetch server details' })
            return null
          }
        } catch (error) {
          console.error('Error fetching server details:', error)
          set({ error: 'Network error occurred while fetching server details' })
          return null
        }
      },

      // Refresh individual server
      refreshServer: async (id: string): Promise<boolean> => {
        const server = await get().fetchServerById(id)
        if (!server) return false
        // Optionally refresh live status after fetching servers list
        try {
          await (get() as any).fetchLiveStatus({ id: server.id })
        } catch {}
        return true
      },

      // Live status from client API
      fetchLiveStatus: async (server: { id: string; pterodactyl_id?: number | string }) => {
        try {
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) return { success: false }

          const headers: HeadersInit = { 'Content-Type': 'application/json' }
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id, username: currentUser.username, email: currentUser.email, role: currentUser.role
          }))

          const idParam = (server.pterodactyl_id ?? server.id).toString()
          const resp = await fetch(`/api/client/servers/${idParam}/status`, { headers, credentials: 'include' })
          const json = await resp.json()
          if (json.success && json.data) {
            const s = get().servers
            const idx = s.findIndex(x => x.id === server.id)
            if (idx >= 0) {
              const live = json.data
              const statusMap: Record<string, ServerStatus> = {
                running: 'online', offline: 'offline', starting: 'starting', stopping: 'stopping', unknown: 'unknown'
              }
              const status = statusMap[live.state] || 'unknown'
              const memLimitMb = Math.max(1, Math.round((live.memory_limit_bytes || 0) / (1024*1024)))
              const memUsedMb = Math.round((live.memory_bytes || 0) / (1024*1024))
              const memPct = Math.min(100, Math.round(memLimitMb ? (memUsedMb / memLimitMb) * 100 : 0))
              const diskUsedGb = Math.round((live.disk_bytes || 0) / (1024*1024*1024))
              const uptimeSec = live.uptime_ms ? Math.round(live.uptime_ms/1000) : (s[idx].uptime_seconds ?? 0)

              const updated: Server = {
                ...s[idx],
                status,
                cpu: `${Math.round(live.cpu_absolute || 0)}%`,
                memory: `${memUsedMb}MB/${memLimitMb}MB`,
                uptime: formatUptime(uptimeSec),
                uptime_seconds: uptimeSec,
                resources: {
                  memory: { used: memUsedMb, limit: memLimitMb, percentage: memPct },
                  disk: { used: diskUsedGb, limit: s[idx].resources?.disk.limit ?? 0, percentage: s[idx].resources?.disk.percentage ?? 0 },
                  cpu: { used: Math.round(live.cpu_absolute || 0), limit: 100, percentage: Math.round(live.cpu_absolute || 0) }
                }
              }
              set({ servers: [...s.slice(0, idx), updated, ...s.slice(idx+1)] })
            }
          }
          return json
        } catch (e) {
          return { success: false }
        }
      },

      // Live details from client API
      fetchLiveDetails: async (server: { id: string; pterodactyl_id?: number | string }) => {
        try {
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) return { success: false }
          const headers: HeadersInit = { 'Content-Type': 'application/json' }
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id, username: currentUser.username, email: currentUser.email, role: currentUser.role
          }))
          const idParam = (server.pterodactyl_id ?? server.id).toString()
          const resp = await fetch(`/api/client/servers/${idParam}/details`, { headers, credentials: 'include' })
          return await resp.json()
        } catch (e) {
          return { success: false }
        }
      },

      // Power actions via client API
      powerAction: async (server: { id: string; pterodactyl_id?: number | string }, action: 'start'|'stop'|'restart'|'kill') => {
        try {
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) return false
          const headers: HeadersInit = { 'Content-Type': 'application/json' }
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id, username: currentUser.username, email: currentUser.email, role: currentUser.role
          }))
          const idParam = (server.pterodactyl_id ?? server.id).toString()
          const resp = await fetch(`/api/client/servers/${idParam}/power`, {
            method: 'POST', headers, credentials: 'include', body: JSON.stringify({ action })
          })
          const json = await resp.json()
          return !!json.success
        } catch (e) {
          return false
        }
      },

      // Legacy create function (for backward compatibility)
      create: (data) => {
        const newServer: Server = {
          id: Date.now().toString(),
          name: data.name ?? "New Server",
          status: data.status ?? "offline",
          players: data.players ?? "0/10",
          cpu: data.cpu ?? "0%",
          memory: data.memory ?? "0GB/2GB",
          uptime: data.uptime ?? "Offline",
          type: (data.type as ServerType) ?? "Minecraft",
          description: data.description ?? "",
          created_at: new Date().toISOString()
        }
        set((s) => ({ servers: [newServer, ...s.servers] }))
        return newServer
      },

      // Legacy remove function (for backward compatibility)
      remove: (id) => set((s) => ({ servers: s.servers.filter((sv) => sv.id !== id) })),

      // Legacy update function (for backward compatibility)
      update: (id, patch) =>
        set((s) => ({
          servers: s.servers.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)),
        })),

      // Legacy getById function (for backward compatibility)
      getById: (id) => {
        const idStr = Array.isArray(id) ? id[0] : id
        return get().servers.find((sv) => sv.id === idStr)
      },

      // Centralized live polling for multiple servers (2s interval)
      startLivePolling: (ids?: string[]) => {
        const state = get() as any
        if (state._livePollTimer) return
        const poll = async () => {
          const serverIds = (ids && ids.length ? ids : get().servers.map(s => s.id))
            .map(String)
          if (serverIds.length === 0) return
          try {
            await Promise.all(serverIds.map(id => (get() as any).fetchLiveStatus({ id })))
          } catch {}
        }
        // Immediate run then interval
        void poll()
        const t = setInterval(poll, 2000)
        ;(state as any)._livePollTimer = t
      },

      stopLivePolling: () => {
        const state = get() as any
        if (state._livePollTimer) {
          clearInterval(state._livePollTimer)
          state._livePollTimer = undefined
        }
      },

      // Per-second uptime ticker (no API calls)
      startUptimeTicker: () => {
        const state = get() as any
        if (state._uptimeTimer) return
        const t = setInterval(() => {
          const s = get().servers
          if (!s || s.length === 0) return
          const updated = s.map(sv => {
            if ((sv.status === 'online' || sv.status === 'starting') && typeof sv.uptime_seconds === 'number') {
              const next = { ...sv, uptime_seconds: (sv.uptime_seconds || 0) + 1, uptime: formatUptime((sv.uptime_seconds || 0) + 1) }
              return next
            }
            return sv
          })
          set({ servers: updated })
        }, 1000)
        ;(state as any)._uptimeTimer = t
      },

      stopUptimeTicker: () => {
        const state = get() as any
        if (state._uptimeTimer) {
          clearInterval(state._uptimeTimer)
          state._uptimeTimer = undefined
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null })
      },

      // Clear cache
      clearCache: () => {
        const state = get() as any
        if (state._livePollTimer) { clearInterval(state._livePollTimer); state._livePollTimer = undefined }
        if (state._uptimeTimer) { clearInterval(state._uptimeTimer); state._uptimeTimer = undefined }
        set({
          servers: [],
          userPermissions: null,
          lastFetch: null,
          error: null
        })
      }
    }),
    {
      name: "panel-servers",
      partialize: (state) => ({
        // Only persist servers data, not loading states
        servers: state.servers
      })
    }
  )
)
