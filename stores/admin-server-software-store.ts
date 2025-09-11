"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"
import { 
  CythroDashServerSoftware, 
  SoftwareStability, 
  SoftwareStatus,
  ServerSoftwareHelpers,
  VersionInfo,
  DockerConfig,
  EnvironmentVariable
} from "@/database/tables/cythro_dash_server_software"

// API response interfaces
export interface ServerSoftwareListResponse {
  success: boolean
  message?: string
  data?: {
    server_software: CythroDashServerSoftware[]
    pagination: {
      current_page: number
      total_pages: number
      total_items: number
      items_per_page: number
    }
    stats?: {
      total_software: number
      active_software: number
      disabled_software: number
      deprecated_software: number
      beta_software: number
      recommended_software: number
      latest_software: number
    }
  }
}

export interface ServerSoftwareResponse {
  success: boolean
  message?: string
  data?: CythroDashServerSoftware
}

// Pterodactyl interfaces
export interface PterodactylNest {
  id: number
  name: string
  description: string
}

export interface PterodactylEgg {
  id: number
  name: string
  description: string
  docker_image: string
  startup: string
  environment_variables?: EnvironmentVariable[]
}

export interface PterodactylNestsResponse {
  success: boolean
  message?: string
  data?: PterodactylNest[]
}

export interface PterodactylEggsResponse {
  success: boolean
  message?: string
  data?: PterodactylEgg[]
}

// Filters interface
export interface GetServerSoftwareFilters {
  page?: number
  limit?: number
  search?: string
  server_type_id?: string
  stability?: SoftwareStability
  status?: SoftwareStatus
  sort_by?: "name" | "version" | "display_order" | "created_at" | "status"
  sort_order?: "asc" | "desc"
  include_stats?: boolean
}

// Create server software interface
export interface CreateServerSoftwareData {
  name: string
  description?: string
  short_description?: string
  server_type_id: string
  pterodactyl_egg_id: number
  version_info: VersionInfo
  stability: SoftwareStability
  recommended?: boolean
  latest?: boolean
  docker_config: DockerConfig
  environment_variables?: EnvironmentVariable[]
  display_order?: number
  icon?: string
  color?: string
  features?: {
    supports_plugins?: boolean
    supports_mods?: boolean
    supports_datapacks?: boolean
    supports_custom_worlds?: boolean
    supports_backups?: boolean
    supports_console_commands?: boolean
    supports_file_manager?: boolean
  }
}

// Update server software interface
export interface UpdateServerSoftwareData extends Partial<CreateServerSoftwareData> {
  status?: SoftwareStatus
}

// Store interface
interface AdminServerSoftwareStore {
  // State
  serverSoftwareList: CythroDashServerSoftware[]
  serverSoftwareListPagination: NonNullable<ServerSoftwareListResponse['data']>['pagination'] | null
  serverSoftwareListStats: NonNullable<ServerSoftwareListResponse['data']>['stats'] | null
  isLoadingServerSoftwareList: boolean
  
  currentServerSoftware: CythroDashServerSoftware | null
  isLoadingCurrentServerSoftware: boolean
  
  // Pterodactyl data
  pterodactylNests: PterodactylNest[]
  isLoadingPterodactylNests: boolean
  pterodactylEggs: PterodactylEgg[]
  isLoadingPterodactylEggs: boolean
  
  // Actions
  getServerSoftwareList: (filters?: GetServerSoftwareFilters, forceRefresh?: boolean) => Promise<ServerSoftwareListResponse>
  getServerSoftware: (softwareId: string, forceRefresh?: boolean) => Promise<ServerSoftwareResponse>
  createServerSoftware: (data: CreateServerSoftwareData) => Promise<ServerSoftwareResponse>
  updateServerSoftware: (softwareId: string, data: UpdateServerSoftwareData) => Promise<ServerSoftwareResponse>
  refreshEnvironmentVariables: (softwareId: string) => Promise<ServerSoftwareResponse>
  deleteServerSoftware: (softwareId: string) => Promise<{ success: boolean; message?: string }>
  
  // Pterodactyl actions
  getPterodactylNests: (forceRefresh?: boolean) => Promise<PterodactylNestsResponse>
  getPterodactylEggs: (nestId: number, forceRefresh?: boolean) => Promise<PterodactylEggsResponse>
  getEggEnvironmentVariables: (eggId: number) => Promise<{ success: boolean; data?: EnvironmentVariable[]; message?: string }>
  
  // Cache management
  clearServerSoftwareListCache: () => void
  clearCurrentServerSoftwareCache: () => void
  clearPterodactylCache: () => void
  clearAllCache: () => void
}

export const useAdminServerSoftwareStore = create<AdminServerSoftwareStore>()(
  persist(
    (set, get) => ({
      // Initial state
      serverSoftwareList: [],
      serverSoftwareListPagination: null,
      serverSoftwareListStats: null,
      isLoadingServerSoftwareList: false,
      
      currentServerSoftware: null,
      isLoadingCurrentServerSoftware: false,
      
      pterodactylNests: [],
      isLoadingPterodactylNests: false,
      pterodactylEggs: [],
      isLoadingPterodactylEggs: false,

      // Get server software list
      getServerSoftwareList: async (filters = {}, forceRefresh = false) => {
        const state = get()
        
        // Don't fetch if already loading
        if (state.isLoadingServerSoftwareList && !forceRefresh) {
          return { success: false, message: "Already loading server software" }
        }

        set({ isLoadingServerSoftwareList: true })

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
          if (filters.server_type_id) params.append('server_type_id', filters.server_type_id)
          if (filters.stability) params.append('stability', filters.stability)
          if (filters.status) params.append('status', filters.status)
          if (filters.sort_by) params.append('sort_by', filters.sort_by)
          if (filters.sort_order) params.append('sort_order', filters.sort_order)
          if (filters.include_stats) params.append('include_stats', 'true')

          const response = await fetch(`/api/admin/server-software?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result: ServerSoftwareListResponse = await response.json()

          if (result.success && result.data) {
            set({
              serverSoftwareList: result.data.server_software,
              serverSoftwareListPagination: result.data.pagination,
              serverSoftwareListStats: result.data.stats || null,
              isLoadingServerSoftwareList: false
            })
          } else {
            set({ isLoadingServerSoftwareList: false })
          }

          return result
        } catch (error) {
          console.error('Error fetching server software:', error)
          set({ isLoadingServerSoftwareList: false })
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch server software'
          }
        }
      },

      // Get single server software
      getServerSoftware: async (softwareId: string, forceRefresh = false) => {
        const state = get()
        
        // Don't fetch if already loading
        if (state.isLoadingCurrentServerSoftware && !forceRefresh) {
          return { success: false, message: "Already loading server software" }
        }

        set({ isLoadingCurrentServerSoftware: true })

        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/server-software/${softwareId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result: ServerSoftwareResponse = await response.json()

          if (result.success && result.data) {
            set({
              currentServerSoftware: result.data,
              isLoadingCurrentServerSoftware: false
            })
          } else {
            set({ isLoadingCurrentServerSoftware: false })
          }

          return result
        } catch (error) {
          console.error('Error fetching server software:', error)
          set({ isLoadingCurrentServerSoftware: false })
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch server software'
          }
        }
      },

      // Create server software
      createServerSoftware: async (data: CreateServerSoftwareData) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          // Generate ID from name and version
          const softwareId = ServerSoftwareHelpers.generateSoftwareId(data.name, data.version_info.version)

          // Fetch environment variables from Pterodactyl egg if not provided
          let environmentVariables = data.environment_variables || []

          if (environmentVariables.length === 0 && data.pterodactyl_egg_id) {
            console.log('Fetching environment variables from Pterodactyl egg:', data.pterodactyl_egg_id)

            const eggEnvResult = await get().getEggEnvironmentVariables(data.pterodactyl_egg_id)
            if (eggEnvResult.success && eggEnvResult.data) {
              environmentVariables = eggEnvResult.data
              console.log(`Successfully fetched ${environmentVariables.length} environment variables from egg ${data.pterodactyl_egg_id}`)
            } else {
              console.warn(`Failed to fetch environment variables for egg ${data.pterodactyl_egg_id}: ${eggEnvResult.message}`)
            }
          }

          // Prepare API data
          const apiData = {
            ...data,
            id: softwareId,
            status: SoftwareStatus.ACTIVE,
            environment_variables: environmentVariables,
            features: data.features || ServerSoftwareHelpers.getDefaultSoftwareValues().features,
            documentation: {},
            update_info: {},
            compatibility: {},
            created_by: currentUser.id
          }

          const response = await fetch('/api/admin/server-software', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify(apiData)
          })

          const result: ServerSoftwareResponse = await response.json()

          if (result.success) {
            // Refresh the list
            get().clearServerSoftwareListCache()
          }

          return result
        } catch (error) {
          console.error('Error creating server software:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to create server software'
          }
        }
      },

      // Update server software
      updateServerSoftware: async (softwareId: string, data: UpdateServerSoftwareData) => {
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

          const response = await fetch(`/api/admin/server-software/${softwareId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify(apiData)
          })

          const result: ServerSoftwareResponse = await response.json()

          if (result.success) {
            // Refresh the list and current item
            get().clearServerSoftwareListCache()
            get().clearCurrentServerSoftwareCache()
          }

          return result
        } catch (error) {
          console.error('Error updating server software:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update server software'
          }
        }
      },

      // Refresh environment variables from Pterodactyl
      refreshEnvironmentVariables: async (softwareId: string) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/server-software/${softwareId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify({
              refresh_environment_variables: true
            })
          })

          const result: ServerSoftwareResponse = await response.json()

          if (result.success) {
            // Refresh the list and current item
            get().clearServerSoftwareListCache()
            get().clearCurrentServerSoftwareCache()
          }

          return result
        } catch (error) {
          console.error('Error refreshing environment variables:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to refresh environment variables'
          }
        }
      },

      // Delete server software
      deleteServerSoftware: async (softwareId: string) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/server-software/${softwareId}`, {
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
            get().clearServerSoftwareListCache()
            get().clearCurrentServerSoftwareCache()
          }

          return result
        } catch (error) {
          console.error('Error deleting server software:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to delete server software'
          }
        }
      },

      // Get Pterodactyl nests
      getPterodactylNests: async (forceRefresh = false) => {
        const state = get()
        
        // Don't fetch if already loading or have data
        if ((state.isLoadingPterodactylNests || (state.pterodactylNests.length > 0)) && !forceRefresh) {
          return { success: true, data: state.pterodactylNests }
        }

        set({ isLoadingPterodactylNests: true })

        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch('/api/admin/pterodactyl/nests', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result: PterodactylNestsResponse = await response.json()

          if (result.success && result.data) {
            set({
              pterodactylNests: result.data,
              isLoadingPterodactylNests: false
            })
          } else {
            set({ isLoadingPterodactylNests: false })
          }

          return result
        } catch (error) {
          console.error('Error fetching Pterodactyl nests:', error)
          set({ isLoadingPterodactylNests: false })
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch Pterodactyl nests'
          }
        }
      },

      // Get Pterodactyl eggs for a nest
      getPterodactylEggs: async (nestId: number, forceRefresh = false) => {
        const state = get()
        
        // Don't fetch if already loading
        if (state.isLoadingPterodactylEggs && !forceRefresh) {
          return { success: false, message: "Already loading Pterodactyl eggs" }
        }

        set({ isLoadingPterodactylEggs: true, pterodactylEggs: [] })

        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/pterodactyl/nests/${nestId}/eggs`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result: PterodactylEggsResponse = await response.json()

          if (result.success && result.data) {
            set({
              pterodactylEggs: result.data,
              isLoadingPterodactylEggs: false
            })
          } else {
            set({ isLoadingPterodactylEggs: false })
          }

          return result
        } catch (error) {
          console.error('Error fetching Pterodactyl eggs:', error)
          set({ isLoadingPterodactylEggs: false })
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch Pterodactyl eggs'
          }
        }
      },

      // Get environment variables for a specific egg
      getEggEnvironmentVariables: async (eggId: number) => {
        try {
          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const state = get()

          // First ensure we have nests loaded
          if (state.pterodactylNests.length === 0) {
            await get().getPterodactylNests(true)
          }

          // Search through all nests to find the one containing this egg
          for (const nest of get().pterodactylNests) {
            const eggsResponse = await get().getPterodactylEggs(nest.id, true)
            if (eggsResponse.success && eggsResponse.data) {
              const foundEgg = eggsResponse.data.find(egg => egg.id === eggId)
              if (foundEgg && foundEgg.environment_variables) {
                return {
                  success: true,
                  data: foundEgg.environment_variables,
                  message: `Found ${foundEgg.environment_variables.length} environment variables for egg ${eggId}`
                }
              }
            }
          }

          return {
            success: false,
            message: `Egg ${eggId} not found in any nest`
          }
        } catch (error) {
          console.error('Error fetching egg environment variables:', error)
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to fetch egg environment variables'
          }
        }
      },

      // Cache management
      clearServerSoftwareListCache: () => {
        set({
          serverSoftwareList: [],
          serverSoftwareListPagination: null,
          serverSoftwareListStats: null
        })
      },

      clearCurrentServerSoftwareCache: () => {
        set({
          currentServerSoftware: null
        })
      },

      clearPterodactylCache: () => {
        set({
          pterodactylNests: [],
          pterodactylEggs: []
        })
      },

      clearAllCache: () => {
        get().clearServerSoftwareListCache()
        get().clearCurrentServerSoftwareCache()
        get().clearPterodactylCache()
      }
    }),
    {
      name: "admin-server-software-store",
      partialize: (state) => ({
        // Only persist non-loading states
        serverSoftwareList: state.serverSoftwareList,
        serverSoftwareListPagination: state.serverSoftwareListPagination,
        serverSoftwareListStats: state.serverSoftwareListStats,
        currentServerSoftware: state.currentServerSoftware,
        pterodactylNests: state.pterodactylNests,
        // Don't persist eggs as they're nest-specific
      }),
    }
  )
)
