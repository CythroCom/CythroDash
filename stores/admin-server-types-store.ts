"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"
import { 
  CythroDashServerType, 
  ServerTypeCategory, 
  ServerTypeStatus,
  ServerTypeHelpers 
} from "@/database/tables/cythro_dash_server_types"

// API response interfaces
export interface ServerTypesListResponse {
  success: boolean
  message?: string
  data?: {
    server_types: CythroDashServerType[]
    pagination: {
      current_page: number
      total_pages: number
      total_items: number
      items_per_page: number
    }
    stats?: {
      total_types: number
      active_types: number
      disabled_types: number
      maintenance_types: number
      featured_types: number
      gaming_types: number
      bots_types: number
      web_types: number
      database_types: number
      other_types: number
    }
  }
}

export interface ServerTypeResponse {
  success: boolean
  message?: string
  data?: CythroDashServerType
}

// Filters interface
export interface GetServerTypesFilters {
  page?: number
  limit?: number
  search?: string
  category?: ServerTypeCategory
  status?: ServerTypeStatus
  sort_by?: "name" | "category" | "display_order" | "created_at" | "status"
  sort_order?: "asc" | "desc"
  include_stats?: boolean
}

// Create server type interface
export interface CreateServerTypeData {
  name: string
  description?: string
  short_description?: string
  category: ServerTypeCategory
  pterodactyl_nest_id: number
  display_order?: number
  featured?: boolean
  popular?: boolean
  resource_requirements: {
    min_memory: number
    min_disk: number
    min_cpu: number
  }
  display_config?: {
    icon?: string
    color?: string
    banner_image?: string
    thumbnail?: string
  }
  access_restrictions?: {
    min_user_role?: number
    requires_verification?: boolean
    max_servers_per_user?: number
  }
  configuration?: {
    supports_custom_jar?: boolean
    supports_plugins?: boolean
    supports_mods?: boolean
    supports_custom_startup?: boolean
    auto_start?: boolean
    crash_detection?: boolean
  }
}

// Update server type interface
export interface UpdateServerTypeData extends Partial<CreateServerTypeData> {
  status?: ServerTypeStatus
}

// Store interface
interface AdminServerTypesStore {
  // State
  serverTypesList: CythroDashServerType[]
  serverTypesListPagination: NonNullable<ServerTypesListResponse['data']>['pagination'] | null
  serverTypesListStats: NonNullable<ServerTypesListResponse['data']>['stats'] | null
  isLoadingServerTypesList: boolean
  
  currentServerType: CythroDashServerType | null
  isLoadingCurrentServerType: boolean
  
  // Actions
  getServerTypesList: (filters?: GetServerTypesFilters, forceRefresh?: boolean) => Promise<ServerTypesListResponse>
  getServerType: (serverTypeId: string, forceRefresh?: boolean) => Promise<ServerTypeResponse>
  createServerType: (data: CreateServerTypeData) => Promise<ServerTypeResponse>
  updateServerType: (serverTypeId: string, data: UpdateServerTypeData) => Promise<ServerTypeResponse>
  deleteServerType: (serverTypeId: string) => Promise<{ success: boolean; message?: string }>
  
  // Cache management
  clearServerTypesListCache: () => void
  clearCurrentServerTypeCache: () => void
  clearAllCache: () => void
}

export const useAdminServerTypesStore = create<AdminServerTypesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      serverTypesList: [],
      serverTypesListPagination: null,
      serverTypesListStats: null,
      isLoadingServerTypesList: false,
      
      currentServerType: null,
      isLoadingCurrentServerType: false,

      // Get server types list
      getServerTypesList: async (filters = {}, forceRefresh = false) => {
        const state = get()
        
        // Don't fetch if already loading
        if (state.isLoadingServerTypesList && !forceRefresh) {
          return { success: false, message: "Already loading server types" }
        }

        set({ isLoadingServerTypesList: true })

        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          // Build query parameters
          const params = new URLSearchParams()
          if (filters.page) params.append('page', filters.page.toString())
          if (filters.limit) params.append('limit', filters.limit.toString())
          if (filters.search) params.append('search', filters.search)
          if (filters.category) params.append('category', filters.category)
          if (filters.status) params.append('status', filters.status)
          if (filters.sort_by) params.append('sort_by', filters.sort_by)
          if (filters.sort_order) params.append('sort_order', filters.sort_order)
          if (filters.include_stats) params.append('include_stats', 'true')

          const response = await fetch(`/api/admin/server-types?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result: ServerTypesListResponse = await response.json()

          if (result.success && result.data) {
            set({
              serverTypesList: result.data.server_types,
              serverTypesListPagination: result.data.pagination,
              serverTypesListStats: result.data.stats || null,
              isLoadingServerTypesList: false
            })
          } else {
            set({ isLoadingServerTypesList: false })
          }

          return result
        } catch (error) {
          console.error('Error fetching server types:', error)
          set({ isLoadingServerTypesList: false })
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch server types'
          }
        }
      },

      // Get single server type
      getServerType: async (serverTypeId: string, forceRefresh = false) => {
        const state = get()
        
        // Don't fetch if already loading
        if (state.isLoadingCurrentServerType && !forceRefresh) {
          return { success: false, message: "Already loading server type" }
        }

        set({ isLoadingCurrentServerType: true })

        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/server-types/${serverTypeId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result: ServerTypeResponse = await response.json()

          if (result.success && result.data) {
            set({
              currentServerType: result.data,
              isLoadingCurrentServerType: false
            })
          } else {
            set({ isLoadingCurrentServerType: false })
          }

          return result
        } catch (error) {
          console.error('Error fetching server type:', error)
          set({ isLoadingCurrentServerType: false })
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch server type'
          }
        }
      },

      // Create server type
      createServerType: async (data: CreateServerTypeData) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          // Generate ID from name
          const serverTypeId = ServerTypeHelpers.generateServerTypeId(data.name)

          // Prepare API data
          const apiData = {
            ...data,
            id: serverTypeId,
            status: ServerTypeStatus.ACTIVE,
            display_config: data.display_config || {},
            access_restrictions: data.access_restrictions || {},
            configuration: data.configuration || ServerTypeHelpers.getDefaultServerTypeValues().configuration,
            documentation: {},
            created_by: currentUser.id
          }

          const response = await fetch('/api/admin/server-types', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify(apiData)
          })

          const result: ServerTypeResponse = await response.json()

          if (result.success) {
            // Refresh the list
            get().clearServerTypesListCache()
          }

          return result
        } catch (error) {
          console.error('Error creating server type:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to create server type'
          }
        }
      },

      // Update server type
      updateServerType: async (serverTypeId: string, data: UpdateServerTypeData) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          // Prepare API data
          const apiData = {
            ...data,
            last_modified_by: currentUser.id,
            updated_at: new Date()
          }

          const response = await fetch(`/api/admin/server-types/${serverTypeId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify(apiData)
          })

          const result: ServerTypeResponse = await response.json()

          if (result.success) {
            // Refresh the list and current item
            get().clearServerTypesListCache()
            get().clearCurrentServerTypeCache()
          }

          return result
        } catch (error) {
          console.error('Error updating server type:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update server type'
          }
        }
      },

      // Delete server type
      deleteServerType: async (serverTypeId: string) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/server-types/${serverTypeId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()

          if (result.success) {
            // Refresh the list and clear current item
            get().clearServerTypesListCache()
            get().clearCurrentServerTypeCache()
          }

          return result
        } catch (error) {
          console.error('Error deleting server type:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to delete server type'
          }
        }
      },

      // Cache management
      clearServerTypesListCache: () => {
        set({
          serverTypesList: [],
          serverTypesListPagination: null,
          serverTypesListStats: null
        })
      },

      clearCurrentServerTypeCache: () => {
        set({
          currentServerType: null
        })
      },

      clearAllCache: () => {
        get().clearServerTypesListCache()
        get().clearCurrentServerTypeCache()
      }
    }),
    {
      name: "admin-server-types-store",
      partialize: (state) => ({
        // Only persist non-loading states
        serverTypesList: state.serverTypesList,
        serverTypesListPagination: state.serverTypesListPagination,
        serverTypesListStats: state.serverTypesListStats,
        currentServerType: state.currentServerType,
      }),
    }
  )
)
