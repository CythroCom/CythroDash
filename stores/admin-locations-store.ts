"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"
import { LocationStatus, LocationVisibility } from "@/database/tables/cythro_dash_locations"



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


// Types for location management
export type AdminLocationSummary = {
  id: string
  name: string
  description?: string
  short_code: string
  country?: string
  region?: string
  city?: string
  pterodactyl_location_id: number
  associated_nodes: number[]
  status: LocationStatus
  visibility: LocationVisibility
  total_capacity: {
    memory: number
    disk: number
    cpu: number
  }
  current_usage: {
    memory: number
    disk: number
    cpu: number
  }
  priority: number
  max_servers_per_user?: number
  allowed_server_types?: string[]
  features: {
    ddos_protection: boolean
    backup_storage: boolean
    high_availability: boolean
    ssd_storage: boolean
  }
  network: {
    ipv4_available: boolean
    ipv6_available: boolean
    port_range_start?: number
    port_range_end?: number
  }
  created_at: string
  updated_at: string
  created_by: number
  last_capacity_check?: string
}

export type AdminLocationsPagination = {
  current_page: number
  total_pages: number
  total_items: number
  items_per_page: number
}

export type AdminLocationsStats = {
  total_locations: number
  active_locations: number
  public_locations: number
  private_locations: number
  maintenance_locations: number
  disabled_locations: number
  total_nodes: number
  total_capacity: {
    memory: number
    disk: number
    cpu: number
  }
  total_usage: {
    memory: number
    disk: number
    cpu: number
  }
  average_capacity_usage: number
}

export type GetLocationsFilters = {
  page?: number
  limit?: number
  search?: string
  status?: LocationStatus
  visibility?: LocationVisibility
  sort_by?: 'name' | 'short_code' | 'priority' | 'created_at' | 'status'
  sort_order?: 'asc' | 'desc'
  include_capacity?: boolean
  include_nodes?: boolean
}

export type GetLocationsResponse = {
  success: boolean
  message?: string
  locations?: AdminLocationSummary[]
  pagination?: AdminLocationsPagination | null
  stats?: AdminLocationsStats | null
  errors?: any[]
}

export type CreateLocationData = {
  name: string
  description?: string
  short_code: string
  country?: string
  region?: string
  city?: string
  pterodactyl_location_id: number
  associated_nodes?: number[]
  status?: LocationStatus
  visibility?: LocationVisibility
  priority?: number
  max_servers_per_user?: number
  allowed_server_types?: string[]
  features?: {
    ddos_protection?: boolean
    backup_storage?: boolean
    high_availability?: boolean
    ssd_storage?: boolean
  }
  network?: {
    ipv4_available?: boolean
    ipv6_available?: boolean
    port_range_start?: number
    port_range_end?: number
  }
}

export type UpdateLocationData = {
  name?: string
  description?: string
  short_code?: string
  country?: string
  region?: string
  city?: string
  pterodactyl_location_id?: number
  associated_nodes?: number[]
  status?: LocationStatus
  visibility?: LocationVisibility
  priority?: number
  max_servers_per_user?: number
  allowed_server_types?: string[]
  features?: {
    ddos_protection?: boolean
    backup_storage?: boolean
    high_availability?: boolean
    ssd_storage?: boolean
  }
  network?: {
    ipv4_available?: boolean
    ipv6_available?: boolean
    port_range_start?: number
    port_range_end?: number
  }
}

export type LocationResponse = {
  success: boolean
  message: string
  location?: AdminLocationSummary
  error?: string
}

export type LocationCapacityResponse = {
  success: boolean
  location_id: string
  capacity_status: 'available' | 'limited' | 'full'
  capacity_percentage: {
    memory: number
    disk: number
    cpu: number
  }
  available_resources: {
    memory: number
    disk: number
    cpu: number
  }
  total_capacity: {
    memory: number
    disk: number
    cpu: number
  }
  current_usage: {
    memory: number
    disk: number
    cpu: number
  }
  associated_nodes: Array<{
    id: number
    name: string
    online: boolean
    capacity_status: string
  }>
}

type AdminLocationsStore = {
  // Locations list state
  locationsList: AdminLocationSummary[]
  locationsListPagination: AdminLocationsPagination | null
  locationsListStats: AdminLocationsStats | null
  locationsListLastFetch: Date | null
  locationsListLastFilters: GetLocationsFilters | null
  isLoadingLocationsList: boolean

  // Single location state
  selectedLocation: AdminLocationSummary | null
  isLoadingSelectedLocation: boolean

  // Location capacity state
  locationCapacity: Record<string, LocationCapacityResponse>
  isLoadingLocationCapacity: Record<string, boolean>

  // Cache settings
  locationsCacheValidDuration: number // 2 minutes in milliseconds

  // Actions
  getLocationsList: (filters?: GetLocationsFilters, forceRefresh?: boolean) => Promise<GetLocationsResponse>
  getLocationById: (locationId: string, forceRefresh?: boolean) => Promise<LocationResponse>
  createLocation: (locationData: CreateLocationData) => Promise<LocationResponse>
  updateLocation: (locationId: string, updateData: UpdateLocationData) => Promise<LocationResponse>
  deleteLocation: (locationId: string) => Promise<LocationResponse>
  getLocationCapacity: (locationId: string, forceRefresh?: boolean) => Promise<LocationCapacityResponse>
  addNodeToLocation: (locationId: string, nodeId: number) => Promise<LocationResponse>
  removeNodeFromLocation: (locationId: string, nodeId: number) => Promise<LocationResponse>
  clearLocationsListCache: () => void
  clearSelectedLocation: () => void
  clearLocationCapacity: (locationId?: string) => void

  // Utility actions
  isLocationsCacheValid: () => boolean
  shouldRefreshLocationsData: (newFilters?: GetLocationsFilters) => boolean
}

export const useAdminLocationsStore = create<AdminLocationsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      locationsList: [],
      locationsListPagination: null,
      locationsListStats: null,
      locationsListLastFetch: null,
      locationsListLastFilters: null,
      isLoadingLocationsList: false,
      selectedLocation: null,
      isLoadingSelectedLocation: false,
      locationCapacity: {},
      isLoadingLocationCapacity: {},
      locationsCacheValidDuration: 2 * 60 * 1000, // 2 minutes

      // Get locations list with pagination and filtering
      getLocationsList: async (filters: GetLocationsFilters = {}, forceRefresh: boolean = false) => {
        const {
          locationsList,
          locationsListLastFetch,
          locationsListLastFilters,
          isLoadingLocationsList,
          isLocationsCacheValid,
          shouldRefreshLocationsData
        } = get()

        // Check if we should use cached data
        const shouldUseCache = !forceRefresh &&
                              isLocationsCacheValid() &&
                              !shouldRefreshLocationsData(filters) &&
                              locationsList.length > 0

        if (shouldUseCache) {
          console.log('Returning cached locations list')
          return {
            success: true,
            message: 'Locations list retrieved from cache',
            locations: locationsList,
            pagination: get().locationsListPagination,
            stats: get().locationsListStats
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingLocationsList && !forceRefresh) {
          console.log('Locations list request already in progress')
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        set((state) => ({ ...state, isLoadingLocationsList: true }))

        try {
          console.log('Fetching locations list with filters:', filters)

          // Build query parameters
          const params = new URLSearchParams()

          if (filters.page !== undefined) params.append('page', filters.page.toString())
          if (filters.limit !== undefined) params.append('limit', filters.limit.toString())
          if (filters.search) params.append('search', filters.search)
          if (filters.status) params.append('status', filters.status)
          if (filters.visibility) params.append('visibility', filters.visibility)
          if (filters.sort_by) params.append('sort_by', filters.sort_by)
          if (filters.sort_order) params.append('sort_order', filters.sort_order)
          if (filters.include_capacity !== undefined) params.append('include_capacity', filters.include_capacity.toString())
          if (filters.include_nodes !== undefined) params.append('include_nodes', filters.include_nodes.toString())

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Locations list API response:', result)

          if (result.success && result.locations) {
            // Calculate stats from locations data
            const stats = calculateLocationsStats(result.locations)

            // Cache the locations data
            set((state) => ({
              ...state,
              locationsList: result.locations,
              locationsListPagination: result.pagination || null,
              locationsListStats: stats,
              locationsListLastFetch: new Date(),
              locationsListLastFilters: filters,
              isLoadingLocationsList: false
            }))

            return {
              success: true,
              message: result.message || 'Locations retrieved successfully',
              locations: result.locations,
              pagination: result.pagination,
              stats: stats
            }
          } else {
            set((state) => ({ ...state, isLoadingLocationsList: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve locations',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get locations list error:', error)
          set((state) => ({ ...state, isLoadingLocationsList: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving locations list'
          }
        }
      },

      // Get specific location by ID
      getLocationById: async (locationId: string, forceRefresh: boolean = false) => {
        const { selectedLocation, isLoadingSelectedLocation } = get()

        // Check if we already have this location cached
        if (!forceRefresh && selectedLocation && selectedLocation.id === locationId) {
          console.log('Returning cached location data for ID:', locationId)
          return {
            success: true,
            message: 'Location data retrieved from cache',
            location: selectedLocation
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingSelectedLocation && !forceRefresh) {
          console.log('Location request already in progress for ID:', locationId)
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        set((state) => ({ ...state, isLoadingSelectedLocation: true }))

        try {
          console.log('Fetching location by ID:', locationId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations/${locationId}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Location by ID API response:', result)

          if (result.success && result.location) {
            // Cache the location data
            set((state) => ({
              ...state,
              selectedLocation: result.location,
              isLoadingSelectedLocation: false
            }))

            return {
              success: true,
              message: result.message || 'Location retrieved successfully',
              location: result.location
            }
          } else {
            set((state) => ({ ...state, isLoadingSelectedLocation: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve location'
            }
          }
        } catch (error) {
          console.error('Get location by ID error:', error)
          set((state) => ({ ...state, isLoadingSelectedLocation: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving location'
          }
        }
      },

      // Create new location
      createLocation: async (locationData: CreateLocationData) => {
        try {
          console.log('Creating new location:', locationData)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch('/api/admin/locations', {
            method: 'POST',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify(locationData)
          })

          const result = await response.json()
          console.log('Create location API response:', result)

          if (result.success && result.location) {
            // Clear cache to force refresh on next list request
            get().clearLocationsListCache()

            return {
              success: true,
              message: result.message || 'Location created successfully',
              location: result.location
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to create location'
            }
          }
        } catch (error) {
          console.error('Create location error:', error)
          return {
            success: false,
            message: 'Network error occurred while creating location'
          }
        }
      },

      // Update existing location
      updateLocation: async (locationId: string, updateData: UpdateLocationData) => {
        try {
          console.log('Updating location:', locationId, updateData)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations/${locationId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify(updateData)
          })

          const result = await response.json()
          console.log('Update location API response:', result)

          if (result.success && result.location) {
            // Update cached data
            const { selectedLocation } = get()
            if (selectedLocation && selectedLocation.id === locationId) {
              set((state) => ({
                ...state,
                selectedLocation: result.location
              }))
            }

            // Clear list cache to force refresh
            get().clearLocationsListCache()

            return {
              success: true,
              message: result.message || 'Location updated successfully',
              location: result.location
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to update location'
            }
          }
        } catch (error) {
          console.error('Update location error:', error)
          return {
            success: false,
            message: 'Network error occurred while updating location'
          }
        }
      },

      // Delete location
      deleteLocation: async (locationId: string) => {
        try {
          console.log('Deleting location:', locationId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations/${locationId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Delete location API response:', result)

          if (result.success) {
            // Clear cached data
            const { selectedLocation } = get()
            if (selectedLocation && selectedLocation.id === locationId) {
              get().clearSelectedLocation()
            }

            // Clear list cache to force refresh
            get().clearLocationsListCache()

            return {
              success: true,
              message: result.message || 'Location deleted successfully'
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to delete location'
            }
          }
        } catch (error) {
          console.error('Delete location error:', error)
          return {
            success: false,
            message: 'Network error occurred while deleting location'
          }
        }
      },

      // Get location capacity
      getLocationCapacity: async (locationId: string, forceRefresh: boolean = false) => {
        const { locationCapacity, isLoadingLocationCapacity } = get()

        // Check if we already have this capacity data cached
        if (!forceRefresh && locationCapacity[locationId]) {
          console.log('Returning cached capacity data for location:', locationId)
          return locationCapacity[locationId]
        }

        // Prevent multiple simultaneous requests
        if (isLoadingLocationCapacity[locationId] && !forceRefresh) {
          console.log('Capacity request already in progress for location:', locationId)
          return {
            success: false,
            location_id: locationId,
            capacity_status: 'full' as const,
            capacity_percentage: { memory: 0, disk: 0, cpu: 0 },
            available_resources: { memory: 0, disk: 0, cpu: 0 },
            total_capacity: { memory: 0, disk: 0, cpu: 0 },
            current_usage: { memory: 0, disk: 0, cpu: 0 },
            associated_nodes: []
          }
        }

        set((state) => ({
          ...state,
          isLoadingLocationCapacity: {
            ...state.isLoadingLocationCapacity,
            [locationId]: true
          }
        }))

        try {
          console.log('Fetching capacity for location:', locationId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations/${locationId}/capacity`, {
            method: 'GET',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
          })

          const result = await response.json()
          console.log('Location capacity API response:', result)

          // Cache the capacity data
          set((state) => ({
            ...state,
            locationCapacity: {
              ...state.locationCapacity,
              [locationId]: result
            },
            isLoadingLocationCapacity: {
              ...state.isLoadingLocationCapacity,
              [locationId]: false
            }
          }))

          return result
        } catch (error) {
          console.error('Get location capacity error:', error)
          set((state) => ({
            ...state,
            isLoadingLocationCapacity: {
              ...state.isLoadingLocationCapacity,
              [locationId]: false
            }
          }))
          return {
            success: false,
            location_id: locationId,
            capacity_status: 'full' as const,
            capacity_percentage: { memory: 0, disk: 0, cpu: 0 },
            available_resources: { memory: 0, disk: 0, cpu: 0 },
            total_capacity: { memory: 0, disk: 0, cpu: 0 },
            current_usage: { memory: 0, disk: 0, cpu: 0 },
            associated_nodes: []
          }
        }
      },

      // Add node to location
      addNodeToLocation: async (locationId: string, nodeId: number) => {
        try {
          console.log('Adding node to location:', locationId, nodeId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations/${locationId}/nodes`, {
            method: 'POST',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({ node_id: nodeId })
          })

          const result = await response.json()
          console.log('Add node to location API response:', result)

          if (result.success) {
            // Clear caches to force refresh
            get().clearLocationsListCache()
            get().clearLocationCapacity(locationId)

            // Update selected location if it's the same
            const { selectedLocation } = get()
            if (selectedLocation && selectedLocation.id === locationId && result.location) {
              set((state) => ({
                ...state,
                selectedLocation: result.location
              }))
            }

            return {
              success: true,
              message: result.message || 'Node added to location successfully',
              location: result.location
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to add node to location'
            }
          }
        } catch (error) {
          console.error('Add node to location error:', error)
          return {
            success: false,
            message: 'Network error occurred while adding node to location'
          }
        }
      },

      // Remove node from location
      removeNodeFromLocation: async (locationId: string, nodeId: number) => {
        try {
          console.log('Removing node from location:', locationId, nodeId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/locations/${locationId}/nodes`, {
            method: 'DELETE',
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({ node_id: nodeId })
          })

          const result = await response.json()
          console.log('Remove node from location API response:', result)

          if (result.success) {
            // Clear caches to force refresh
            get().clearLocationsListCache()
            get().clearLocationCapacity(locationId)

            // Update selected location if it's the same
            const { selectedLocation } = get()
            if (selectedLocation && selectedLocation.id === locationId && result.location) {
              set((state) => ({
                ...state,
                selectedLocation: result.location
              }))
            }

            return {
              success: true,
              message: result.message || 'Node removed from location successfully',
              location: result.location
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to remove node from location'
            }
          }
        } catch (error) {
          console.error('Remove node from location error:', error)
          return {
            success: false,
            message: 'Network error occurred while removing node from location'
          }
        }
      },

      // Clear locations list cache
      clearLocationsListCache: () => {
        set((state) => ({
          ...state,
          locationsList: [],
          locationsListPagination: null,
          locationsListStats: null,
          locationsListLastFetch: null,
          locationsListLastFilters: null
        }))
      },

      // Clear selected location
      clearSelectedLocation: () => {
        set((state) => ({
          ...state,
          selectedLocation: null,
          isLoadingSelectedLocation: false
        }))
      },

      // Clear location capacity data
      clearLocationCapacity: (locationId?: string) => {
        if (locationId) {
          set((state) => {
            const newCapacity = { ...state.locationCapacity }
            const newLoading = { ...state.isLoadingLocationCapacity }
            delete newCapacity[locationId]
            delete newLoading[locationId]
            return {
              ...state,
              locationCapacity: newCapacity,
              isLoadingLocationCapacity: newLoading
            }
          })
        } else {
          set((state) => ({
            ...state,
            locationCapacity: {},
            isLoadingLocationCapacity: {}
          }))
        }
      },

      // Check if locations cache is still valid
      isLocationsCacheValid: () => {
        const { locationsListLastFetch, locationsCacheValidDuration } = get()

        if (!locationsListLastFetch) return false

        const now = new Date()
        const timeDiff = now.getTime() - locationsListLastFetch.getTime()
        return timeDiff < locationsCacheValidDuration
      },

      // Check if we should refresh data based on filter changes
      shouldRefreshLocationsData: (newFilters?: GetLocationsFilters) => {
        const { locationsListLastFilters } = get()

        if (!locationsListLastFilters || !newFilters) return false

        // Compare filters to see if they've changed
        const filtersChanged = JSON.stringify(locationsListLastFilters) !== JSON.stringify(newFilters)
        return filtersChanged
      }
    }),
    {
      name: "admin-locations-store",
      // Only persist non-sensitive data
      partialize: (state) => ({
        locationsCacheValidDuration: state.locationsCacheValidDuration
      }),
    }
  )
)

// Helper function to calculate statistics from locations data
function calculateLocationsStats(locations: AdminLocationSummary[]): AdminLocationsStats {
  const stats: AdminLocationsStats = {
    total_locations: locations.length,
    active_locations: locations.filter(l => l.status === LocationStatus.ACTIVE).length,
    public_locations: locations.filter(l => l.visibility === LocationVisibility.PUBLIC).length,
    private_locations: locations.filter(l => l.visibility === LocationVisibility.PRIVATE).length,
    maintenance_locations: locations.filter(l => l.status === LocationStatus.MAINTENANCE).length,
    disabled_locations: locations.filter(l => l.status === LocationStatus.DISABLED).length,
    total_nodes: locations.reduce((acc, l) => acc + l.associated_nodes.length, 0),
    total_capacity: locations.reduce((acc, l) => ({
      memory: acc.memory + l.total_capacity.memory,
      disk: acc.disk + l.total_capacity.disk,
      cpu: acc.cpu + l.total_capacity.cpu
    }), { memory: 0, disk: 0, cpu: 0 }),
    total_usage: locations.reduce((acc, l) => ({
      memory: acc.memory + l.current_usage.memory,
      disk: acc.disk + l.current_usage.disk,
      cpu: acc.cpu + l.current_usage.cpu
    }), { memory: 0, disk: 0, cpu: 0 }),
    average_capacity_usage: 0
  }

  // Calculate average capacity usage
  if (stats.total_capacity.memory > 0 || stats.total_capacity.disk > 0 || stats.total_capacity.cpu > 0) {
    const memoryPercentage = stats.total_capacity.memory > 0 ? (stats.total_usage.memory / stats.total_capacity.memory) * 100 : 0
    const diskPercentage = stats.total_capacity.disk > 0 ? (stats.total_usage.disk / stats.total_capacity.disk) * 100 : 0
    const cpuPercentage = stats.total_capacity.cpu > 0 ? (stats.total_usage.cpu / stats.total_capacity.cpu) * 100 : 0

    stats.average_capacity_usage = Math.round((memoryPercentage + diskPercentage + cpuPercentage) / 3)
  }

  return stats
}
