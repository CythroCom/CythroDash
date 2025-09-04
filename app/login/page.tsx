"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/user-store"
import LoginForm from "@/components/Auth/Login/LoginForm"
import { usePerformanceMonitor, useMemoryMonitor } from "@/hooks/usePerformance"
import { preloadCriticalComponents } from "@/components/LazyComponents"
import PerformanceMonitor from "@/components/PerformanceMonitor"

export default function LoginPage() {
  const router = useRouter()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const { isAuthenticated, checkSession } = useAuthStore()

  // Performance monitoring
  usePerformanceMonitor("LoginPage")
  useMemoryMonitor("LoginPage")

  // Preload components for better UX
  useEffect(() => {
    preloadCriticalComponents()
  }, [])

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

  // Handle successful login
  const handleLoginSuccess = useCallback(() => {
    router.push("/")
  }, [router])

  // Handle register redirect
  const handleRegisterClick = useCallback(() => {
    router.push("/register")
  }, [router])

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
        <LoginForm
          onSuccess={handleLoginSuccess}
          onRegisterClick={handleRegisterClick}
        />
      </div>

      <PerformanceMonitor />
    </div>
  )
}
