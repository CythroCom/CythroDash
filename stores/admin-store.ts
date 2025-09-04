"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"

// Types for admin user management
export type AdminUserSummary = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  display_name?: string
  role: number // 0 = admin, 1 = user
  verified: boolean
  banned: boolean
  deleted: boolean
  coins: number
  total_servers_created: number
  two_factor_enabled: boolean
  last_login?: string
  last_login_ip?: string
  created_at: string
  
  // Optional extended data
  stats?: {
    total_coins_earned: number
    total_coins_spent: number
    referral_earnings: number
    failed_login_attempts: number
    last_activity?: string
  }
  
  oauth?: {
    discord?: boolean
    github?: boolean
    google?: boolean
  }
  
  referrals?: {
    referral_code?: string
    referred_by?: string
    total_referrals: number
  }
}

export type AdminUsersPagination = {
  current_page: number
  total_pages: number
  total_users: number
  per_page: number
  has_next: boolean
  has_previous: boolean
}

export type AdminUsersStats = {
  total_users: number
  verified_users: number
  banned_users: number
  admin_users: number
  users_with_2fa: number
  total_coins_in_circulation: number
}

export type GetUsersFilters = {
  page?: number
  limit?: number
  search?: string
  role?: number
  verified?: boolean
  banned?: boolean
  deleted?: boolean
  has_two_factor?: boolean
  created_after?: string
  created_before?: string
  last_login_after?: string
  last_login_before?: string
  sort_by?: 'id' | 'username' | 'email' | 'created_at' | 'last_login' | 'coins' | 'total_servers_created'
  sort_order?: 'asc' | 'desc'
  include_stats?: boolean
  include_oauth?: boolean
  include_referrals?: boolean
}

export type GetUsersResponse = {
  success: boolean
  message: string
  users?: AdminUserSummary[]
  pagination?: AdminUsersPagination
  stats?: AdminUsersStats
  errors?: any[]
}

type AdminStore = {
  // Users list state
  usersList: AdminUserSummary[]
  usersListPagination: AdminUsersPagination | null
  usersListStats: AdminUsersStats | null
  usersListLastFetch: Date | null
  usersListLastFilters: GetUsersFilters | null
  isLoadingUsersList: boolean

  // Single user state
  selectedUser: AdminUserSummary | null
  isLoadingSelectedUser: boolean

  // Cache settings
  usersCacheValidDuration: number // 2 minutes in milliseconds

  // Actions
  getUsersList: (filters?: GetUsersFilters, forceRefresh?: boolean) => Promise<GetUsersResponse>
  getUserById: (userId: number, forceRefresh?: boolean) => Promise<GetUsersResponse>
  clearUsersListCache: () => void
  clearSelectedUser: () => void

  // Utility actions
  isUsersCacheValid: () => boolean
  shouldRefreshUsersData: (newFilters?: GetUsersFilters) => boolean
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      // Initial state
      usersList: [],
      usersListPagination: null,
      usersListStats: null,
      usersListLastFetch: null,
      usersListLastFilters: null,
      isLoadingUsersList: false,
      selectedUser: null,
      isLoadingSelectedUser: false,
      usersCacheValidDuration: 2 * 60 * 1000, // 2 minutes

      // Get users list with pagination and filtering
      getUsersList: async (filters: GetUsersFilters = {}, forceRefresh: boolean = false) => {
        const { 
          usersList, 
          usersListLastFetch, 
          usersListLastFilters,
          isLoadingUsersList,
          isUsersCacheValid,
          shouldRefreshUsersData
        } = get()

        // Check if we should use cached data
        const shouldUseCache = !forceRefresh && 
                              isUsersCacheValid() && 
                              !shouldRefreshUsersData(filters) &&
                              usersList.length > 0

        if (shouldUseCache) {
          console.log('Returning cached users list')
          return {
            success: true,
            message: 'Users list retrieved from cache',
            users: usersList,
            pagination: get().usersListPagination,
            stats: get().usersListStats
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingUsersList) {
          console.log('Users list request already in progress')
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        try {
          // Set loading state
          set((state) => ({ ...state, isLoadingUsersList: true }))

          console.log('Fetching users list via API with filters:', filters)

          // Build query parameters
          const queryParams = new URLSearchParams()
          
          if (filters.page) queryParams.append('page', filters.page.toString())
          if (filters.limit) queryParams.append('limit', filters.limit.toString())
          if (filters.search) queryParams.append('search', filters.search)
          if (filters.role !== undefined) queryParams.append('role', filters.role.toString())
          if (filters.verified !== undefined) queryParams.append('verified', filters.verified.toString())
          if (filters.banned !== undefined) queryParams.append('banned', filters.banned.toString())
          if (filters.deleted !== undefined) queryParams.append('deleted', filters.deleted.toString())
          if (filters.has_two_factor !== undefined) queryParams.append('has_two_factor', filters.has_two_factor.toString())
          if (filters.created_after) queryParams.append('created_after', filters.created_after)
          if (filters.created_before) queryParams.append('created_before', filters.created_before)
          if (filters.last_login_after) queryParams.append('last_login_after', filters.last_login_after)
          if (filters.last_login_before) queryParams.append('last_login_before', filters.last_login_before)
          if (filters.sort_by) queryParams.append('sort_by', filters.sort_by)
          if (filters.sort_order) queryParams.append('sort_order', filters.sort_order)
          if (filters.include_stats) queryParams.append('include_stats', filters.include_stats.toString())
          if (filters.include_oauth) queryParams.append('include_oauth', filters.include_oauth.toString())
          if (filters.include_referrals) queryParams.append('include_referrals', filters.include_referrals.toString())

          // Get current user data for authentication header
          const currentUser = useAuthStore.getState().currentUser

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }

          // Add user data header for authentication
          if (currentUser) {
            headers['x-user-data'] = encodeURIComponent(JSON.stringify(currentUser))
          }

          const response = await fetch(`/api/admin/users?${queryParams.toString()}`, {
            method: 'GET',
            headers,
            credentials: 'include'
          })

          const result = await response.json()
          console.log('Users list API response:', result)

          if (result.success) {
            const now = new Date()
            
            // Cache the results
            set((state) => ({
              ...state,
              usersList: result.users || [],
              usersListPagination: result.pagination || null,
              usersListStats: result.stats || null,
              usersListLastFetch: now,
              usersListLastFilters: filters,
              isLoadingUsersList: false
            }))

            return {
              success: true,
              message: result.message || 'Users list retrieved successfully',
              users: result.users,
              pagination: result.pagination,
              stats: result.stats
            }
          } else {
            set((state) => ({ ...state, isLoadingUsersList: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve users list',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get users list error:', error)
          set((state) => ({ ...state, isLoadingUsersList: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving users list'
          }
        }
      },

      // Get specific user by ID
      getUserById: async (userId: number, forceRefresh: boolean = false) => {
        const { selectedUser, isLoadingSelectedUser } = get()

        // Check if we already have this user cached
        if (!forceRefresh && selectedUser && selectedUser.id === userId) {
          console.log('Returning cached user data for ID:', userId)
          return {
            success: true,
            message: 'User data retrieved from cache',
            users: [selectedUser]
          }
        }

        // Prevent multiple simultaneous requests for the same user
        if (isLoadingSelectedUser) {
          console.log('User by ID request already in progress, waiting...')
          // Instead of returning an error, wait for the current request to complete
          // Check every 100ms for up to 5 seconds
          for (let i = 0; i < 50; i++) {
            await new Promise(resolve => setTimeout(resolve, 100))
            const currentState = get()
            if (!currentState.isLoadingSelectedUser) {
              // Request completed, check if we got the user we wanted
              if (currentState.selectedUser && currentState.selectedUser.id === userId) {
                console.log('Found user data from concurrent request')
                return {
                  success: true,
                  message: 'User data retrieved from concurrent request',
                  users: [currentState.selectedUser]
                }
              }
              break
            }
          }

          // If still loading after timeout, proceed with new request
          if (get().isLoadingSelectedUser) {
            console.log('Timeout waiting for concurrent request, proceeding with new request')
            set((state) => ({ ...state, isLoadingSelectedUser: false }))
          }
        }

        try {
          // Set loading state
          set((state) => ({ ...state, isLoadingSelectedUser: true }))

          console.log('Fetching user by ID via API:', userId)

          // Get current user data for authentication header
          const currentUser = useAuthStore.getState().currentUser

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }

          // Add user data header for authentication
          if (currentUser) {
            headers['x-user-data'] = encodeURIComponent(JSON.stringify(currentUser))
          }

          const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'GET',
            headers,
            credentials: 'include'
          })

          const result = await response.json()
          console.log('User by ID API response:', result)

          if (result.success && result.users && result.users[0]) {
            // Cache the user data
            set((state) => ({
              ...state,
              selectedUser: result.users[0],
              isLoadingSelectedUser: false
            }))

            return {
              success: true,
              message: result.message || 'User retrieved successfully',
              users: result.users
            }
          } else {
            set((state) => ({ ...state, isLoadingSelectedUser: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve user',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get user by ID error:', error)
          set((state) => ({ ...state, isLoadingSelectedUser: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving user'
          }
        }
      },

      // Clear users list cache
      clearUsersListCache: () => {
        set((state) => ({
          ...state,
          usersList: [],
          usersListPagination: null,
          usersListStats: null,
          usersListLastFetch: null,
          usersListLastFilters: null
        }))
      },

      // Clear selected user
      clearSelectedUser: () => {
        set((state) => ({
          ...state,
          selectedUser: null,
          isLoadingSelectedUser: false // Also clear loading state to prevent stuck states
        }))
      },

      // Check if users cache is still valid
      isUsersCacheValid: () => {
        const { usersListLastFetch, usersCacheValidDuration } = get()
        
        if (!usersListLastFetch) return false
        
        const now = new Date()
        const timeDiff = now.getTime() - usersListLastFetch.getTime()
        return timeDiff < usersCacheValidDuration
      },

      // Check if we should refresh data based on filter changes
      shouldRefreshUsersData: (newFilters?: GetUsersFilters) => {
        const { usersListLastFilters } = get()
        
        if (!usersListLastFilters || !newFilters) return false
        
        // Compare filters to see if they've changed
        const filtersChanged = JSON.stringify(usersListLastFilters) !== JSON.stringify(newFilters)
        return filtersChanged
      }
    }),
    {
      name: "admin-store",
      // Only persist non-sensitive data
      partialize: (state) => ({
        usersCacheValidDuration: state.usersCacheValidDuration
      }),
    }
  )
)
