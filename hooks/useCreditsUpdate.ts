"use client"

import { useCallback } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { useAuthStore } from '@/stores/user-store'

/**
 * Hook for triggering real-time credit updates from any component
 * Use this after actions that change user credits (purchases, rewards, etc.)
 */
export const useCreditsUpdate = () => {
  const { addCredits, subtractCredits, updateCredits, fetchCredits } = useCreditsStore()
  const { updateUserData } = useAuthStore()

  // Add credits and update both stores
  const addCreditsWithSync = useCallback(async (amount: number, reason?: string) => {
    try {
      // Optimistically update credits display
      addCredits(amount)
      
      // Update user store as well
      const currentUser = useAuthStore.getState().currentUser
      if (currentUser) {
        updateUserData({
          coins: currentUser.coins + amount
        })
      }
      
      // Fetch fresh data from server to ensure accuracy
      await fetchCredits()
      
      console.log(`Credits added: +${amount}${reason ? ` (${reason})` : ''}`)
    } catch (error) {
      console.error('Failed to add credits:', error)
      // Revert optimistic update on error
      subtractCredits(amount)
    }
  }, [addCredits, subtractCredits, fetchCredits, updateUserData])

  // Subtract credits and update both stores
  const subtractCreditsWithSync = useCallback(async (amount: number, reason?: string) => {
    try {
      // Optimistically update credits display
      subtractCredits(amount)
      
      // Update user store as well
      const currentUser = useAuthStore.getState().currentUser
      if (currentUser) {
        updateUserData({
          coins: Math.max(0, currentUser.coins - amount)
        })
      }
      
      // Fetch fresh data from server to ensure accuracy
      await fetchCredits()
      
      console.log(`Credits subtracted: -${amount}${reason ? ` (${reason})` : ''}`)
    } catch (error) {
      console.error('Failed to subtract credits:', error)
      // Revert optimistic update on error
      addCredits(amount)
    }
  }, [addCredits, subtractCredits, fetchCredits, updateUserData])

  // Set exact credit amount and sync stores
  const setCreditsWithSync = useCallback(async (amount: number, reason?: string) => {
    try {
      // Update credits display
      updateCredits(amount)
      
      // Update user store as well
      updateUserData({
        coins: amount
      })
      
      console.log(`Credits set to: ${amount}${reason ? ` (${reason})` : ''}`)
    } catch (error) {
      console.error('Failed to set credits:', error)
      // Fetch fresh data on error
      await fetchCredits()
    }
  }, [updateCredits, updateUserData, fetchCredits])

  // Force refresh credits from server
  const refreshCredits = useCallback(async () => {
    try {
      await fetchCredits()
      console.log('Credits refreshed from server')
    } catch (error) {
      console.error('Failed to refresh credits:', error)
    }
  }, [fetchCredits])

  return {
    addCredits: addCreditsWithSync,
    subtractCredits: subtractCreditsWithSync,
    setCredits: setCreditsWithSync,
    refreshCredits
  }
}

/**
 * Hook for components that need to trigger credit updates after API calls
 * This is useful for components that make API calls that change user credits
 */
export const useCreditsSync = () => {
  const { fetchCredits } = useCreditsStore()
  
  // Call this after any API call that changes user credits
  const syncCreditsAfterApiCall = useCallback(async (apiResponse?: any) => {
    try {
      // If the API response includes the new balance, use it immediately
      if (apiResponse?.user?.coins !== undefined) {
        useCreditsStore.getState().updateCredits(apiResponse.user.coins)
        useAuthStore.getState().updateUserData({ coins: apiResponse.user.coins })
      } else if (apiResponse?.data?.new_balance !== undefined) {
        useCreditsStore.getState().updateCredits(apiResponse.data.new_balance)
        useAuthStore.getState().updateUserData({ coins: apiResponse.data.new_balance })
      } else {
        // Otherwise fetch fresh data
        await fetchCredits()
      }
    } catch (error) {
      console.error('Failed to sync credits after API call:', error)
    }
  }, [fetchCredits])

  return {
    syncCreditsAfterApiCall
  }
}

export default useCreditsUpdate
