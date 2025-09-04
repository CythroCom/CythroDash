"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nanoid } from "nanoid"
import { getSessionTokenFromCookies, isSessionValid, validateSessionData } from "@/lib/auth/session"

// Types for authentication and user management
export type Role = "Admin" | "Moderator" | "User"

export type AuthUser = {
  id: number
  pterodactyl_uuid: string
  username: string
  email: string
  first_name: string
  last_name: string
  display_name?: string
  role: number // 0 = admin, 1 = user
  verified: boolean
  coins: number
  avatar_url?: string
  created_at: string
  last_login?: string
  referral_code?: string
  referred_by?: string
  referral_earnings?: number
}

export type PanelUser = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
}

export type LoginCredentials = {
  identifier: string // email or username
  password: string
  remember_me?: boolean
}

export type RegisterData = {
  username: string
  email: string
  first_name: string
  last_name: string
  password: string
  password_confirmation: string
  referral_code?: string
}

type AuthStore = {
  // Authentication state
  isAuthenticated: boolean
  currentUser: AuthUser | null
  sessionToken: string | null
  isLoading: boolean

  // Real-time updates
  autoRefreshEnabled: boolean
  autoRefreshInterval: number // in milliseconds
  lastUserDataRefresh: Date | null
  isRefreshingUserData: boolean

  // Security logs cache
  securityLogs: any[]
  securityStats: any | null
  securityLogsLastFetch: Date | null
  securityStatsLastFetch: Date | null
  isLoadingSecurityLogs: boolean
  isLoadingSecurityStats: boolean

  // Authentication actions
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message?: string; errors?: any[] }>
  register: (data: RegisterData) => Promise<{ success: boolean; message?: string; errors?: any[] }>
  logout: () => Promise<void>
  refreshSession: (forceRefresh?: boolean) => Promise<boolean>

  // Real-time update actions
  refreshUserData: (force?: boolean) => Promise<boolean>
  enableAutoRefresh: () => void
  disableAutoRefresh: () => void
  setAutoRefreshInterval: (interval: number) => void

  // User data actions
  updateUserData: (data: Partial<AuthUser>) => void
  updateCoins: (amount: number) => void
  updateUserProfile: (data: any) => Promise<{ success: boolean; message?: string; errors?: any[]; user?: any }>
  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) => Promise<{ success: boolean; message?: string; errors?: any[] }>

  // Security logs actions
  getSecurityLogs: (filters?: any, forceRefresh?: boolean) => Promise<{ success: boolean; message?: string; logs?: any[]; errors?: any[] }>
  getSecurityStats: (days?: number, forceRefresh?: boolean) => Promise<{ success: boolean; message?: string; stats?: any; errors?: any[] }>
  getSecurityDataParallel: (filters?: any, days?: number, forceRefresh?: boolean) => Promise<{ logs: any; stats: any }>
  clearSecurityLogsCache: () => void

  // Session management
  setSession: (user: AuthUser, token: string) => void
  clearSession: () => void
  checkSession: () => Promise<boolean>
}

type UserStore = {
  users: PanelUser[]
  create: (data: Omit<PanelUser, "id">) => PanelUser
  remove: (id: string) => void
  update: (id: string, patch: Partial<PanelUser>) => void
}

const seed: PanelUser[] = [
  { id: "u1", name: "Admin User", email: "admin@panel.dev", role: "Admin", active: true },
  { id: "u2", name: "Alex", email: "alex@panel.dev", role: "Moderator", active: true },
  { id: "u3", name: "Steve", email: "steve@panel.dev", role: "User", active: true },
  { id: "u4", name: "Diana", email: "diana@panel.dev", role: "Admin", active: false },
]

// Authentication store for current user session
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      sessionToken: null,
      isLoading: false,

      // Real-time updates
      autoRefreshEnabled: true, // Enable by default
      autoRefreshInterval: 30000, // 30 seconds
      lastUserDataRefresh: null,
      isRefreshingUserData: false,

      // Security logs cache
      securityLogs: [],
      securityStats: null,
      securityLogsLastFetch: null,
      securityStatsLastFetch: null,
      isLoadingSecurityLogs: false,
      isLoadingSecurityStats: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true })

        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success && result.user && result.sessionToken) {
            get().setSession(result.user, result.sessionToken)
            return { success: true }
          } else {
            return {
              success: false,
              message: result.message || 'Login failed',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Login error:', error)
          return {
            success: false,
            message: 'Network error occurred'
          }
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true })

        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success) {
            return {
              success: true,
              message: result.message || 'Registration successful'
            }
          } else {
            return {
              success: false,
              message: result.message || 'Registration failed',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Registration error:', error)
          return {
            success: false,
            message: 'Network error occurred'
          }
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          })
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          get().clearSession()
        }
      },

      refreshSession: async (forceRefresh: boolean = false) => {
        const { sessionToken, isAuthenticated, currentUser } = get()

        console.log('🔄 Refreshing session locally:', { 
          forceRefresh, 
          isAuthenticated, 
          hasUser: !!currentUser, 
          hasToken: !!sessionToken 
        })

        // If we don't have a session token, return false
        if (!sessionToken) {
          console.log('❌ No session token available')
          return false
        }

        // If we have all required data and it's not a forced refresh, consider session valid
        if (!forceRefresh && isAuthenticated && currentUser && sessionToken) {
          console.log('✅ Session already valid, skipping refresh')
          return true
        }

        // For forced refresh or validation, check if session data is complete
        console.log('🔍 Validating session data locally...')
        
        try {
          // Basic validation: check if we have required user data
          if (currentUser && 
              currentUser.id && 
              currentUser.username && 
              currentUser.email && 
              typeof currentUser.role === 'number') {
            
            console.log('✅ Session validation successful:', {
              userId: currentUser.id,
              username: currentUser.username,
              role: currentUser.role
            })
            
            // Session is valid - return true
            return true
          } else {
            console.log('❌ Session validation failed: incomplete user data')
            get().clearSession()
            return false
          }
        } catch (error) {
          console.error('💥 Session validation error:', error)
          return false
        }
      },

      // Real-time user data refresh
      refreshUserData: async (force: boolean = false) => {
        const { 
          isAuthenticated, 
          currentUser, 
          sessionToken, 
          isRefreshingUserData,
          lastUserDataRefresh,
          autoRefreshInterval
        } = get()

        if (!isAuthenticated || !currentUser || !sessionToken) {
          console.log('❌ Cannot refresh: not authenticated or no session token')
          return false
        }

        // Prevent multiple simultaneous requests
        if (isRefreshingUserData && !force) {
          console.log('⏳ Refresh already in progress')
          return false
        }

        // Check if enough time has passed since last refresh
        if (!force && lastUserDataRefresh) {
          const timeSinceLastRefresh = Date.now() - lastUserDataRefresh.getTime()
          if (timeSinceLastRefresh < autoRefreshInterval) {
            console.log(`⏰ Too soon to refresh (${timeSinceLastRefresh}ms < ${autoRefreshInterval}ms)`)
            return true // Still valid, no need to refresh
          }
        }

        try {
          set({ isRefreshingUserData: true })
          console.log('🔄 Fetching fresh user data from database...')

          // Fetch fresh user data from the database
          const response = await fetch('/api/user/me', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            }
          })

          if (response.ok) {
            const result = await response.json()
            
            if (result.success && result.user) {
              const newUserData = result.user
              
              // Check if any important data has changed
              const roleChanged = currentUser.role !== newUserData.role
              const emailChanged = currentUser.email !== newUserData.email
              const coinsChanged = currentUser.coins !== newUserData.coins
              
              if (roleChanged) {
                console.log(`🔄 Role updated: ${currentUser.role} → ${newUserData.role}`)
              }
              if (emailChanged) {
                console.log(`📧 Email updated: ${currentUser.email} → ${newUserData.email}`)
              }
              if (coinsChanged) {
                console.log(`💰 Coins updated: ${currentUser.coins} → ${newUserData.coins}`)
              }
              
              // Update user data but keep existing session token
              get().setSession(newUserData, sessionToken)
              
              set({ 
                lastUserDataRefresh: new Date(),
                isRefreshingUserData: false 
              })
              console.log('✅ User data refresh completed successfully')
              return true
            }
          }
          
          // If we get here, the API call failed
          set({ isRefreshingUserData: false })
          console.log('❌ User data refresh failed - API response not successful')
          return false
          
        } catch (error) {
          console.error('💥 User data refresh error:', error)
          set({ isRefreshingUserData: false })
          return false
        }
      },

      // Enable automatic refresh
      enableAutoRefresh: () => {
        set({ autoRefreshEnabled: true })
        console.log('Auto-refresh enabled')
      },

      // Disable automatic refresh
      disableAutoRefresh: () => {
        set({ autoRefreshEnabled: false })
        console.log('Auto-refresh disabled')
      },

      // Set auto-refresh interval
      setAutoRefreshInterval: (interval: number) => {
        const validInterval = Math.max(5000, Math.min(300000, interval)) // Between 5s and 5min
        set({ autoRefreshInterval: validInterval })
        console.log(`Auto-refresh interval set to ${validInterval}ms`)
      },

      updateUserData: (data: Partial<AuthUser>) => {
        set((state) => ({
          currentUser: state.currentUser ? { ...state.currentUser, ...data } : null
        }))
      },

      updateCoins: (amount: number) => {
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, coins: state.currentUser.coins + amount }
            : null
        }))
      },

      updateUserProfile: async (data: any) => {
        const { currentUser } = get()

        if (!currentUser) {
          return {
            success: false,
            message: 'No user logged in'
          }
        }

        try {
          console.log('Updating user profile via API:', data)

          // Prepare the request data with user ID
          const requestData = {
            user_id: currentUser.id,
            ...data
          }

          const response = await fetch('/api/user/update-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestData)
          })

          const result = await response.json()
          console.log('Profile update API response:', result)

          if (result.success && result.user) {
            // Update current user data with the actual saved data from the database
            get().updateUserData({
              id: result.user.id,
              email: result.user.email,
              first_name: result.user.first_name,
              last_name: result.user.last_name,
              display_name: result.user.display_name,
              username: result.user.username,
              avatar_url: result.user.avatar_url,
              coins: result.user.coins,
              verified: result.user.verified,
              role: result.user.role,
              pterodactyl_uuid: result.user.pterodactyl_uuid,
              created_at: result.user.created_at,
              last_login: result.user.last_login
            })

            // Clear security logs cache since a new security event was created
            get().clearSecurityLogsCache()

            return {
              success: true,
              message: result.message || 'Profile updated successfully',
              user: result.user
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to update profile',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Update profile error:', error)
          return {
            success: false,
            message: 'Network error occurred while updating profile'
          }
        }
      },

      changePassword: async (data: { current_password: string; new_password: string; confirm_password: string }) => {
        const { currentUser } = get()

        if (!currentUser) {
          return {
            success: false,
            message: 'No user logged in'
          }
        }

        try {
          console.log('Changing password via API for user:', currentUser.id)

          // Prepare the request data with user ID
          const requestData = {
            user_id: currentUser.id,
            current_password: data.current_password,
            new_password: data.new_password,
            confirm_password: data.confirm_password
          }

          const response = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestData)
          })

          const result = await response.json()
          console.log('Password change API response:', result)

          if (result.success) {
            // Clear security logs cache since a new security event was created
            get().clearSecurityLogsCache()

            return {
              success: true,
              message: result.message || 'Password changed successfully'
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to change password',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Change password error:', error)
          return {
            success: false,
            message: 'Network error occurred while changing password'
          }
        }
      },

      getSecurityLogs: async (filters?: any, forceRefresh: boolean = false) => {
        const { currentUser, securityLogs, securityLogsLastFetch, isLoadingSecurityLogs } = get()

        if (!currentUser) {
          return {
            success: false,
            message: 'No user logged in'
          }
        }

        // Check if we have cached data and it's recent (less than 2 minutes old for faster updates)
        const cacheValidDuration = 2 * 60 * 1000; // 2 minutes
        const now = new Date();
        const isCacheValid = securityLogsLastFetch &&
                           (now.getTime() - securityLogsLastFetch.getTime()) < cacheValidDuration;

        // Return cached data if available and valid, unless force refresh is requested
        if (!forceRefresh && isCacheValid && securityLogs.length > 0) {
          console.log('Returning cached security logs for user:', currentUser.id)
          return {
            success: true,
            message: 'Security logs retrieved from cache',
            logs: securityLogs
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingSecurityLogs) {
          console.log('Security logs request already in progress')
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        try {
          // Set loading state
          set((state) => ({ ...state, isLoadingSecurityLogs: true }))

          console.log('Fetching security logs via API for user:', currentUser.id)

          // Prepare the request data
          const requestData = {
            action: 'get_logs',
            user_id: currentUser.id,
            ...filters
          }

          const response = await fetch('/api/user/security-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestData)
          })

          const result = await response.json()
          console.log('Security logs API response:', result)

          if (result.success) {
            // Cache the results
            set((state) => ({
              ...state,
              securityLogs: result.logs || [],
              securityLogsLastFetch: now,
              isLoadingSecurityLogs: false
            }))

            return {
              success: true,
              message: result.message || 'Security logs retrieved successfully',
              logs: result.logs
            }
          } else {
            set((state) => ({ ...state, isLoadingSecurityLogs: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve security logs',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get security logs error:', error)
          set((state) => ({ ...state, isLoadingSecurityLogs: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving security logs'
          }
        }
      },

      getSecurityStats: async (days: number = 30, forceRefresh: boolean = false) => {
        const { currentUser, securityStats, securityStatsLastFetch, isLoadingSecurityStats } = get()

        if (!currentUser) {
          return {
            success: false,
            message: 'No user logged in'
          }
        }

        // Check if we have cached data and it's recent (less than 5 minutes old for faster updates)
        const cacheValidDuration = 5 * 60 * 1000; // 5 minutes
        const now = new Date();
        const isCacheValid = securityStatsLastFetch &&
                           (now.getTime() - securityStatsLastFetch.getTime()) < cacheValidDuration;

        // Return cached data if available and valid, unless force refresh is requested
        if (!forceRefresh && isCacheValid && securityStats) {
          console.log('Returning cached security stats for user:', currentUser.id)
          return {
            success: true,
            message: 'Security statistics retrieved from cache',
            stats: securityStats
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingSecurityStats) {
          console.log('Security stats request already in progress')
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        try {
          // Set loading state
          set((state) => ({ ...state, isLoadingSecurityStats: true }))

          console.log('Fetching security stats via API for user:', currentUser.id)

          // Prepare the request data
          const requestData = {
            action: 'get_stats',
            user_id: currentUser.id,
            days: days
          }

          const response = await fetch('/api/user/security-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(requestData)
          })

          const result = await response.json()
          console.log('Security stats API response:', result)

          if (result.success) {
            // Cache the results
            set((state) => ({
              ...state,
              securityStats: result.stats,
              securityStatsLastFetch: now,
              isLoadingSecurityStats: false
            }))

            return {
              success: true,
              message: result.message || 'Security statistics retrieved successfully',
              stats: result.stats
            }
          } else {
            set((state) => ({ ...state, isLoadingSecurityStats: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve security statistics',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get security stats error:', error)
          set((state) => ({ ...state, isLoadingSecurityStats: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving security statistics'
          }
        }
      },

      // Parallel loading function for faster performance
      getSecurityDataParallel: async (filters?: any, days: number = 30, forceRefresh: boolean = false) => {
        const { currentUser } = get()

        if (!currentUser) {
          return {
            logs: { success: false, message: 'No user logged in' },
            stats: { success: false, message: 'No user logged in' }
          }
        }

        try {
          // Load both logs and stats in parallel for maximum speed
          const [logsResult, statsResult] = await Promise.all([
            get().getSecurityLogs(filters, forceRefresh),
            get().getSecurityStats(days, forceRefresh)
          ])

          return {
            logs: logsResult,
            stats: statsResult
          }
        } catch (error) {
          console.error('Parallel security data loading error:', error)
          return {
            logs: { success: false, message: 'Failed to load security logs' },
            stats: { success: false, message: 'Failed to load security stats' }
          }
        }
      },

      clearSecurityLogsCache: () => {
        console.log('Clearing security logs cache')
        set((state) => ({
          ...state,
          securityLogs: [],
          securityStats: null,
          securityLogsLastFetch: null,
          securityStatsLastFetch: null,
          isLoadingSecurityLogs: false,
          isLoadingSecurityStats: false
        }))
      },

      setSession: (user: AuthUser, token: string) => {
        set({
          isAuthenticated: true,
          currentUser: user,
          sessionToken: token,
        })
      },

      clearSession: () => {
        set({
          isAuthenticated: false,
          currentUser: null,
          sessionToken: null,
        })
      },

      checkSession: async () => {
        const { isAuthenticated, currentUser, sessionToken } = get()

        console.log('checkSession called:', { isAuthenticated, hasUser: !!currentUser, hasToken: !!sessionToken })

        // First check if we have valid session data in the store
        if (isSessionValid(sessionToken, currentUser) && isAuthenticated) {
          console.log('Session valid from store data')
          return true
        }

        // Check if we have a session token in cookies
        const cookieToken = getSessionTokenFromCookies()
        if (cookieToken && currentUser && validateSessionData(currentUser)) {
          // We have a cookie token and valid user data, update the store
          console.log('Session valid from cookies, updating store')
          get().setSession(currentUser, cookieToken)
          return true
        }

        // If we have a session token but no user data, try to refresh ONLY ONCE
        if ((sessionToken || cookieToken) && !currentUser) {
          console.log('Have token but no user data, attempting refresh...')
          return await get().refreshSession()
        }

        // No valid session data available
        console.log('No valid session data available')
        return false
      },
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        sessionToken: state.sessionToken,
      }),
      // Don't automatically validate session on rehydration
      // Let components handle validation when needed
      onRehydrateStorage: () => (state) => {
        if (state?.sessionToken && state?.currentUser) {
          console.log('Store rehydrated with session data for user:', state.currentUser.username)
          // Don't automatically call refreshSession - this was causing unnecessary API calls
        }
      }
    }
  )
)

// Panel users store for admin management (existing functionality)
export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      users: seed,
      create: (data) => {
        const user: PanelUser = { id: nanoid(8), ...data }
        set((s) => ({ users: [user, ...s.users] }))
        return user
      },
      remove: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      update: (id, patch) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),
    }),
    { name: "panel-users" }
  )
)
