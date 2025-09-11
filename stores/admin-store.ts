"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"

// Types for admin user management

// Build auth headers with x-user-data for admin APIs (fallback while session store is not implemented)

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

type AdminLogItem = {
  id: string
  category: string
  action: string
  created_at: string
  meta?: Record<string, any>
}

type ReferralAnalyticsData = any

type ReferredUser = {
  id: number
  username: string
  email: string
  created_at: string
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
  updateUser: (userId: number, data: Partial<Pick<AdminUserSummary, 'username'|'email'|'first_name'|'last_name'|'display_name'|'role'|'verified'>> & { password?: string }) => Promise<{ success: boolean; message: string }>
  banUser: (userId: number, reason?: string) => Promise<{ success: boolean; message: string }>
  unbanUser: (userId: number) => Promise<{ success: boolean; message: string }>
  adjustUserCoins: (userId: number, amount: number, reason: string) => Promise<{ success: boolean; message: string }>
  bulkDisableEnable: (userIds: number[], action: 'disable'|'enable', reason?: string) => Promise<{ success: boolean; message: string }>
  bulkRoleChange: (userIds: number[], role: number) => Promise<{ success: boolean; message: string }>
  bulkAdjustCoins: (userIds: number[], amount: number, reason: string) => Promise<{ success: boolean; message: string }>
  clearUsersListCache: () => void
  clearSelectedUser: () => void

  // Admin logs (activity) cache + actions
  getAdminLogs: (args: { userId: number; page?: number; limit?: number; category?: string }) => Promise<{ success: boolean; message?: string; items?: AdminLogItem[] }>

  // Referrals cache + actions
  getReferralAnalytics: (userId: number, period?: 'daily'|'weekly'|'monthly') => Promise<{ success: boolean; data?: ReferralAnalyticsData; message?: string }>
  getReferredUsers: (args: { userId: number; limit?: number; offset?: number }) => Promise<{ success: boolean; items?: ReferredUser[]; message?: string }>

  // Utility actions
  isUsersCacheValid: () => boolean
  shouldRefreshUsersData: (newFilters?: GetUsersFilters) => boolean
  // Admin lists loaders
  getLocations: (filters?: Record<string, any>, forceRefresh?: boolean) => Promise<{ success: boolean; data?: any; message?: string }>
  getServerTypes: (filters?: Record<string, any>, forceRefresh?: boolean) => Promise<{ success: boolean; data?: any; message?: string }>
  getServerSoftware: (filters?: Record<string, any>, forceRefresh?: boolean) => Promise<{ success: boolean; data?: any; message?: string }>
  getPlans: (filters?: Record<string, any>, forceRefresh?: boolean) => Promise<{ success: boolean; data?: any; message?: string }>


  // Private caches and in-flight maps (not persisted)
  _usersListInFlight: Record<string, Promise<GetUsersResponse> | undefined>
  _userByIdInFlight: Record<number, Promise<GetUsersResponse> | undefined>

  _adminLogsCache: Record<string, { items: AdminLogItem[]; lastFetch: number }>
  _adminLogsInFlight: Record<string, Promise<{ success: boolean; items?: AdminLogItem[]; message?: string }> | undefined>

  _referralsAnalyticsCache: Record<number, { data: ReferralAnalyticsData; lastFetch: number }>
  _referredUsersCache: Record<string, { items: ReferredUser[]; lastFetch: number }>

  _locationsCache: Record<string, { data: any; lastFetch: number }>
  _locationsInFlight: Record<string, Promise<{ success: boolean; data?: any; message?: string }> | undefined>

  _serverTypesCache: Record<string, { data: any; lastFetch: number }>
  _serverTypesInFlight: Record<string, Promise<{ success: boolean; data?: any; message?: string }> | undefined>

  _serverSoftwareCache: Record<string, { data: any; lastFetch: number }>
  _serverSoftwareInFlight: Record<string, Promise<{ success: boolean; data?: any; message?: string }> | undefined>

  _plansCache: Record<string, { data: any; lastFetch: number }>
  _plansInFlight: Record<string, Promise<{ success: boolean; data?: any; message?: string }> | undefined>

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

      // In-flight request dedupe maps
      _usersListInFlight: {} as Record<string, Promise<GetUsersResponse>>,
      _userByIdInFlight: {} as Record<number, Promise<GetUsersResponse>>,

      // Activity/logs cache and in-flight map
      _adminLogsCache: {} as Record<string, { items: AdminLogItem[]; lastFetch: number }>,
      _adminLogsInFlight: {} as Record<string, Promise<{ success: boolean; items?: AdminLogItem[]; message?: string }>>,

      // Referrals caches
      _referralsAnalyticsCache: {} as Record<number, { data: ReferralAnalyticsData; lastFetch: number }>,
      _referredUsersCache: {} as Record<string, { items: ReferredUser[]; lastFetch: number }>,

      // Admin lists caches + in-flight dedupe (2min TTL like users)
      _locationsCache: {} as Record<string, { data: any; lastFetch: number }>,
      _locationsInFlight: {} as Record<string, Promise<{ success: boolean; data?: any; message?: string }>>,
      _serverTypesCache: {} as Record<string, { data: any; lastFetch: number }>,
      _serverTypesInFlight: {} as Record<string, Promise<{ success: boolean; data?: any; message?: string }>>,
      _serverSoftwareCache: {} as Record<string, { data: any; lastFetch: number }>,
      _serverSoftwareInFlight: {} as Record<string, Promise<{ success: boolean; data?: any; message?: string }>>,
      _plansCache: {} as Record<string, { data: any; lastFetch: number }>,
      _plansInFlight: {} as Record<string, Promise<{ success: boolean; data?: any; message?: string }>>,


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
            pagination: get().usersListPagination || undefined,
            stats: get().usersListStats || undefined
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

        // In-flight dedupe by filters
        const key = JSON.stringify(filters || {})
        const inflight = get()._usersListInFlight[key]
        if (!forceRefresh && inflight) {
          return await inflight
        }

        // Set loading and start request promise
        set((state) => ({ ...state, isLoadingUsersList: true }))
        const promise = (async (): Promise<GetUsersResponse> => {
          try {
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
            // Default to ID ascending when not specified
            if (filters.sort_by) {
              queryParams.append('sort_by', filters.sort_by)
            } else {
              queryParams.append('sort_by', 'id')
            }
            if (filters.sort_order) {
              queryParams.append('sort_order', filters.sort_order)
            } else {
              queryParams.append('sort_order', 'asc')
            }
            if (filters.include_stats) queryParams.append('include_stats', filters.include_stats.toString())
            if (filters.include_oauth) queryParams.append('include_oauth', filters.include_oauth.toString())
            if (filters.include_referrals) queryParams.append('include_referrals', filters.include_referrals.toString())

            // Get current user data for authentication header
            const currentUser = useAuthStore.getState().currentUser

            const headers: HeadersInit = getAdminAuthHeaders()


            const response = await fetch(`/api/admin/users?${queryParams.toString()}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const result = await response.json()
            console.log('Users list API response:', result)

            if (result.success) {
              const now = new Date()
              set((state) => ({
                ...state,
                usersList: result.users || [],
                usersListPagination: result.pagination || null,
                usersListStats: result.stats || null,
                usersListLastFetch: now,
                usersListLastFilters: filters,
              }))
              return {
                success: true,
                message: result.message || 'Users list retrieved successfully',
                users: result.users,
                pagination: result.pagination,
                stats: result.stats
              }
            } else {
              return { success: false, message: result.message || 'Failed to retrieve users list', errors: result.errors }
            }
          } catch (error) {
            console.error('Get users list error:', error)
            return { success: false, message: 'Network error occurred while retrieving users list' }
          } finally {
            set((s) => { const m = { ...(s as any)._usersListInFlight }; delete m[key]; return { ...(s as any), _usersListInFlight: m, isLoadingUsersList: false } })
          }
        })()
        set((s) => ({ ...(s as any), _usersListInFlight: { ...(s as any)._usersListInFlight, [key]: promise } }))
        return await promise
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

        // In-flight dedupe by userId
        const inflightById = get()._userByIdInFlight[userId]
        if (!forceRefresh && inflightById) {
          return await inflightById
        }

        set((state) => ({ ...state, isLoadingSelectedUser: true }))
        const promise = (async (): Promise<GetUsersResponse> => {
          try {
            console.log('Fetching user by ID via API:', userId)
            const currentUser = useAuthStore.getState().currentUser
            const headers: HeadersInit = getAdminAuthHeaders()

            const response = await fetch(`/api/admin/users/${userId}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const result = await response.json()
            console.log('User by ID API response:', result)
            if (result.success && result.users && result.users[0]) {
              set((state) => ({ ...state, selectedUser: result.users[0] }))
              return { success: true, message: result.message || 'User retrieved successfully', users: result.users }
            } else {
              return { success: false, message: result.message || 'Failed to retrieve user', errors: result.errors }
            }
          } catch (error) {
            console.error('Get user by ID error:', error)
            return { success: false, message: 'Network error occurred while retrieving user' }
          } finally {
            set((s) => { const m = { ...(s as any)._userByIdInFlight }; delete m[userId]; return { ...(s as any), _userByIdInFlight: m, isLoadingSelectedUser: false } })
          }
        })()
        set((s) => ({ ...(s as any), _userByIdInFlight: { ...(s as any)._userByIdInFlight, [userId]: promise } }))
        return await promise
      },


      // Update user profile/role
      updateUser: async (userId, data) => {
        try {
          const currentUser = useAuthStore.getState().currentUser
          const headers: HeadersInit = getAdminAuthHeaders()


          const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers,
            credentials: 'include',
            body: JSON.stringify(data)
          })
          const json = await res.json()
          if (!json.success) return { success: false, message: json.message || 'Failed to update user' }

          // Update caches
          set((state) => ({
            ...state,
            selectedUser: state.selectedUser && state.selectedUser.id === userId ? { ...state.selectedUser, ...json.user } : state.selectedUser,
            usersList: state.usersList.map(u => u.id === userId ? { ...u, ...json.user } : u)
          }))
          return { success: true, message: 'User updated' }
        } catch (e) {
          return { success: false, message: 'Network error' }
        }
      },

      // Ban/disable a user
      banUser: async (userId, reason = 'Disabled by administrator') => {
        try {
          const currentUser = useAuthStore.getState().currentUser
          const headers: HeadersInit = getAdminAuthHeaders()

          const res = await fetch(`/api/admin/users/${userId}/disable`, {
            method: 'POST', headers, credentials: 'include', body: JSON.stringify({ reason })
          })
          const json = await res.json()
          if (!json.success) return { success: false, message: json.message || 'Failed to disable user' }
          set((state) => ({
            ...state,
            usersList: state.usersList.map(u => u.id === userId ? { ...u, banned: true } : u),
            selectedUser: state.selectedUser && state.selectedUser.id === userId ? { ...state.selectedUser, banned: true } : state.selectedUser
          }))
          return { success: true, message: 'User disabled' }
        } catch {
          return { success: false, message: 'Network error' }
        }
      },

      // Unban/enable a user
      unbanUser: async (userId) => {
        try {
          const currentUser = useAuthStore.getState().currentUser
          const headers: HeadersInit = getAdminAuthHeaders()

          const res = await fetch(`/api/admin/users/${userId}/enable`, { method: 'POST', headers, credentials: 'include' })
          const json = await res.json()
          if (!json.success) return { success: false, message: json.message || 'Failed to enable user' }
          set((state) => ({
            ...state,
            usersList: state.usersList.map(u => u.id === userId ? { ...u, banned: false } : u),
            selectedUser: state.selectedUser && state.selectedUser.id === userId ? { ...state.selectedUser, banned: false } : state.selectedUser
          }))
          return { success: true, message: 'User enabled' }
        } catch {
          return { success: false, message: 'Network error' }
        }
      },

      // Adjust coins for a user
      adjustUserCoins: async (userId, amount, reason) => {
        try {
          const currentUser = useAuthStore.getState().currentUser
          const headers: HeadersInit = getAdminAuthHeaders()

          const res = await fetch(`/api/admin/users/${userId}/coins`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ amount, reason }) })
          const json = await res.json()
          if (!json.success) return { success: false, message: json.message || 'Failed to adjust coins' }
          set((state) => ({
            ...state,
            usersList: state.usersList.map(u => u.id === userId ? { ...u, coins: (u.coins + amount) } : u),
            selectedUser: state.selectedUser && state.selectedUser.id === userId ? { ...state.selectedUser, coins: (state.selectedUser.coins + amount) } : state.selectedUser
          }))
          return { success: true, message: 'Coins adjusted' }
        } catch {
          return { success: false, message: 'Network error' }
        }
      },

      // Admin logs with cache and request dedupe
      getAdminLogs: async ({ userId, page = 1, limit = 20, category }: { userId: number; page?: number; limit?: number; category?: string }) => {
        const key = `${userId}:${page}:${limit}:${category || ''}`
        const now = Date.now()
        const cache = get()._adminLogsCache[key]
        if (cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, items: cache.items }
        }
        // In-flight dedupe
        const logsInflight = get()._adminLogsInFlight[key]
        if (logsInflight) {
          return await logsInflight
        }
        const currentUser = useAuthStore.getState().currentUser
        const headers: HeadersInit = getAdminAuthHeaders()

        const qp = new URLSearchParams({ user_id: String(userId), page: String(page), limit: String(limit) })
        if (category) qp.set('category', category)
        const promise = (async () => {
          try {
            const res = await fetch(`/api/admin/logs?${qp.toString()}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const json = await res.json()
            if (res.ok && json && (json.items || json.logs)) {
              const items: AdminLogItem[] = json.items || json.logs || []
              set((s) => ({ ...s, _adminLogsCache: { ...s._adminLogsCache, [key]: { items, lastFetch: Date.now() } } }))
              return { success: true, items }
            }
            return { success: false, message: json?.message || 'Failed to load logs' }
          } catch (e: any) {
            return { success: false, message: e?.message || 'Network error' }
          } finally {
            // clear in-flight
            set((s) => { const m = { ...s._adminLogsInFlight }; delete m[key]; return { ...s, _adminLogsInFlight: m } })
          }
        })()
        set((s) => ({ ...s, _adminLogsInFlight: { ...s._adminLogsInFlight, [key]: promise } }))
        return await promise
      },

      // Referral analytics with cache
      getReferralAnalytics: async (userId: number, period: 'daily'|'weekly'|'monthly' = 'daily') => {
        const key = userId
        const cache = get()._referralsAnalyticsCache[key]
        const now = Date.now()
        if (cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, data: cache.data }
        }
        try {
          const currentUser = useAuthStore.getState().currentUser
          const headers: HeadersInit = getAdminAuthHeaders()

          const url = `/api/referrals/analytics?user_id=${userId}&period_type=${period}`
          const res = await fetch(url, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
          const json = await res.json()
          if (res.ok && json?.success) {
            const data = json.data || json
            set((s) => ({ ...s, _referralsAnalyticsCache: { ...s._referralsAnalyticsCache, [key]: { data, lastFetch: Date.now() } } }))
            return { success: true, data }
          }
          return { success: false, message: json?.message || 'Failed to load referral analytics' }
        } catch (e: any) {
          return { success: false, message: e?.message || 'Network error' }
        }
      },

      // Referred users with cache (paged)
      getReferredUsers: async ({ userId, limit = 20, offset = 0 }: { userId: number; limit?: number; offset?: number }) => {
        const key = `${userId}:${limit}:${offset}`
        const cache = get()._referredUsersCache[key]
        const now = Date.now()
        if (cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, items: cache.items }
        }
        try {
          const currentUser = useAuthStore.getState().currentUser
          const headers: HeadersInit = getAdminAuthHeaders()

          const url = `/api/referrals/users?user_id=${userId}&limit=${limit}&offset=${offset}`
          const res = await fetch(url, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
          const json = await res.json()
          if (res.ok) {
            const items: ReferredUser[] = json.items || json.users || []
            set((s) => ({ ...s, _referredUsersCache: { ...s._referredUsersCache, [key]: { items, lastFetch: Date.now() } } }))
            return { success: true, items }
          }
          return { success: false, message: json?.message || 'Failed to load referred users' }
        } catch (e: any) {
          return { success: false, message: e?.message || 'Network error' }
        }
      },

      // Locations list with TTL cache + in-flight dedupe
      getLocations: async (filters: Record<string, any> = {}, forceRefresh: boolean = false) => {
        const key = JSON.stringify(filters || {})
        const now = Date.now()
        const cache = get()._locationsCache[key]
        if (!forceRefresh && cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, data: cache.data }
        }
        const locationsInflight = get()._locationsInFlight[key]
        if (!forceRefresh && locationsInflight) {
          return await locationsInflight
        }
        const currentUser = useAuthStore.getState().currentUser
        const headers: HeadersInit = getAdminAuthHeaders()

        const qp = new URLSearchParams()
        for (const [k,v] of Object.entries(filters)) if (v !== undefined && v !== null) qp.append(k, String(v))
        const promise = (async () => {
          try {
            const res = await fetch(`/api/admin/locations?${qp.toString()}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const json = await res.json()
            if (res.ok && json) {
              set((s) => ({ ...(s as any), _locationsCache: { ...(s as any)._locationsCache, [key]: { data: json, lastFetch: Date.now() } } }))
              return { success: true, data: json }
            }
            return { success: false, message: json?.message || 'Failed to load locations' }
          } catch (e: any) {
            return { success: false, message: e?.message || 'Network error' }
          } finally {
            set((s) => { const m = { ...(s as any)._locationsInFlight }; delete m[key]; return { ...(s as any), _locationsInFlight: m } })
          }
        })()
        set((s) => ({ ...(s as any), _locationsInFlight: { ...(s as any)._locationsInFlight, [key]: promise } }))
        return await promise
      },

      // Server types list with TTL cache + in-flight dedupe
      getServerTypes: async (filters: Record<string, any> = {}, forceRefresh: boolean = false) => {
        const key = JSON.stringify(filters || {})
        const now = Date.now()
        const cache = get()._serverTypesCache[key]
        if (!forceRefresh && cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, data: cache.data }
        }
        const typesInflight = get()._serverTypesInFlight[key]
        if (!forceRefresh && typesInflight) {
          return await typesInflight
        }
        const currentUser = useAuthStore.getState().currentUser
        const headers: HeadersInit = getAdminAuthHeaders()

        const qp = new URLSearchParams()
        for (const [k,v] of Object.entries(filters)) if (v !== undefined && v !== null) qp.append(k, String(v))
        const promise = (async () => {
          try {
            const res = await fetch(`/api/admin/server-types?${qp.toString()}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const json = await res.json()
            if (res.ok && json) {
              set((s) => ({ ...(s as any), _serverTypesCache: { ...(s as any)._serverTypesCache, [key]: { data: json, lastFetch: Date.now() } } }))
              return { success: true, data: json }
            }
            return { success: false, message: json?.message || 'Failed to load server types' }
          } catch (e: any) {
            return { success: false, message: e?.message || 'Network error' }
          } finally {
            set((s) => { const m = { ...(s as any)._serverTypesInFlight }; delete m[key]; return { ...(s as any), _serverTypesInFlight: m } })
          }
        })()
        set((s) => ({ ...(s as any), _serverTypesInFlight: { ...(s as any)._serverTypesInFlight, [key]: promise } }))
        return await promise
      },

      // Server software list with TTL cache + in-flight dedupe
      getServerSoftware: async (filters: Record<string, any> = {}, forceRefresh: boolean = false) => {
        const key = JSON.stringify(filters || {})
        const now = Date.now()
        const cache = get()._serverSoftwareCache[key]
        if (!forceRefresh && cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, data: cache.data }
        }
        const softwareInflight = get()._serverSoftwareInFlight[key]
        if (!forceRefresh && softwareInflight) {
          return await softwareInflight
        }
        const currentUser = useAuthStore.getState().currentUser
        const headers: HeadersInit = getAdminAuthHeaders()

        const qp = new URLSearchParams()
        for (const [k,v] of Object.entries(filters)) if (v !== undefined && v !== null) qp.append(k, String(v))
        const promise = (async () => {
          try {
            const res = await fetch(`/api/admin/server-software?${qp.toString()}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const json = await res.json()
            if (res.ok && json) {
              set((s) => ({ ...(s as any), _serverSoftwareCache: { ...(s as any)._serverSoftwareCache, [key]: { data: json, lastFetch: Date.now() } } }))
              return { success: true, data: json }
            }
            return { success: false, message: json?.message || 'Failed to load server software' }
          } catch (e: any) {
            return { success: false, message: e?.message || 'Network error' }
          } finally {
            set((s) => { const m = { ...(s as any)._serverSoftwareInFlight }; delete m[key]; return { ...(s as any), _serverSoftwareInFlight: m } })
          }
        })()
        set((s) => ({ ...(s as any), _serverSoftwareInFlight: { ...(s as any)._serverSoftwareInFlight, [key]: promise } }))
        return await promise
      },

      // Plans list with TTL cache + in-flight dedupe
      getPlans: async (filters: Record<string, any> = {}, forceRefresh: boolean = false) => {
        const key = JSON.stringify(filters || {})
        const now = Date.now()
        const cache = get()._plansCache[key]
        if (!forceRefresh && cache && (now - cache.lastFetch) < get().usersCacheValidDuration) {
          return { success: true, data: cache.data }
        }
        const plansInflight = get()._plansInFlight[key]
        if (!forceRefresh && plansInflight) {
          return await plansInflight
        }
        const currentUser = useAuthStore.getState().currentUser
        const headers: HeadersInit = getAdminAuthHeaders()

        const qp = new URLSearchParams()
        for (const [k,v] of Object.entries(filters)) if (v !== undefined && v !== null) qp.append(k, String(v))
        const promise = (async () => {
          try {
            const res = await fetch(`/api/admin/plans?${qp.toString()}`, { method: 'GET', headers, credentials: 'include', cache: 'no-store' })
            const json = await res.json()
            if (res.ok && json) {
              set((s) => ({ ...(s as any), _plansCache: { ...(s as any)._plansCache, [key]: { data: json, lastFetch: Date.now() } } }))
              return { success: true, data: json }
            }
            return { success: false, message: json?.message || 'Failed to load plans' }
          } catch (e: any) {
            return { success: false, message: e?.message || 'Network error' }
          } finally {
            set((s) => { const m = { ...(s as any)._plansInFlight }; delete m[key]; return { ...(s as any), _plansInFlight: m } })
          }
        })()
        set((s) => ({ ...(s as any), _plansInFlight: { ...(s as any)._plansInFlight, [key]: promise } }))
        return await promise
      },


      // Bulk operations
      bulkDisableEnable: async (userIds, action, reason = 'Disabled by administrator') => {
        for (const id of userIds) {
          if (action === 'disable') await get().banUser(id, reason)
          else await get().unbanUser(id)
        }
        return { success: true, message: 'Bulk action completed' }
      },

      bulkRoleChange: async (userIds, role) => {
        for (const id of userIds) {
          await get().updateUser(id, { role })
        }
        return { success: true, message: 'Roles updated' }
      },

      bulkAdjustCoins: async (userIds, amount, reason) => {
        for (const id of userIds) {
          await get().adjustUserCoins(id, amount, reason)
        }
        return { success: true, message: 'Coins adjusted for selected users' }
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
