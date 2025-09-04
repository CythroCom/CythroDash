"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"

// Types for monitoring data
export type NodeStatus = 'available' | 'limited' | 'full' | 'maintenance'
export type LocationStatus = 'available' | 'limited' | 'full' | 'maintenance'

export interface NodeResourceUsage {
  node_id: number
  node_name: string
  node_uuid: string
  location_id: number
  fqdn: string
  maintenance_mode: boolean
  total_memory: number
  total_disk: number
  allocated_memory: number
  allocated_disk: number
  total_servers: number
  active_servers: number
  memory_usage_percentage: number
  disk_usage_percentage: number
  available_memory: number
  available_disk: number
  status: NodeStatus
  last_updated: string
}

export interface LocationCapacity {
  location_id: number
  total_nodes: number
  active_nodes: number
  maintenance_nodes: number
  total_memory: number
  total_disk: number
  allocated_memory: number
  allocated_disk: number
  available_memory: number
  available_disk: number
  memory_usage_percentage: number
  disk_usage_percentage: number
  total_servers: number
  status: LocationStatus
  last_updated: string
}

export interface MonitoringStats {
  total_nodes: number
  active_nodes: number
  maintenance_nodes: number
  total_servers: number
  total_memory: number
  total_disk: number
  allocated_memory: number
  allocated_disk: number
  overall_memory_usage: number
  overall_disk_usage: number
  last_updated: string
}

export interface CapacityCheckRequest {
  location_id?: number
  node_id?: number
  required_memory?: number
  required_disk?: number
  required_cpu?: number
  include_recommendations?: boolean
}

export interface CapacityCheckResult {
  can_accommodate: boolean
  location_id: number
  location_status: LocationStatus
  available_nodes: number
  total_capacity: {
    memory: number
    disk: number
  }
  available_capacity: {
    memory: number
    disk: number
  }
  utilization_after_creation: {
    memory_percentage: number
    disk_percentage: number
  }
  recommended_nodes?: Array<{
    node_id: number
    node_name: string
    load_score: number
    fit_score: number
  }>
  warnings?: string[]
}

export interface MonitoringError {
  message: string
  code?: string
  timestamp: Date
}

type MonitoringStore = {
  // Data state
  monitoringStats: MonitoringStats | null
  locations: LocationCapacity[]
  nodes: NodeResourceUsage[]
  
  // UI state
  isLoading: boolean
  isRefreshing: boolean
  lastRefresh: Date | null
  selectedLocation: number | null
  autoRefresh: boolean
  refreshInterval: number // in seconds
  
  // Error state
  error: MonitoringError | null
  
  // Cache state
  cacheExpiry: Date | null
  
  // Actions
  fetchMonitoringData: (forceRefresh?: boolean) => Promise<boolean>
  refreshData: () => Promise<boolean>
  checkCapacity: (request: CapacityCheckRequest) => Promise<CapacityCheckResult | null>
  
  // UI actions
  setSelectedLocation: (locationId: number | null) => void
  setAutoRefresh: (enabled: boolean) => void
  setRefreshInterval: (interval: number) => void
  
  // Cache management
  clearCache: () => void
  isCacheValid: () => boolean
  
  // Error handling
  setError: (error: MonitoringError | null) => void
  clearError: () => void

  // Auto-refresh management
  startAutoRefresh: () => void
  stopAutoRefresh: () => void

  // Helper methods
  getFilteredNodes: () => NodeResourceUsage[]
  getLocationById: (locationId: number) => LocationCapacity | null
  getNodeById: (nodeId: number) => NodeResourceUsage | null
  formatBytes: (bytes: number) => string
}

// Cache duration: 2 minutes
const CACHE_DURATION = 2 * 60 * 1000

export const useMonitoringStore = create<MonitoringStore>()(
  persist(
    (set, get) => ({
      // Initial state
      monitoringStats: null,
      locations: [],
      nodes: [],
      
      // UI state
      isLoading: false,
      isRefreshing: false,
      lastRefresh: null,
      selectedLocation: null,
      autoRefresh: true,
      refreshInterval: 30, // 30 seconds
      
      // Error state
      error: null,
      
      // Cache state
      cacheExpiry: null,
      
      // Check if cache is valid
      isCacheValid: () => {
        const { cacheExpiry } = get()
        if (!cacheExpiry) return false
        return new Date() < cacheExpiry
      },
      
      // Fetch monitoring data
      fetchMonitoringData: async (forceRefresh = false) => {
        const state = get()
        
        // Check cache if not forcing refresh
        if (!forceRefresh && state.isCacheValid() && state.monitoringStats) {
          return true
        }
        
        set({ isLoading: true, error: null })
        
        try {
          const params = new URLSearchParams({
            include_nodes: 'true',
            include_stats: 'true',
            force_refresh: forceRefresh.toString()
          })

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/monitoring/capacity?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()

          if (result.success) {
            const now = new Date()
            set({
              monitoringStats: result.stats || null,
              locations: result.locations || [],
              nodes: result.nodes || [],
              lastRefresh: now,
              cacheExpiry: new Date(now.getTime() + CACHE_DURATION),
              error: null
            })
            return true
          } else {
            set({
              error: {
                message: result.message || "Failed to fetch monitoring data",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error fetching monitoring data:', error)
          set({
            error: {
              message: "Network error occurred while fetching monitoring data",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isLoading: false })
        }
      },
      
      // Refresh data (with loading indicator)
      refreshData: async () => {
        set({ isRefreshing: true })
        const success = await get().fetchMonitoringData(true)
        set({ isRefreshing: false })
        return success
      },
      
      // Check capacity for server creation
      checkCapacity: async (request: CapacityCheckRequest) => {
        try {
          const params = new URLSearchParams()
          
          if (request.location_id) params.append('location_id', request.location_id.toString())
          if (request.node_id) params.append('node_id', request.node_id.toString())
          if (request.required_memory) params.append('required_memory', request.required_memory.toString())
          if (request.required_disk) params.append('required_disk', request.required_disk.toString())
          if (request.required_cpu) params.append('required_cpu', request.required_cpu.toString())
          if (request.include_recommendations !== undefined) {
            params.append('include_recommendations', request.include_recommendations.toString())
          }

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/servers/capacity?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()

          if (result.success && result.capacity_check) {
            return result.capacity_check as CapacityCheckResult
          } else {
            set({
              error: {
                message: result.message || "Failed to check capacity",
                code: result.error,
                timestamp: new Date()
              }
            })
            return null
          }
        } catch (error) {
          console.error('Error checking capacity:', error)
          set({
            error: {
              message: "Network error occurred while checking capacity",
              timestamp: new Date()
            }
          })
          return null
        }
      },
      
      // UI actions
      setSelectedLocation: (locationId: number | null) => {
        set({ selectedLocation: locationId })
      },
      
      setAutoRefresh: (enabled: boolean) => {
        set({ autoRefresh: enabled })
      },
      
      setRefreshInterval: (interval: number) => {
        set({ refreshInterval: interval })
      },
      
      // Cache management
      clearCache: () => {
        set({
          monitoringStats: null,
          locations: [],
          nodes: [],
          lastRefresh: null,
          cacheExpiry: null,
          error: null
        })
      },
      
      // Error handling
      setError: (error: MonitoringError | null) => {
        set({ error })
      },
      
      clearError: () => {
        set({ error: null })
      },

      // Auto-refresh management
      startAutoRefresh: () => {
        const { refreshInterval, autoRefresh } = get()
        if (!autoRefresh) return

        // Clear any existing interval
        if (typeof window !== 'undefined' && (window as any).monitoringRefreshInterval) {
          clearInterval((window as any).monitoringRefreshInterval)
        }

        // Start new interval
        if (typeof window !== 'undefined') {
          (window as any).monitoringRefreshInterval = setInterval(() => {
            const currentState = get()
            if (currentState.autoRefresh && !currentState.isLoading && !currentState.isRefreshing) {
              currentState.fetchMonitoringData(false)
            }
          }, refreshInterval * 1000)
        }
      },

      stopAutoRefresh: () => {
        if (typeof window !== 'undefined' && (window as any).monitoringRefreshInterval) {
          clearInterval((window as any).monitoringRefreshInterval)
          delete (window as any).monitoringRefreshInterval
        }
      },

      // Helper methods
      getFilteredNodes: () => {
        const { nodes, selectedLocation } = get()
        return selectedLocation
          ? nodes.filter(node => node.location_id === selectedLocation)
          : nodes
      },

      getLocationById: (locationId: number) => {
        const { locations } = get()
        return locations.find(location => location.location_id === locationId) || null
      },

      getNodeById: (nodeId: number) => {
        const { nodes } = get()
        return nodes.find(node => node.node_id === nodeId) || null
      },

      formatBytes: (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
      }
    }),
    {
      name: 'monitoring-store',
      partialize: (state) => ({
        // Only persist UI preferences, not data
        selectedLocation: state.selectedLocation,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval
      })
    }
  )
)
