"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"

// Types for social verification
export interface SocialVerification {
  _id: string
  user_id: number
  platform: 'discord' | 'github' | 'twitter'
  action: 'join_server' | 'follow_user' | 'star_repo' | 'fork_repo'
  status: 'pending' | 'verified' | 'failed' | 'expired'
  coins_reward: number
  claimed: boolean
  verified_at?: string
  claimed_at?: string
  created_at: string
  updated_at: string
}

export interface SocialVerificationStats {
  total_discord_verifications: number
  verified_discord_count: number
  unclaimed_discord_rewards: number
}

export interface DiscordConnectionStatus {
  connected: boolean
  discord_user?: {
    id: string
    username: string
    discriminator: string
    avatar?: string
    connected_at: string
  }
}

export interface DiscordVerificationRequest {
  action: 'verify' | 'claim' | 'recheck'
  verification_id?: string
  guild_id?: string
}

export interface DiscordVerificationResponse {
  success: boolean
  message: string
  verification?: SocialVerification
  member_data?: any
  errors?: string[]
}

export interface EarnError {
  message: string
  code?: string
  timestamp: Date
}

type EarnStore = {
  // Data state
  discordVerifications: SocialVerification[]
  verificationStats: SocialVerificationStats | null
  discordConnectionStatus: DiscordConnectionStatus | null

  // UI state
  isLoading: boolean
  isVerifying: boolean
  isClaiming: boolean
  isCheckingConnection: boolean
  error: EarnError | null

  // Cache state
  lastFetch: Date | null
  cacheExpiry: Date | null

  // Actions
  fetchDiscordVerifications: (forceRefresh?: boolean) => Promise<boolean>
  checkDiscordConnection: () => Promise<boolean>
  verifyDiscordMembership: (guildId: string) => Promise<DiscordVerificationResponse>
  claimDiscordReward: (verificationId: string) => Promise<DiscordVerificationResponse>
  recheckDiscordMembership: (verificationId: string) => Promise<DiscordVerificationResponse>

  // UI actions
  clearError: () => void
  clearCache: () => void

  // Cache management
  isCacheValid: () => boolean
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

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

export const useEarnStore = create<EarnStore>()(
  persist(
    (set, get) => ({
      // Initial state
      discordVerifications: [],
      verificationStats: null,
      discordConnectionStatus: null,

      // UI state
      isLoading: false,
      isVerifying: false,
      isClaiming: false,
      isCheckingConnection: false,
      error: null,

      // Cache state
      lastFetch: null,
      cacheExpiry: null,
      
      // Check if cache is valid
      isCacheValid: () => {
        const { cacheExpiry } = get()
        if (!cacheExpiry) return false
        return new Date() < cacheExpiry
      },
      
      // Fetch Discord verifications
      fetchDiscordVerifications: async (forceRefresh = false) => {
        const state = get()
        
        // Check cache if not forcing refresh
        if (!forceRefresh && state.isCacheValid() && state.discordVerifications.length > 0) {
          return true
        }
        
        set({ isLoading: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/social/discord/verify', {
            method: 'GET',
            headers,
            credentials: 'include'
          })
          
          const result = await response.json()
          
          if (result.success && result.data) {
            const now = new Date()
            set({
              discordVerifications: result.data.verifications || [],
              verificationStats: result.data.stats || null,
              lastFetch: now,
              cacheExpiry: new Date(now.getTime() + CACHE_DURATION),
              error: null
            })
            return true
          } else {
            set({
              error: {
                message: result.message || "Failed to fetch Discord verifications",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error fetching Discord verifications:', error)
          set({
            error: {
              message: "Network error occurred while fetching verifications",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      // Check Discord connection status from database
      checkDiscordConnection: async () => {
        set({ isCheckingConnection: true, error: null })

        try {
          const headers = getAuthHeaders()

          const response = await fetch('/api/auth/discord/status', {
            method: 'GET',
            headers,
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success) {
            set({
              discordConnectionStatus: {
                connected: result.connected,
                discord_user: result.discord_user
              },
              error: null
            })
            return result.connected
          } else {
            set({
              discordConnectionStatus: { connected: false },
              error: {
                message: result.message || "Failed to check Discord connection",
                code: result.error,
                timestamp: new Date()
              }
            })
            return false
          }
        } catch (error) {
          console.error('Error checking Discord connection:', error)
          set({
            discordConnectionStatus: { connected: false },
            error: {
              message: "Network error occurred while checking Discord connection",
              timestamp: new Date()
            }
          })
          return false
        } finally {
          set({ isCheckingConnection: false })
        }
      },

      // Verify Discord server membership
      verifyDiscordMembership: async (guildId: string) => {
        set({ isVerifying: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/social/discord/verify', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              action: 'verify',
              guild_id: guildId
            })
          })
          
          const result: DiscordVerificationResponse = await response.json()
          
          if (result.success) {
            // Refresh verifications after successful verification
            await get().fetchDiscordVerifications(true)
            
            // Update user coins in auth store if verification was successful
            if (result.verification && result.verification.status === 'verified') {
              const authStore = useAuthStore.getState()
              if (authStore.currentUser) {
                authStore.updateUserData({
                  ...authStore.currentUser,
                  coins: authStore.currentUser.coins + result.verification.coins_reward
                })
              }
            }
          } else {
            set({
              error: {
                message: result.message || "Discord verification failed",
                code: result.errors?.[0],
                timestamp: new Date()
              }
            })
          }
          
          return result
        } catch (error) {
          console.error('Error verifying Discord membership:', error)
          const errorResult: DiscordVerificationResponse = {
            success: false,
            message: "Network error occurred during verification",
            errors: ['NETWORK_ERROR']
          }
          
          set({
            error: {
              message: "Network error occurred during verification",
              timestamp: new Date()
            }
          })
          
          return errorResult
        } finally {
          set({ isVerifying: false })
        }
      },
      
      // Claim Discord reward
      claimDiscordReward: async (verificationId: string) => {
        set({ isClaiming: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/social/discord/verify', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              action: 'claim',
              verification_id: verificationId
            })
          })
          
          const result: DiscordVerificationResponse = await response.json()
          
          if (result.success) {
            // Refresh verifications after successful claim
            await get().fetchDiscordVerifications(true)
            
            // Update user coins in auth store
            if (result.verification) {
              const authStore = useAuthStore.getState()
              if (authStore.currentUser) {
                authStore.updateUserData({
                  ...authStore.currentUser,
                  coins: authStore.currentUser.coins + result.verification.coins_reward
                })
              }
            }
          } else {
            set({
              error: {
                message: result.message || "Failed to claim Discord reward",
                code: result.errors?.[0],
                timestamp: new Date()
              }
            })
          }
          
          return result
        } catch (error) {
          console.error('Error claiming Discord reward:', error)
          const errorResult: DiscordVerificationResponse = {
            success: false,
            message: "Network error occurred while claiming reward",
            errors: ['NETWORK_ERROR']
          }
          
          set({
            error: {
              message: "Network error occurred while claiming reward",
              timestamp: new Date()
            }
          })
          
          return errorResult
        } finally {
          set({ isClaiming: false })
        }
      },
      
      // Recheck Discord membership
      recheckDiscordMembership: async (verificationId: string) => {
        set({ isVerifying: true, error: null })
        
        try {
          const headers = getAuthHeaders()
          
          const response = await fetch('/api/social/discord/verify', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              action: 'recheck',
              verification_id: verificationId
            })
          })
          
          const result: DiscordVerificationResponse = await response.json()
          
          if (result.success) {
            // Refresh verifications after recheck
            await get().fetchDiscordVerifications(true)
          } else {
            set({
              error: {
                message: result.message || "Failed to recheck Discord membership",
                code: result.errors?.[0],
                timestamp: new Date()
              }
            })
          }
          
          return result
        } catch (error) {
          console.error('Error rechecking Discord membership:', error)
          const errorResult: DiscordVerificationResponse = {
            success: false,
            message: "Network error occurred during recheck",
            errors: ['NETWORK_ERROR']
          }
          
          set({
            error: {
              message: "Network error occurred during recheck",
              timestamp: new Date()
            }
          })
          
          return errorResult
        } finally {
          set({ isVerifying: false })
        }
      },
      
      // UI actions
      clearError: () => {
        set({ error: null })
      },
      
      clearCache: () => {
        set({
          discordVerifications: [],
          verificationStats: null,
          discordConnectionStatus: null,
          lastFetch: null,
          cacheExpiry: null,
          error: null
        })
      }
    }),
    {
      name: "earn-store",
      // Only persist non-sensitive data
      partialize: (state) => ({
        discordVerifications: state.discordVerifications,
        verificationStats: state.verificationStats,
        lastFetch: state.lastFetch,
        cacheExpiry: state.cacheExpiry
      })
    }
  )
)
