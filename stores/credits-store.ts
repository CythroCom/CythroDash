"use client"

import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

interface CreditsStore {
  // State
  credits: number
  isLoading: boolean
  error: string | null
  lastFetch: number
  
  // Actions
  fetchCredits: () => Promise<void>
  updateCredits: (newCredits: number) => void
  addCredits: (amount: number) => void
  subtractCredits: (amount: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Real-time polling
  startPolling: () => void
  stopPolling: () => void
  isPolling: boolean
}

let pollingInterval: NodeJS.Timeout | null = null

export const useCreditsStore = create<CreditsStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    credits: 0,
    isLoading: false,
    error: null,
    lastFetch: 0,
    isPolling: false,

    // Fetch credits from API
    fetchCredits: async () => {
      const now = Date.now()
      const { lastFetch, isLoading } = get()

      // Prevent duplicate requests within 5 seconds
      if (isLoading || (now - lastFetch < 5000)) {
        return
      }

      set({ isLoading: true, error: null })

      try {
        // Get current user from auth store for headers
        const { useAuthStore } = await import('@/stores/user-store')
        const currentUser = useAuthStore.getState().currentUser

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }

        // Add user data to headers for authentication (matching other API calls)
        if (currentUser) {
          headers['x-user-data'] = encodeURIComponent(JSON.stringify({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role
          }))
        }

        const response = await fetch('/api/user/me', {
          method: 'GET',
          credentials: 'include',
          headers,
        })

        const data = await response.json()

        if (data.success && data.user) {
          set({
            credits: data.user.coins || 0,
            lastFetch: now,
            error: null
          })
        } else {
          // Don't set error if we have credits from user store
          const currentCredits = get().credits
          if (currentCredits === 0) {
            set({ error: data.message || 'Failed to fetch credits' })
          }
        }
      } catch (error) {
        console.error('Credits fetch error:', error)
        // Don't set error if we have credits from user store
        const currentCredits = get().credits
        if (currentCredits === 0) {
          set({ error: 'Network error while fetching credits' })
        }
      } finally {
        set({ isLoading: false })
      }
    },

    // Update credits directly (for real-time updates)
    updateCredits: (newCredits: number) => {
      set({ credits: Math.max(0, newCredits), error: null })
    },

    // Add credits (for positive transactions)
    addCredits: (amount: number) => {
      set((state) => ({ 
        credits: Math.max(0, state.credits + amount),
        error: null 
      }))
    },

    // Subtract credits (for purchases)
    subtractCredits: (amount: number) => {
      set((state) => ({ 
        credits: Math.max(0, state.credits - amount),
        error: null 
      }))
    },

    // Set loading state
    setLoading: (loading: boolean) => {
      set({ isLoading: loading })
    },

    // Set error state
    setError: (error: string | null) => {
      set({ error })
    },

    // Start real-time polling
    startPolling: () => {
      const { isPolling, fetchCredits } = get()
      
      if (isPolling) return

      set({ isPolling: true })
      
      // Initial fetch
      fetchCredits()
      
      // Poll every 30 seconds
      pollingInterval = setInterval(() => {
        fetchCredits()
      }, 30000)
    },

    // Stop polling
    stopPolling: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
      set({ isPolling: false })
    },
  }))
)

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useCreditsStore.getState().stopPolling()
  })
}

// Subscribe to user store changes to sync credits
if (typeof window !== 'undefined') {
  import('@/stores/user-store').then(({ useAuthStore }) => {
    useAuthStore.subscribe((state, prev) => {
      const coins: number | undefined = state.currentUser?.coins
      const prevCoins: number | undefined = prev?.currentUser?.coins
      if (typeof coins === 'number' && coins !== prevCoins) {
        useCreditsStore.getState().updateCredits(coins)
      }
    })
  })
}
