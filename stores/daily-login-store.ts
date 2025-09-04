"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"
import { 
  CythroDashDailyLogin, 
  DailyLoginStats 
} from "@/database/tables/cythro_dash_daily_logins"

// Daily login status interface
export interface DailyLoginStatus {
  hasLoggedIn: boolean
  canClaim: boolean
  alreadyClaimed: boolean
  coinsAwarded?: number
  expiresAt?: Date
  loginRecord?: CythroDashDailyLogin
}

// Daily login history interface
export interface DailyLoginHistory {
  logins: CythroDashDailyLogin[]
  total: number
  limit: number
  offset: number
}

// Error interface
export interface DailyLoginError {
  message: string
  code?: string
  timestamp: Date
}

// Store interface
type DailyLoginStore = {
  // Data state
  dailyLoginStatus: DailyLoginStatus | null
  dailyLoginStats: DailyLoginStats | null
  dailyLoginHistory: DailyLoginHistory | null

  // UI state
  isLoading: boolean
  isChecking: boolean
  isClaiming: boolean
  isLoadingHistory: boolean
  isLoadingStats: boolean
  error: DailyLoginError | null

  // Cache state
  lastStatusCheck: Date | null
  lastStatsCheck: Date | null
  cacheExpiry: Date | null

  // Actions
  checkDailyLoginStatus: (forceRefresh?: boolean) => Promise<boolean>
  claimDailyBonus: () => Promise<boolean>
  getDailyLoginHistory: (limit?: number, offset?: number, forceRefresh?: boolean) => Promise<boolean>
  getDailyLoginStats: (forceRefresh?: boolean) => Promise<boolean>

  // UI actions
  clearError: () => void
  clearCache: () => void

  // Cache management
  isCacheValid: () => boolean
}

// Cache duration: 5 minutes for status, 30 minutes for stats
const STATUS_CACHE_DURATION = 5 * 60 * 1000
const STATS_CACHE_DURATION = 30 * 60 * 1000

// Helper function to get auth headers
const getAuthHeaders = () => {
  const { currentUser, sessionToken } = useAuthStore.getState()
  
  if (!currentUser || !sessionToken) {
    throw new Error('User not authenticated')
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`,
    'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
  }
}

export const useDailyLoginStore = create<DailyLoginStore>()(
  persist(
    (set, get) => ({
      // Initial state
      dailyLoginStatus: null,
      dailyLoginStats: null,
      dailyLoginHistory: null,

      // UI state
      isLoading: false,
      isChecking: false,
      isClaiming: false,
      isLoadingHistory: false,
      isLoadingStats: false,
      error: null,

      // Cache state
      lastStatusCheck: null,
      lastStatsCheck: null,
      cacheExpiry: null,
      
      // Check if cache is valid
      isCacheValid: () => {
        const { cacheExpiry } = get()
        if (!cacheExpiry) return false
        return new Date() < cacheExpiry
      },
      
      // Check daily login status
      checkDailyLoginStatus: async (forceRefresh = false) => {
        const state = get()
        
        // Check cache if not forcing refresh
        if (!forceRefresh && state.lastStatusCheck) {
          const timeSinceCheck = Date.now() - state.lastStatusCheck.getTime()
          if (timeSinceCheck < STATUS_CACHE_DURATION && state.dailyLoginStatus) {
            return true
          }
        }
        
        set({ isChecking: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/user/daily-login', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ action: 'check' })
          })
          
          const result = await response.json()
          
          if (result.success) {
            const now = new Date()
            set({
              dailyLoginStatus: result.data,
              lastStatusCheck: now,
              cacheExpiry: new Date(now.getTime() + STATUS_CACHE_DURATION),
              error: null
            })
            return true
          } else {
            set({
              error: {
                message: result.message || "Failed to check daily login status",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error checking daily login status:', error)
          set({
            error: {
              message: "Network error occurred while checking daily login status",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isChecking: false })
        }
      },

      // Claim daily login bonus
      claimDailyBonus: async () => {
        set({ isClaiming: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/user/daily-login', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ action: 'claim' })
          })
          
          const result = await response.json()
          
          if (result.success) {
            // Update daily login status to reflect claim
            const currentStatus = get().dailyLoginStatus
            if (currentStatus) {
              set({
                dailyLoginStatus: {
                  ...currentStatus,
                  alreadyClaimed: true,
                  canClaim: false
                },
                error: null
              })
            }

            // Update user coins in auth store
            const authStore = useAuthStore.getState()
            if (authStore.currentUser && result.data.coins_awarded) {
              authStore.updateUserData({
                ...authStore.currentUser,
                coins: authStore.currentUser.coins + result.data.coins_awarded
              })
            }

            // Refresh stats
            get().getDailyLoginStats(true)
            
            return true
          } else {
            set({
              error: {
                message: result.message || "Failed to claim daily login bonus",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error claiming daily login bonus:', error)
          set({
            error: {
              message: "Network error occurred while claiming daily login bonus",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isClaiming: false })
        }
      },

      // Get daily login history
      getDailyLoginHistory: async (limit = 30, offset = 0, forceRefresh = false) => {
        const state = get()
        
        // Check cache if not forcing refresh and requesting first page
        if (!forceRefresh && offset === 0 && state.dailyLoginHistory) {
          return true
        }
        
        set({ isLoadingHistory: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/user/daily-login', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ 
              action: 'history',
              limit,
              offset
            })
          })
          
          const result = await response.json()
          
          if (result.success) {
            set({
              dailyLoginHistory: result.data,
              error: null
            })
            return true
          } else {
            set({
              error: {
                message: result.message || "Failed to get daily login history",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error getting daily login history:', error)
          set({
            error: {
              message: "Network error occurred while getting daily login history",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isLoadingHistory: false })
        }
      },

      // Get daily login statistics
      getDailyLoginStats: async (forceRefresh = false) => {
        const state = get()
        
        // Check cache if not forcing refresh
        if (!forceRefresh && state.lastStatsCheck) {
          const timeSinceCheck = Date.now() - state.lastStatsCheck.getTime()
          if (timeSinceCheck < STATS_CACHE_DURATION && state.dailyLoginStats) {
            return true
          }
        }
        
        set({ isLoadingStats: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/user/daily-login', {
            method: 'GET',
            headers,
            credentials: 'include'
          })
          
          const result = await response.json()
          
          if (result.success) {
            set({
              dailyLoginStats: result.data,
              lastStatsCheck: new Date(),
              error: null
            })
            return true
          } else {
            set({
              error: {
                message: result.message || "Failed to get daily login statistics",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error getting daily login statistics:', error)
          set({
            error: {
              message: "Network error occurred while getting daily login statistics",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isLoadingStats: false })
        }
      },
      
      // UI actions
      clearError: () => {
        set({ error: null })
      },
      
      clearCache: () => {
        set({
          dailyLoginStatus: null,
          dailyLoginStats: null,
          dailyLoginHistory: null,
          lastStatusCheck: null,
          lastStatsCheck: null,
          cacheExpiry: null,
          error: null
        })
      }
    }),
    {
      name: "daily-login-store",
      // Only persist non-sensitive data
      partialize: (state) => ({
        dailyLoginStats: state.dailyLoginStats,
        lastStatsCheck: state.lastStatsCheck
      })
    }
  )
)
