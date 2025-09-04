"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { showSuccess } from "@/lib/toast"
import { useAuthStore } from "@/stores/user-store"
import RegisterForm from "@/components/Auth/Register/RegisterForm"
import { usePerformanceMonitor, useMemoryMonitor } from "@/hooks/usePerformance"
import { preloadCriticalComponents } from "@/components/LazyComponents"
import PerformanceMonitor from "@/components/PerformanceMonitor"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [referralCode, setReferralCode] = useState<string | undefined>(undefined)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const { isAuthenticated, checkSession } = useAuthStore()

  // Performance monitoring
  usePerformanceMonitor("RegisterPage")
  useMemoryMonitor("RegisterPage")

  // Preload components for better UX
  useEffect(() => {
    preloadCriticalComponents()
  }, [])

  // Parse ?ref= and fire referral click on load (matching backup implementation)
  useEffect(() => {
    try {
      const ref = searchParams.get('ref')
      if (!ref) return

      const code = ref.toUpperCase().trim()
      setReferralCode(code)

      // Show success message to user
      showSuccess(`Referral code "${code}" applied! Complete registration to earn rewards for your referrer.`)

      // Fire click tracking (non-blocking) - matching backup device_info structure
      const device_info = {
        screen_resolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
        platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
        device_type: typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop' as const,
      }

      fetch('/api/referrals/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referral_code: code, device_info })
      }).catch(() => {})
    } catch {}
  }, [searchParams])

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const isValid = await checkSession()
        if (isValid && isAuthenticated) {
          router.replace("/")
          return
        }
      } catch (error) {
        console.error("Auth check error:", error)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuthStatus()
  }, [checkSession, isAuthenticated, router])

  // Handle successful registration
  const handleRegisterSuccess = useCallback(() => {
    router.push("/login")
  }, [router])

  // Handle login redirect
  const handleLoginClick = useCallback(() => {
    router.push("/login")
  }, [router])

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-neutral-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/40 via-neutral-900 to-black" />

      <div className="relative z-10 w-full max-w-md">
        <RegisterForm
          onSuccess={handleRegisterSuccess}
          onLoginClick={handleLoginClick}
          defaultReferralCode={referralCode}
        />
      </div>

      <PerformanceMonitor />
    </div>
  )
}
