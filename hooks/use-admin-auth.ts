/**
 * CythroDash - Admin Authentication Hook
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/user-store'
import { useAdminRoleMonitoring, useRealTimeUserData } from '@/hooks/use-realtime-user'

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

export interface UseAdminAuthResult {
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  currentUser: any | null
  hasAccess: boolean
  isRefreshing: boolean
  forceRefresh: () => Promise<void>
}

/**
 * Hook for protecting admin routes and components with real-time updates
 * Automatically redirects non-admin users to appropriate pages
 */
export function useAdminAuth(redirectOnFailure: boolean = true): UseAdminAuthResult {
  const router = useRouter()
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const {
    isAuthenticated,
    currentUser,
    isLoading,
    refreshSession,
    checkSession
  } = useAuthStore()

  // Set up real-time monitoring
  const { isRefreshing, forceRefresh } = useRealTimeUserData()
  const { isAdmin } = useAdminRoleMonitoring()

  const hasAccess = isAuthenticated && isAdmin

  useEffect(() => {
    let mounted = true

    const validateAdminSession = async () => {
      try {
        // First check if we have a valid session in store
        if (isAuthenticated && currentUser) {
          if (isDev) console.log('Session valid, checking admin privileges...')
          setIsInitialLoading(false)

          // Check admin privileges (now handled by useAdminRoleMonitoring)
          if (redirectOnFailure && !isAdmin) {
            if (isDev) console.log('User is not admin, redirecting...')
            router.push('/')
          }
          return
        }

        // If not authenticated, try to refresh/check session
        if (isDev) console.log('Checking authentication session for admin access...')
        const sessionValid = await checkSession()

        if (!mounted) return

        if (!sessionValid) {
          if (isDev) console.log('Session invalid, redirecting to login...')
          setIsInitialLoading(false)

          if (redirectOnFailure) {
            router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname))
          }
          return
        }

        // If we get here, session is valid but we need to refresh user data
        await refreshSession()
        setIsInitialLoading(false)

      } catch (error) {
        console.error('Admin session validation error:', error)
        setIsInitialLoading(false)

        if (mounted && redirectOnFailure) {
          router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname))
        }
      }
    }

    validateAdminSession()

    return () => {
      mounted = false
    }
  }, [isAuthenticated, currentUser, isAdmin, checkSession, refreshSession, router, redirectOnFailure])

  return {
    isLoading: isLoading || isInitialLoading,
    isAuthenticated,
    isAdmin,
    currentUser,
    hasAccess,
    isRefreshing,
    forceRefresh
  }
}

/**
 * Hook for checking admin status without redirects with real-time updates
 * Useful for conditional rendering
 */
export function useAdminCheck(): UseAdminAuthResult {
  return useAdminAuth(false)
}

/**
 * Hook specifically for admin route protection with redirects and real-time updates
 * Use this in admin page components
 */
export function useAdminGuard(): UseAdminAuthResult {
  return useAdminAuth(true)
}
