/**
 * CythroDash - Real-time User Data Hook
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/user-store'

/**
 * Hook for managing real-time user data updates
 * Automatically refreshes user data to catch role changes, email updates, etc.
 */
export function useRealTimeUserData() {
  const {
    isAuthenticated,
    currentUser,
    autoRefreshEnabled,
    autoRefreshInterval,
    refreshUserData,
    isRefreshingUserData
  } = useAuthStore()

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    if (isAuthenticated && currentUser) {
      console.log('Forcing user data refresh...')
      await refreshUserData(true)
    }
  }, [isAuthenticated, currentUser, refreshUserData])

  // Set up automatic refresh interval
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Only set up interval if user is authenticated and auto-refresh is enabled
    if (isAuthenticated && currentUser && autoRefreshEnabled && !isRefreshingUserData) {
      console.log(`🔄 Setting up auto-refresh every ${autoRefreshInterval}ms for user: ${currentUser.email}`)
      
      intervalRef.current = setInterval(async () => {
        if (isMountedRef.current && isAuthenticated && currentUser) {
          console.log(`⏰ Auto-refresh triggered for ${currentUser.email} (role: ${currentUser.role})`)
          await refreshUserData(false)
          console.log(`✅ Auto-refresh completed for ${currentUser.email}`)
        }
      }, autoRefreshInterval)
    } else {
      console.log('❌ Auto-refresh not set up:', {
        isAuthenticated,
        hasUser: !!currentUser,
        autoRefreshEnabled,
        isRefreshingUserData
      })
    }

    // Cleanup on dependency changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isAuthenticated, currentUser, autoRefreshEnabled, autoRefreshInterval, refreshUserData, isRefreshingUserData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  // Initial refresh when component mounts (if user is authenticated)
  useEffect(() => {
    if (isAuthenticated && currentUser && !isRefreshingUserData) {
      console.log('Initial user data refresh on mount')
      refreshUserData(false)
    }
  }, []) // Only run on mount

  return {
    isRefreshing: isRefreshingUserData,
    forceRefresh,
    autoRefreshEnabled,
    autoRefreshInterval
  }
}

/**
 * Hook for detecting role changes in real-time
 * Returns a callback when user role changes
 */
export function useRoleChangeDetection(onRoleChange?: (oldRole: number, newRole: number) => void) {
  const { currentUser } = useAuthStore()
  const previousRoleRef = useRef<number | null>(null)

  useEffect(() => {
    if (currentUser && currentUser.role !== undefined) {
      const currentRole = currentUser.role
      
      // Check if role has changed
      if (previousRoleRef.current !== null && previousRoleRef.current !== currentRole) {
        console.log(`Role changed: ${previousRoleRef.current} -> ${currentRole}`)
        onRoleChange?.(previousRoleRef.current, currentRole)
      }
      
      previousRoleRef.current = currentRole
    }
  }, [currentUser?.role, onRoleChange])

  return {
    currentRole: currentUser?.role,
    previousRole: previousRoleRef.current
  }
}

/**
 * Hook specifically for admin role monitoring
 * Automatically handles role changes for admin components
 */
export function useAdminRoleMonitoring() {
  const { currentUser } = useAuthStore()
  const previousAdminStatusRef = useRef<boolean | null>(null)

  // Set up real-time updates
  useRealTimeUserData()

  // Monitor admin status changes
  useRoleChangeDetection((oldRole, newRole) => {
    const wasAdmin = oldRole === 0
    const isNowAdmin = newRole === 0

    if (wasAdmin && !isNowAdmin) {
      console.log('User lost admin privileges')
      // Optionally redirect or show notification
      window.location.href = '/'
    } else if (!wasAdmin && isNowAdmin) {
      console.log('User gained admin privileges')
      // Optionally refresh the page or update UI
      window.location.reload()
    }
  })

  const isAdmin = currentUser?.role === 0
  const wasAdmin = previousAdminStatusRef.current

  useEffect(() => {
    if (isAdmin !== wasAdmin && wasAdmin !== null) {
      console.log(`Admin status changed: ${wasAdmin} -> ${isAdmin}`)
    }
    previousAdminStatusRef.current = isAdmin
  }, [isAdmin, wasAdmin])

  return {
    isAdmin,
    wasAdmin: previousAdminStatusRef.current,
    currentUser
  }
}
