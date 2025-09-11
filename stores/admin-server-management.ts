"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"
import { ServerStatus, BillingStatus, PowerState } from "@/database/tables/cythro_dash_servers"



// Temporary compatibility: include x-user-data header built from current user
function getAdminAuthHeaders(): HeadersInit {
  const base: HeadersInit = { 'Content-Type': 'application/json' }
  try {
    const u: any = useAuthStore.getState().currentUser
    if (u && u.id && u.username && u.email) {
      return { ...base, 'x-user-data': encodeURIComponent(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role })) }
    }
  } catch {}
  return base
}


// Types for server management
export type AdminServerSummary = {
  id: string
  pterodactyl_id?: number
  pterodactyl_identifier?: string
  pterodactyl_uuid?: string
  name: string
  description?: string
  user_id: number
  server_type_id: string
  software_id: string
  location_id: string
  status: ServerStatus
  power_state: PowerState
  billing_status: BillingStatus
  limits: {
    memory: number
    disk: number
    cpu: number
    swap: number
    io: number
    databases: number
    allocations: number
    backups: number
  }
  configuration: {
    environment_variables: Record<string, string>
    auto_start: boolean
    crash_detection: boolean
    backup_enabled: boolean
    startup_command?: string
  }
  billing: {
    plan_id: string
    next_billing_date: string
    total_cost: number
    monthly_cost: number
    setup_fee_paid: number
    billing_cycle: string
  }
  created_at: string
  updated_at: string
  last_activity?: string
  expiry_date?: string
  creation_error?: string
}

export type AdminServersPagination = {
  current_page: number
  total_pages: number
  total_items: number
  items_per_page: number
}

export type AdminServersStats = {
  total_servers: number
  active_servers: number
  suspended_servers: number
  creating_servers: number
  error_servers: number
  online_servers: number
  offline_servers: number
  starting_servers: number
  stopping_servers: number
  total_users: number
  total_monthly_revenue: number
}

export type GetServersFilters = {
  page?: number
  limit?: number
  search?: string
  status?: ServerStatus
  billing_status?: BillingStatus
  power_state?: PowerState
  server_type_id?: string
  location_id?: string
  user_id?: number
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'status' | 'user_id'
  sort_order?: 'asc' | 'desc'
  include_stats?: boolean
}

export type GetServersResponse = {
  success: boolean
  message?: string
  servers?: AdminServerSummary[]
  pagination?: AdminServersPagination | null
  stats?: AdminServersStats | null
  errors?: any[]
}

export type CreateServerData = {
  name: string
  description?: string
  user_id: number
  server_type_id: string
  software_id: string
  location_id: string
  plan_id: string
  environment_variables?: Record<string, string>
  startup_command?: string
  docker_image?: string
}

export type UpdateServerData = {
  name?: string
  description?: string
  status?: ServerStatus
  billing_status?: BillingStatus
  power_state?: PowerState
  limits?: {
    memory?: number
    disk?: number
    cpu?: number
    swap?: number
    io?: number
    databases?: number
    allocations?: number
    backups?: number
  }
  configuration?: {
    environment_variables?: Record<string, string>
    auto_start?: boolean
    crash_detection?: boolean
    backup_enabled?: boolean
    startup_command?: string
  }
  billing?: {
    plan_id?: string
    next_billing_date?: string
    monthly_cost?: number
    billing_cycle?: string
  }
}

export type ServerResponse = {
  success: boolean
  message: string
  server?: AdminServerSummary
  pterodactyl_data?: any
  error?: string
}

export type ServerActionResponse = {
  success: boolean
  message: string
  server?: AdminServerSummary
  pterodactyl_data?: any
  status?: {
    database_power_state: PowerState
    database_status: ServerStatus
    pterodactyl_state: string
    last_activity?: string
  }
}

export type ServerMetricsResponse = {
  success: boolean
  message: string
  server_id: string
  timeframe: string
  interval: string
  current_stats?: any
  historical_metrics: Record<string, Array<{ timestamp: string; value: number }>>
  summary: Record<string, { current: number; average: number; min: number; max: number; trend: number }>
  metadata: {
    data_points: number
    last_updated: string
    server_limits: any
  }
}

export type ServerLogsResponse = {
  success: boolean
  message: string
  server_id: string
  log_type: string
  logs: Array<{
    id: string | number
    timestamp: string
    type: string
    action?: string
    level?: string
    message: string
    user_id?: number
    details?: any
    source?: string
  }>
  pagination: AdminServersPagination
  stats: {
    total_logs: number
    log_types: Record<string, number>
    date_range: { earliest: string | null; latest: string | null }
    action_breakdown?: Record<string, number>
  }
  filters: any
}

type AdminServerManagementStore = {
  // Servers list state
  serversList: AdminServerSummary[]
  serversListPagination: AdminServersPagination | null
  serversListStats: AdminServersStats | null
  serversListLastFetch: Date | null
  serversListLastFilters: GetServersFilters | null
  isLoadingServersList: boolean

  // Single server state
  selectedServer: AdminServerSummary | null
  isLoadingSelectedServer: boolean

  // Server metrics state
  serverMetrics: Record<string, ServerMetricsResponse>
  isLoadingServerMetrics: Record<string, boolean>

  // Server logs state
  serverLogs: Record<string, ServerLogsResponse>
  isLoadingServerLogs: Record<string, boolean>

  // Cache settings
  serversCacheValidDuration: number // 1 minute in milliseconds
  metricsCacheValidDuration: number // 30 seconds in milliseconds
  logsCacheValidDuration: number // 10 seconds in milliseconds

  // Actions
  getServersList: (filters?: GetServersFilters, forceRefresh?: boolean) => Promise<GetServersResponse>
  getServerById: (serverId: string, forceRefresh?: boolean) => Promise<ServerResponse>
  createServer: (serverData: CreateServerData) => Promise<ServerResponse>
  updateServer: (serverId: string, updateData: UpdateServerData) => Promise<ServerResponse>
  deleteServer: (serverId: string) => Promise<ServerResponse>

  // Server actions
  executeServerAction: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill' | 'status', force?: boolean) => Promise<ServerActionResponse>
  getAvailableActions: (serverId: string) => Promise<{ success: boolean; available_actions: string[]; current_state: any }>

  // Server metrics and logs
  getServerMetrics: (serverId: string, timeframe?: string, interval?: string, metrics?: string[], forceRefresh?: boolean) => Promise<ServerMetricsResponse>
  getServerLogs: (serverId: string, logType?: string, page?: number, limit?: number, filters?: any, forceRefresh?: boolean) => Promise<ServerLogsResponse>
  clearServerLogs: (serverId: string, clearType?: string, beforeDate?: string) => Promise<{ success: boolean; message: string }>

  // Cache management
  clearServersListCache: () => void
  clearSelectedServer: () => void
  clearServerMetrics: (serverId?: string) => void
  clearServerLogsCache: (serverId?: string) => void

  // Utility actions
  isServersCacheValid: () => boolean
  shouldRefreshServersData: (newFilters?: GetServersFilters) => boolean
}

export const useAdminServerManagementStore = create<AdminServerManagementStore>()(
  persist(
    (set, get) => ({
      // Initial state
      serversList: [],
      serversListPagination: null,
      serversListStats: null,
      serversListLastFetch: null,
      serversListLastFilters: null,
      isLoadingServersList: false,
      selectedServer: null,
      isLoadingSelectedServer: false,
      serverMetrics: {},
      isLoadingServerMetrics: {},
      serverLogs: {},
      isLoadingServerLogs: {},
      serversCacheValidDuration: 1 * 60 * 1000, // 1 minute
      metricsCacheValidDuration: 30 * 1000, // 30 seconds
      logsCacheValidDuration: 10 * 1000, // 10 seconds

      // Get servers list with pagination and filtering
      getServersList: async (filters: GetServersFilters = {}, forceRefresh: boolean = false) => {
        const {
          serversList,
          serversListLastFetch,
          serversListLastFilters,
          isLoadingServersList,
          isServersCacheValid,
          shouldRefreshServersData
        } = get()

        // Check if we should use cached data
        const shouldUseCache = !forceRefresh &&
                              isServersCacheValid() &&
                              !shouldRefreshServersData(filters) &&
                              serversList.length > 0

        if (shouldUseCache) {
          console.log('Returning cached servers list')
          return {
            success: true,
            message: 'Servers list retrieved from cache',
            servers: serversList,
            pagination: get().serversListPagination,
            stats: get().serversListStats
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingServersList && !forceRefresh) {
          console.log('Servers list request already in progress')
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        set((state) => ({ ...state, isLoadingServersList: true }))

        try {
          console.log('Fetching servers list with filters:', filters)

          // Build query parameters
          const params = new URLSearchParams()

          if (filters.page !== undefined) params.append('page', filters.page.toString())
          if (filters.limit !== undefined) params.append('limit', filters.limit.toString())
          if (filters.search) params.append('search', filters.search)
          if (filters.status) params.append('status', filters.status)
          if (filters.billing_status) params.append('billing_status', filters.billing_status)
          if (filters.power_state) params.append('power_state', filters.power_state)
          if (filters.server_type_id) params.append('server_type_id', filters.server_type_id)
          if (filters.location_id) params.append('location_id', filters.location_id)
          if (filters.user_id !== undefined) params.append('user_id', filters.user_id.toString())
          if (filters.sort_by) params.append('sort_by', filters.sort_by)
          if (filters.sort_order) params.append('sort_order', filters.sort_order)
          if (filters.include_stats !== undefined) params.append('include_stats', filters.include_stats.toString())

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/servers?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Servers list API response:', result)

          if (result.success && result.servers) {
            // Cache the servers data
            set((state) => ({
              ...state,
              serversList: result.servers,
              serversListPagination: result.pagination || null,
              serversListStats: result.stats || null,
              serversListLastFetch: new Date(),
              serversListLastFilters: filters,
              isLoadingServersList: false
            }))

            return {
              success: true,
              message: result.message || 'Servers retrieved successfully',
              servers: result.servers,
              pagination: result.pagination,
              stats: result.stats
            }
          } else {
            set((state) => ({ ...state, isLoadingServersList: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve servers',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get servers list error:', error)
          set((state) => ({ ...state, isLoadingServersList: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving servers list'
          }
        }
      },

      // Get specific server by ID
      getServerById: async (serverId: string, forceRefresh: boolean = false) => {
        const { selectedServer, isLoadingSelectedServer } = get()

        // Check if we already have this server cached
        if (!forceRefresh && selectedServer && selectedServer.id === serverId) {
          console.log('Returning cached server data for ID:', serverId)
          return {
            success: true,
            message: 'Server data retrieved from cache',
            server: selectedServer
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingSelectedServer && !forceRefresh) {
          console.log('Server request already in progress for ID:', serverId)
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        set((state) => ({ ...state, isLoadingSelectedServer: true }))

        try {
          console.log('Fetching server by ID:', serverId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/servers/${serverId}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Server by ID API response:', result)

          if (result.success && result.server) {
            // Cache the server data
            set((state) => ({
              ...state,
              selectedServer: result.server,
              isLoadingSelectedServer: false
            }))

            return {
              success: true,
              message: result.message || 'Server retrieved successfully',
              server: result.server,
              pterodactyl_data: result.pterodactyl_data
            }
          } else {
            set((state) => ({ ...state, isLoadingSelectedServer: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve server'
            }
          }
        } catch (error) {
          console.error('Get server by ID error:', error)
          set((state) => ({ ...state, isLoadingSelectedServer: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving server'
          }
        }
      },

      // Create new server
      createServer: async (serverData: CreateServerData) => {
        try {
          console.log('Creating new server:', serverData)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch('/api/admin/servers', {
            method: 'POST',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify(serverData)
          })

          const result = await response.json()
          console.log('Create server API response:', result)

          if (result.success && result.server) {
            // Clear cache to force refresh on next list request
            get().clearServersListCache()

            return {
              success: true,
              message: result.message || 'Server created successfully',
              server: result.server,
              pterodactyl_data: result.pterodactyl_data
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to create server'
            }
          }
        } catch (error) {
          console.error('Create server error:', error)
          return {
            success: false,
            message: 'Network error occurred while creating server'
          }
        }
      },

      // Update existing server
      updateServer: async (serverId: string, updateData: UpdateServerData) => {
        try {
          console.log('Updating server:', serverId, updateData)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/servers/${serverId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify(updateData)
          })

          const result = await response.json()
          console.log('Update server API response:', result)

          if (result.success && result.server) {
            // Update cached data
            const { selectedServer } = get()
            if (selectedServer && selectedServer.id === serverId) {
              set((state) => ({
                ...state,
                selectedServer: result.server
              }))
            }

            // Clear list cache to force refresh
            get().clearServersListCache()

            return {
              success: true,
              message: result.message || 'Server updated successfully',
              server: result.server,
              pterodactyl_sync: result.pterodactyl_sync
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to update server'
            }
          }
        } catch (error) {
          console.error('Update server error:', error)
          return {
            success: false,
            message: 'Network error occurred while updating server'
          }
        }
      },

      // Delete server
      deleteServer: async (serverId: string) => {
        try {
          console.log('Deleting server:', serverId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/servers/${serverId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Delete server API response:', result)

          if (result.success) {
            // Clear cached data
            const { selectedServer } = get()
            if (selectedServer && selectedServer.id === serverId) {
              get().clearSelectedServer()
            }

            // Clear list cache to force refresh
            get().clearServersListCache()

            return {
              success: true,
              message: result.message || 'Server deleted successfully'
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to delete server'
            }
          }
        } catch (error) {
          console.error('Delete server error:', error)
          return {
            success: false,
            message: 'Network error occurred while deleting server'
          }
        }
      },

      // Execute server action
      executeServerAction: async (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill' | 'status', force: boolean = false) => {
        try {
          console.log('Executing server action:', serverId, action, force)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/servers/${serverId}/actions`, {
            method: 'POST',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({ action, force })
          })

          const result = await response.json()
          console.log('Server action API response:', result)

          if (result.success) {
            // Update cached server data if available
            const { selectedServer } = get()
            if (selectedServer && selectedServer.id === serverId && result.server) {
              set((state) => ({
                ...state,
                selectedServer: result.server
              }))
            }

            // Clear list cache to force refresh for status updates
            get().clearServersListCache()

            return {
              success: true,
              message: result.message || `Server ${action} executed successfully`,
              server: result.server,
              pterodactyl_data: result.pterodactyl_data,
              status: result.status
            }
          } else {
            return {
              success: false,
              message: result.message || `Failed to execute server ${action}`
            }
          }
        } catch (error) {
          console.error('Execute server action error:', error)
          return {
            success: false,
            message: `Network error occurred while executing server ${action}`
          }
        }
      },

      // Get available actions for server
      getAvailableActions: async (serverId: string) => {
        try {
          console.log('Getting available actions for server:', serverId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/servers/${serverId}/actions`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Available actions API response:', result)

          return {
            success: result.success || false,
            available_actions: result.available_actions || [],
            current_state: result.current_state || {}
          }
        } catch (error) {
          console.error('Get available actions error:', error)
          return {
            success: false,
            available_actions: [],
            current_state: {}
          }
        }
      },

      // Get server metrics
      getServerMetrics: async (serverId: string, timeframe: string = '1h', interval: string = '5m', metrics?: string[], forceRefresh: boolean = false) => {
        const { serverMetrics, isLoadingServerMetrics } = get()
        const cacheKey = `${serverId}_${timeframe}_${interval}_${JSON.stringify(metrics || [])}`

        // Check if we already have this metrics data cached
        if (!forceRefresh && serverMetrics[cacheKey]) {
          console.log('Returning cached metrics data for server:', serverId)
          return serverMetrics[cacheKey]
        }

        // Prevent multiple simultaneous requests
        if (isLoadingServerMetrics[cacheKey] && !forceRefresh) {
          console.log('Metrics request already in progress for server:', serverId)
          return {
            success: false,
            message: 'Request already in progress',
            server_id: serverId,
            timeframe,
            interval,
            historical_metrics: {},
            summary: {},
            metadata: { data_points: 0, last_updated: '', server_limits: {} }
          }
        }

        set((state) => ({
          ...state,
          isLoadingServerMetrics: {
            ...state.isLoadingServerMetrics,
            [cacheKey]: true
          }
        }))

        try {
          console.log('Fetching metrics for server:', serverId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const params = new URLSearchParams()
          params.append('timeframe', timeframe)
          params.append('interval', interval)
          if (metrics && metrics.length > 0) {
            params.append('metrics', metrics.join(','))
          }

          const response = await fetch(`/api/admin/servers/${serverId}/metrics?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Server metrics API response:', result)

          // Cache the metrics data
          set((state) => ({
            ...state,
            serverMetrics: {
              ...state.serverMetrics,
              [cacheKey]: result
            },
            isLoadingServerMetrics: {
              ...state.isLoadingServerMetrics,
              [cacheKey]: false
            }
          }))

          return result
        } catch (error) {
          console.error('Get server metrics error:', error)
          set((state) => ({
            ...state,
            isLoadingServerMetrics: {
              ...state.isLoadingServerMetrics,
              [cacheKey]: false
            }
          }))
          return {
            success: false,
            message: 'Network error occurred while retrieving server metrics',
            server_id: serverId,
            timeframe,
            interval,
            historical_metrics: {},
            summary: {},
            metadata: { data_points: 0, last_updated: '', server_limits: {} }
          }
        }
      },

      // Get server logs
      getServerLogs: async (serverId: string, logType: string = 'system', page: number = 1, limit: number = 50, filters: any = {}, forceRefresh: boolean = false) => {
        const { serverLogs, isLoadingServerLogs } = get()
        const cacheKey = `${serverId}_${logType}_${page}_${limit}_${JSON.stringify(filters)}`

        // Check if we already have this logs data cached
        if (!forceRefresh && serverLogs[cacheKey]) {
          console.log('Returning cached logs data for server:', serverId)
          return serverLogs[cacheKey]
        }

        // Prevent multiple simultaneous requests
        if (isLoadingServerLogs[cacheKey] && !forceRefresh) {
          console.log('Logs request already in progress for server:', serverId)
          return {
            success: false,
            message: 'Request already in progress',
            server_id: serverId,
            log_type: logType,
            logs: [],
            pagination: { current_page: page, total_pages: 0, total_items: 0, items_per_page: limit },
            stats: { total_logs: 0, log_types: {}, date_range: { earliest: null, latest: null } },
            filters
          }
        }

        set((state) => ({
          ...state,
          isLoadingServerLogs: {
            ...state.isLoadingServerLogs,
            [cacheKey]: true
          }
        }))

        try {
          console.log('Fetching logs for server:', serverId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const params = new URLSearchParams()
          params.append('log_type', logType)
          params.append('page', page.toString())
          params.append('limit', limit.toString())

          // Add filter parameters
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value))
            }
          })

          const response = await fetch(`/api/admin/servers/${serverId}/logs?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Server logs API response:', result)

          // Cache the logs data
          set((state) => ({
            ...state,
            serverLogs: {
              ...state.serverLogs,
              [cacheKey]: result
            },
            isLoadingServerLogs: {
              ...state.isLoadingServerLogs,
              [cacheKey]: false
            }
          }))

          return result
        } catch (error) {
          console.error('Get server logs error:', error)
          set((state) => ({
            ...state,
            isLoadingServerLogs: {
              ...state.isLoadingServerLogs,
              [cacheKey]: false
            }
          }))
          return {
            success: false,
            message: 'Network error occurred while retrieving server logs',
            server_id: serverId,
            log_type: logType,
            logs: [],
            pagination: { current_page: page, total_pages: 0, total_items: 0, items_per_page: limit },
            stats: { total_logs: 0, log_types: {}, date_range: { earliest: null, latest: null } },
            filters
          }
        }
      },

      // Clear server logs
      clearServerLogs: async (serverId: string, clearType: string = 'all', beforeDate?: string) => {
        try {
          console.log('Clearing server logs:', serverId, clearType, beforeDate)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const params = new URLSearchParams()
          params.append('type', clearType)
          if (beforeDate) {
            params.append('before_date', beforeDate)
          }

          const response = await fetch(`/api/admin/servers/${serverId}/logs?${params.toString()}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Clear server logs API response:', result)

          if (result.success) {
            // Clear cached logs data
            get().clearServerLogsCache(serverId)
          }

          return result
        } catch (error) {
          console.error('Clear server logs error:', error)
          return {
            success: false,
            message: 'Network error occurred while clearing server logs'
          }
        }
      },

      // Clear servers list cache
      clearServersListCache: () => {
        set((state) => ({
          ...state,
          serversList: [],
          serversListPagination: null,
          serversListStats: null,
          serversListLastFetch: null,
          serversListLastFilters: null
        }))
      },

      // Clear selected server
      clearSelectedServer: () => {
        set((state) => ({
          ...state,
          selectedServer: null,
          isLoadingSelectedServer: false
        }))
      },

      // Clear server metrics data
      clearServerMetrics: (serverId?: string) => {
        if (serverId) {
          set((state) => {
            const newMetrics = { ...state.serverMetrics }
            const newLoading = { ...state.isLoadingServerMetrics }

            // Remove all metrics entries for this server
            Object.keys(newMetrics).forEach(key => {
              if (key.startsWith(serverId)) {
                delete newMetrics[key]
                delete newLoading[key]
              }
            })

            return {
              ...state,
              serverMetrics: newMetrics,
              isLoadingServerMetrics: newLoading
            }
          })
        } else {
          set((state) => ({
            ...state,
            serverMetrics: {},
            isLoadingServerMetrics: {}
          }))
        }
      },

      // Clear server logs cache data
      clearServerLogsCache: (serverId?: string) => {
        if (serverId) {
          set((state) => {
            const newLogs = { ...state.serverLogs }
            const newLoading = { ...state.isLoadingServerLogs }

            // Remove all logs entries for this server
            Object.keys(newLogs).forEach(key => {
              if (key.startsWith(serverId)) {
                delete newLogs[key]
                delete newLoading[key]
              }
            })

            return {
              ...state,
              serverLogs: newLogs,
              isLoadingServerLogs: newLoading
            }
          })
        } else {
          set((state) => ({
            ...state,
            serverLogs: {},
            isLoadingServerLogs: {}
          }))
        }
      },

      // Check if servers cache is still valid
      isServersCacheValid: () => {
        const { serversListLastFetch, serversCacheValidDuration } = get()

        if (!serversListLastFetch) return false

        const now = new Date()
        const timeDiff = now.getTime() - serversListLastFetch.getTime()
        return timeDiff < serversCacheValidDuration
      },

      // Check if we should refresh data based on filter changes
      shouldRefreshServersData: (newFilters?: GetServersFilters) => {
        const { serversListLastFilters } = get()

        if (!serversListLastFilters || !newFilters) return false

        // Compare filters to see if they've changed
        const filtersChanged = JSON.stringify(serversListLastFilters) !== JSON.stringify(newFilters)
        return filtersChanged
      }
    }),
    {
      name: "admin-server-management-store",
      // Only persist non-sensitive data
      partialize: (state) => ({
        serversCacheValidDuration: state.serversCacheValidDuration,
        metricsCacheValidDuration: state.metricsCacheValidDuration,
        logsCacheValidDuration: state.logsCacheValidDuration
      }),
    }
  )
)
