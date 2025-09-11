"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// Types for server management
export interface ServerType {
  id: string
  name: string
  short_description?: string
  category: string
  icon?: string
  popular?: boolean
  featured?: boolean
  new?: boolean
  min_resources: {
    memory: number
    disk: number
    cpu: number
  }
}

export interface ServerSoftware {
  id: string
  name: string
  version: string
  stability: string
  recommended?: boolean
  latest?: boolean
  short_description?: string
  icon?: string
  min_resources: {
    memory: number
    disk: number
    cpu: number
  }
  docker_image: string
  startup_command: string
}

export interface ServerLocation {
  id: string
  name: string
  country?: string
  region?: string
  city?: string
  short_code: string
  capacity_status: 'available' | 'limited' | 'full' | 'maintenance'
  features: {
    ddos_protection: boolean
    backup_storage: boolean
    high_availability: boolean
    ssd_storage: boolean
  }
  network: {
    ipv4_available: boolean
    ipv6_available: boolean
  }
  priority: number
}

export interface ServerPlan {
  id: string
  name: string
  description?: string
  resources: {
    memory: number
    disk: number
    cpu: number
    swap?: number
    io?: number
    databases?: number
    backups?: number
  }
  pricing: {
    hourly: number
    monthly: number
    effective_hourly: number
    effective_monthly: number
    discount_percentage?: number
  }
  // API response includes these additional fields
  billing_cycle: string // 'hourly', 'daily', 'weekly', 'monthly'
  setup_fee?: number
  original_price?: number
  effective_price?: number
  features: string[]
  popular?: boolean
  featured?: boolean
  billing_cycles: string[] // Legacy field, use billing_cycle instead
}

export interface CapacityInfo {
  can_accommodate: boolean
  location_id: number
  status: 'available' | 'limited' | 'full' | 'maintenance'
  available_nodes: number
  utilization_after_creation: {
    memory_percentage: number
    disk_percentage: number
  }
  warnings?: string[]
}

export interface ServerCreationRequest {
  name: string
  server_type_id: string
  server_software_id: string
  location_id: string
  plan_id: string
  environment_variables?: Record<string, string>
  startup_command?: string
  docker_image?: string
}

export interface ServerCreationResult {
  success: boolean
  server_id?: string
  message?: string
  errors?: string[]
}

export interface UserPermissions {
  can_create_servers: boolean
  max_servers: number | null
  current_servers: number
  requires_verification: boolean
  current_balance?: number
}

type ServerManagementStore = {
  // Data state
  serverTypes: ServerType[]
  serverSoftware: ServerSoftware[]
  locations: ServerLocation[]
  plans: ServerPlan[]
  capacityInfo: CapacityInfo | null
  userPermissions: UserPermissions | null
  
  // UI state
  isLoading: boolean
  isCreatingServer: boolean
  selectedServerType: string | null
  selectedLocation: string | null
  error: string | null
  
  // Cache state
  lastFetch: {
    serverTypes: Date | null
    locations: Date | null
    plans: Date | null
    software: Date | null
    softwareTypeId?: string | null
    plansKey?: string | null
  }
  
  // Actions
  fetchServerTypes: (filters?: { category?: string; featured?: boolean; popular?: boolean }) => Promise<boolean>
  fetchServerSoftware: (serverTypeId: string) => Promise<boolean>
  fetchLocations: (filters?: { server_type_id?: string; plan_id?: string }) => Promise<boolean>
  fetchPlans: (locationId: string, filters?: { server_type_id?: string; billing_cycle?: string }) => Promise<boolean>
  checkCapacity: (locationId: string, requiredMemory: number, requiredDisk: number, requiredCpu?: number) => Promise<boolean>
  createServer: (request: ServerCreationRequest) => Promise<ServerCreationResult>
  
  // UI actions
  setSelectedServerType: (typeId: string | null) => void
  setSelectedLocation: (locationId: string | null) => void
  clearError: () => void
  clearCache: () => void
  
  // Helper methods
  getServerTypeById: (id: string) => ServerType | null
  getLocationById: (id: string) => ServerLocation | null
  getPlanById: (id: string) => ServerPlan | null
  getSoftwareById: (id: string) => ServerSoftware | null
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

export const useServerManagementStore = create<ServerManagementStore>()(
  persist(
    (set, get) => ({
      // Initial state
      serverTypes: [],
      serverSoftware: [],
      locations: [],
      plans: [],
      capacityInfo: null,
      userPermissions: null,
      
      // UI state
      isLoading: false,
      isCreatingServer: false,
      selectedServerType: null,
      selectedLocation: null,
      error: null,
      
      // Cache state
      lastFetch: {
        serverTypes: null,
        locations: null,
        plans: null,
        software: null,
        softwareTypeId: null,
        plansKey: null
      },
      
      // Check if cache is valid
      isCacheValid: (type: 'serverTypes' | 'locations' | 'plans' | 'software') => {
        const lastFetch = get().lastFetch[type]
        if (!lastFetch) return false
        return new Date().getTime() - lastFetch.getTime() < CACHE_DURATION
      },
      
      // Fetch server types
      fetchServerTypes: async (filters = {}) => {
        const state = get()
        
        // Check cache
        if ((state as any).isCacheValid('serverTypes') && state.serverTypes.length > 0) {
          return true
        }
        
        set({ isLoading: true, error: null })
        
        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          const sessionToken = useAuthStore.getState().sessionToken

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return false
          }

          const params = new URLSearchParams()
          if (filters.category) params.append('category', filters.category)
          if (filters.featured !== undefined) params.append('featured', filters.featured.toString())
          if (filters.popular !== undefined) params.append('popular', filters.popular.toString())
          params.append('include_stats', 'false')

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }
          if (sessionToken) (headers as any)['Authorization'] = `Bearer ${sessionToken}`

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            verified: currentUser.verified
          }))

          const response = await fetch(`/api/servers/types?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success) {
            set({
              serverTypes: result.server_types || [],
              userPermissions: result.user_permissions || null,
              lastFetch: { ...state.lastFetch, serverTypes: new Date() }
            })
            return true
          } else {
            set({ error: result.message || 'Failed to fetch server types' })
            return false
          }
        } catch (error) {
          console.error('Error fetching server types:', error)
          set({ error: 'Network error occurred while fetching server types' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },
      
      // Fetch server software
      fetchServerSoftware: async (serverTypeId: string) => {
        const state = get()

        // Cache check: same server type and recent data
        if (state.selectedServerType === serverTypeId && state.serverSoftware.length > 0 && (state as any).isCacheValid('software') && state.lastFetch.softwareTypeId === serverTypeId) {
          return true
        }

        set({ isLoading: true, error: null })

        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          const sessionToken = useAuthStore.getState().sessionToken

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return false
          }

          const params = new URLSearchParams({
            server_type_id: serverTypeId,
            include_stats: 'false'
          })

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }
          if (sessionToken) (headers as any)['Authorization'] = `Bearer ${sessionToken}`

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            verified: currentUser.verified
          }))

          const response = await fetch(`/api/servers/software?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success) {
            set({
              serverSoftware: result.server_software || [],
              lastFetch: { ...state.lastFetch, software: new Date(), softwareTypeId: serverTypeId }
            })
            return true
          } else {
            set({ error: result.message || 'Failed to fetch server software' })
            return false
          }
        } catch (error) {
          console.error('Error fetching server software:', error)
          set({ error: 'Network error occurred while fetching server software' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },
      
      // Fetch locations
      fetchLocations: async (filters = {}) => {
        const state = get()
        
        // Check cache
        if ((state as any).isCacheValid('locations') && state.locations.length > 0) {
          return true
        }
        
        set({ isLoading: true, error: null })
        
        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          const sessionToken = useAuthStore.getState().sessionToken

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return false
          }

          const params = new URLSearchParams()
          if (filters.server_type_id) params.append('server_type_id', filters.server_type_id)
          if (filters.plan_id) params.append('plan_id', filters.plan_id)
          params.append('include_capacity', 'true')
          params.append('sort_by', 'priority')

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }
          if (sessionToken) (headers as any)['Authorization'] = `Bearer ${sessionToken}`

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            verified: currentUser.verified
          }))

          const response = await fetch(`/api/servers/locations?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success) {
            set({
              locations: result.locations || [],
              userPermissions: result.user_permissions || null,
              lastFetch: { ...state.lastFetch, locations: new Date() }
            })
            return true
          } else {
            set({ error: result.message || 'Failed to fetch locations' })
            return false
          }
        } catch (error) {
          console.error('Error fetching locations:', error)
          set({ error: 'Network error occurred while fetching locations' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },
      
      // Fetch plans
      fetchPlans: async (locationId: string, filters = {}) => {
        const state = get()
        const plansKey = `${locationId}:${filters.server_type_id || ''}:${filters.billing_cycle || ''}`
        // Cache check: same query and recent data
        if (state.plans.length > 0 && (state as any).isCacheValid('plans') && state.lastFetch.plansKey === plansKey) {
          return true
        }

        set({ isLoading: true, error: null })

        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          const sessionToken = useAuthStore.getState().sessionToken

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return false
          }

          const params = new URLSearchParams({
            location_id: locationId
          })
          if (filters.server_type_id) params.append('server_type_id', filters.server_type_id)
          if (filters.billing_cycle) params.append('billing_cycle', filters.billing_cycle)
          params.append('include_stats', 'false')
          params.append('sort_by', 'display_order')

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }
          if (sessionToken) (headers as any)['Authorization'] = `Bearer ${sessionToken}`

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            verified: currentUser.verified
          }))

          const response = await fetch(`/api/servers/plans?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success) {
            const state = get()
            set({
              plans: result.plans || [],
              userPermissions: result.user_permissions || null,
              lastFetch: { ...state.lastFetch, plans: new Date(), plansKey }
            })
            return true
          } else {
            set({ error: result.message || 'Failed to fetch plans' })
            return false
          }
        } catch (error) {
          console.error('Error fetching plans:', error)
          set({ error: 'Network error occurred while fetching plans' })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      // Check capacity
      checkCapacity: async (locationId: string, requiredMemory: number, requiredDisk: number, requiredCpu?: number) => {
        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          const sessionToken = useAuthStore.getState().sessionToken

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return false
          }

          const params = new URLSearchParams({
            location_id: locationId.toString(),
            required_memory: requiredMemory.toString(),
            required_disk: requiredDisk.toString(),
            include_recommendations: 'true'
          })
          if (requiredCpu) params.append('required_cpu', requiredCpu.toString())

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }
          if (sessionToken) (headers as any)['Authorization'] = `Bearer ${sessionToken}`

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            verified: currentUser.verified
          }))

          const response = await fetch(`/api/servers/capacity?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          })

          const result = await response.json()

          if (result.success && result.location_capacity) {
            set({ capacityInfo: result.location_capacity })
            return true
          } else {
            set({ error: result.message || 'Failed to check capacity' })
            return false
          }
        } catch (error) {
          console.error('Error checking capacity:', error)
          set({ error: 'Network error occurred while checking capacity' })
          return false
        }
      },

      // Create server
      createServer: async (request: ServerCreationRequest): Promise<ServerCreationResult> => {
        set({ isCreatingServer: true, error: null })

        try {
          // Get current user for authentication header
          const { useAuthStore } = await import('@/stores/user-store')
          const currentUser = useAuthStore.getState().currentUser
          const sessionToken = useAuthStore.getState().sessionToken

          if (!currentUser) {
            set({ error: 'User not authenticated' })
            return {
              success: false,
              message: 'User not authenticated'
            }
          }

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          }
          if (sessionToken) (headers as any)['Authorization'] = `Bearer ${sessionToken}`

          // Add user data header for authentication
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            verified: currentUser.verified
          }))

          const response = await fetch('/api/servers/create', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify(request)
          })

          const result = await response.json()

          if (result.success) {
            // Clear cache to force refresh of server lists
            const state = get()
            set({
              lastFetch: {
                ...state.lastFetch,
                serverTypes: null,
                locations: null,
                plans: null
              }
            })

            return {
              success: true,
              server_id: result.server_id,
              message: result.message
            }
          } else {
            set({ error: result.message || 'Failed to create server' })
            return {
              success: false,
              message: result.message,
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Error creating server:', error)
          const errorMessage = 'Network error occurred while creating server'
          set({ error: errorMessage })
          return {
            success: false,
            message: errorMessage
          }
        } finally {
          set({ isCreatingServer: false })
        }
      },

      // UI actions
      setSelectedServerType: (typeId: string | null) => {
        const prev = get().selectedServerType
        set({ selectedServerType: typeId })
        // Clear dependent data when server type changes
        if (typeId !== prev) {
          const lf = get().lastFetch
          set({
            serverSoftware: [],
            plans: [],
            lastFetch: { ...lf, software: null, softwareTypeId: null, plans: null, plansKey: null }
          })
        }
      },

      setSelectedLocation: (locationId: string | null) => {
        set({ selectedLocation: locationId })
        // Clear plans when location changes
        if (locationId !== get().selectedLocation) {
          set({ plans: [], capacityInfo: null })
        }
      },

      clearError: () => {
        set({ error: null })
      },

      clearCache: () => {
        set({
          serverTypes: [],
          serverSoftware: [],
          locations: [],
          plans: [],
          capacityInfo: null,
          lastFetch: {
            serverTypes: null,
            locations: null,
            plans: null,
            software: null
          }
        })
      },

      // Helper methods
      getServerTypeById: (id: string) => {
        return get().serverTypes.find(type => type.id === id) || null
      },

      getLocationById: (id: string) => {
        return get().locations.find(location => location.id === id) || null
      },

      getPlanById: (id: string) => {
        return get().plans.find(plan => plan.id === id) || null
      },

      getSoftwareById: (id: string) => {
        return get().serverSoftware.find(software => software.id === id) || null
      }
    }),
    {
      name: 'server-management-store',
      partialize: (state) => ({
        // Only persist UI preferences, not data
        selectedServerType: state.selectedServerType,
        selectedLocation: state.selectedLocation
      })
    }
  )
)
