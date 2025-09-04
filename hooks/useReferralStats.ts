"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/user-store'

interface ReferralStats {
  user_id: number
  total_clicks: number
  unique_clicks: number
  clicks_today: number
  clicks_this_week: number
  clicks_this_month: number
  total_signups: number
  signups_today: number
  signups_this_week: number
  signups_this_month: number
  click_to_signup_rate: number
  total_earnings: number
  pending_earnings: number
  claimed_earnings: number
  earnings_today: number
  earnings_this_week: number
  earnings_this_month: number
  current_tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  tier_progress: number
  tier_bonus_percentage: number
  suspicious_clicks: number
  blocked_clicks: number
  fraud_score: number
  last_updated: string
  created_at: string
}

interface Referral {
  id: string
  username: string
  email: string
  joinedAt: string
  status: 'completed' | 'pending'
  reward: number
}

interface UseReferralStatsReturn {
  stats: ReferralStats | null
  referrals: Referral[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  claimRewards: () => Promise<{
    success: boolean;
    message?: string;
    data?: {
      total_claimed: number;
      clicks_claimed: number;
      signups_claimed: number;
      new_balance: number;
    }
  }>
  isClaimingRewards: boolean
}

export function useReferralStats(): UseReferralStatsReturn {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [isLoading, setIsLoading] = useState(false) // Start with false for instant load
  const [error, setError] = useState<string | null>(null)
  const [isClaimingRewards, setIsClaimingRewards] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const { isAuthenticated, currentUser, updateUserData } = useAuthStore()

  // Cache duration: 30 seconds
  const CACHE_DURATION = 30 * 1000

  // Function to ensure user has a referral code
  const ensureReferralCode = useCallback(async () => {
    if (!currentUser || currentUser.referral_code) {
      return // User already has a referral code
    }

    try {
      // Call API to generate and persist referral code
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add user data to headers for authentication
      headers['x-user-data'] = encodeURIComponent(JSON.stringify({
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role
      }))

      const response = await fetch('/api/user/referral-code', {
        method: 'POST',
        credentials: 'include',
        headers
      })

      const result = await response.json()

      if (result.success && result.data?.referral_code) {
        // Update user in store with the generated referral code
        updateUserData({
          referral_code: result.data.referral_code
        })

        console.log('Generated and persisted referral code:', result.data.referral_code)
      } else {
        console.error('Failed to generate referral code:', result.message)
      }
    } catch (error) {
      console.error('Error generating referral code:', error)
    }
  }, [currentUser, updateUserData])

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    // Check cache - don't refetch if data is fresh
    const now = Date.now()
    if (hasFetched && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('Using cached referral data')
      return
    }

    // Prevent multiple simultaneous requests
    if (isLoading && hasFetched) {
      return
    }

    try {
      setError(null)
      // Don't set loading to true - keep UI responsive

      // Get current user from store
      const { currentUser } = useAuthStore.getState()

      if (!currentUser) {
        setError('User not found in store')
        return
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add user data to headers for authentication
      headers['x-user-data'] = encodeURIComponent(JSON.stringify({
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role
      }))

      // Fetch both stats and users in parallel for faster loading
      const [statsResponse, usersResponse] = await Promise.all([
        fetch('/api/referrals/stats', {
          method: 'GET',
          credentials: 'include',
          headers
        }),
        fetch('/api/referrals/users', {
          method: 'GET',
          credentials: 'include',
          headers
        })
      ])

      const [statsResult, usersResult] = await Promise.all([
        statsResponse.json(),
        usersResponse.json()
      ])

      // Process stats
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
        console.log('Referral stats fetched:', statsResult.data)
      } else {
        setError(statsResult.message || 'Failed to fetch referral statistics')
      }

      // Process users
      if (usersResult.success && usersResult.data) {
        setReferrals(usersResult.data.users || [])
        console.log('Set referrals:', usersResult.data.users || [])
      } else {
        console.warn('Failed to fetch referred users:', usersResult.message)
        setReferrals([]) // Set empty array if no users found
      }

      setHasFetched(true)
      setLastFetchTime(Date.now())
    } catch (err) {
      console.error('Error fetching referral stats:', err)
      setError('Network error occurred while fetching statistics')
    }
    // No finally block - keep UI responsive
  }, [isAuthenticated, hasFetched, isLoading, lastFetchTime, CACHE_DURATION])

  const claimRewards = useCallback(async () => {
    if (!isAuthenticated || isClaimingRewards) {
      return { success: false, message: 'Not authenticated or already claiming' }
    }

    setIsClaimingRewards(true)
    try {
      // Get current user from store
      const { currentUser } = useAuthStore.getState()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add user data to headers for authentication
      if (currentUser) {
        headers['x-user-data'] = encodeURIComponent(JSON.stringify({
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
          role: currentUser.role
        }))
      }

      const response = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          claim_type: 'all'
        })
      })

      const result = await response.json()

      if (result.success) {
        // Update user's coin balance in the store immediately
        if (result.data?.new_balance !== undefined) {
          updateUserData({
            coins: result.data.new_balance
          })
        }

        // Refresh stats after claiming
        await fetchStats()
        return {
          success: true,
          message: result.message,
          data: result.data
        }
      } else {
        return { success: false, message: result.message || 'Failed to claim rewards' }
      }
    } catch (err) {
      console.error('Error claiming rewards:', err)
      return { success: false, message: 'Network error occurred while claiming rewards' }
    } finally {
      setIsClaimingRewards(false)
    }
  }, [isAuthenticated, isClaimingRewards])

  // Ensure user has referral code when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      ensureReferralCode()
    }
  }, [isAuthenticated, currentUser, ensureReferralCode])

  // Fetch stats when authenticated and haven't fetched yet
  useEffect(() => {
    if (isAuthenticated && !hasFetched) {
      fetchStats()
    }
  }, [isAuthenticated, hasFetched, fetchStats])

  // Force refetch function that bypasses cache
  const forceRefetch = useCallback(async () => {
    setLastFetchTime(0) // Reset cache
    setHasFetched(false)
    await fetchStats()
  }, [fetchStats])

  return {
    stats,
    referrals,
    isLoading,
    error,
    refetch: forceRefetch,
    claimRewards,
    isClaimingRewards
  }
}
