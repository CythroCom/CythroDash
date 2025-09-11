"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Icon from "@/components/IconProvider"
import { useAuthStore } from "@/stores/user-store"
import { showSuccess, showError } from "@/lib/toast"

type ProcessingState = 'processing' | 'success' | 'error'

export default function AuthProcessingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkSession } = useAuthStore()
  
  const [state, setState] = useState<ProcessingState>('processing')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const processAuth = async () => {
      try {
        // New behavior: server-side OAuth callbacks already set cookies and redirected here.
        // We just need to confirm a session exists (via /api/user/me) and hydrate the store.
        const provider = searchParams.get('provider') || 'discord'
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          console.error('OAuth error:', error, errorDescription)
          setState('error')
          setMessage(errorDescription || `Authentication failed: ${error}`)
          showError('Authentication Failed', errorDescription || error)
          return
        }

        const res = await fetch('/api/user/me', { method: 'GET', credentials: 'include' })
        const json = await res.json()
        if (res.ok && json?.success && json.user) {
          // Hydrate auth store with a sentinel token (cookies are httpOnly)
          useAuthStore.getState().setSession(json.user, 'cookie')

          setState('success')
          setMessage(`Successfully authenticated with ${provider}`)
          showSuccess('Authentication Successful', `Welcome! You've been logged in with ${provider}.`)

          let timeLeft = 3
          const countdownInterval = setInterval(() => {
            timeLeft -= 1
            setCountdown(timeLeft)
            if (timeLeft <= 0) {
              clearInterval(countdownInterval)
              router.push('/')
            }
          }, 1000)
          return () => clearInterval(countdownInterval)
        }

        // If server didn't set cookies or user not found, show generic auth failure
        setState('error')
        setMessage('Authentication could not be completed. Please try again.')
        showError('Authentication Failed', 'Could not establish a session')
      } catch (error) {
        console.error('Auth processing error:', error)
        setState('error')
        setMessage('An unexpected error occurred during authentication')
        showError('Authentication Error', 'An unexpected error occurred')
      }
    }

    processAuth()
  }, [searchParams, router])

  const handleReturnToLogin = () => {
    router.push('/login')
  }

  const handleGoToDashboard = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-neutral-800 border-neutral-700">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold text-white">
            {state === 'processing' && 'Processing Authentication...'}
            {state === 'success' && 'Authentication Successful!'}
            {state === 'error' && 'Authentication Failed'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {state === 'processing' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Icon name="Loader" className="h-8 w-8 animate-spin text-blue-500" />
              </div>
              <p className="text-neutral-300">
                Please wait while we complete your authentication...
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Icon name="CheckCircle" className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-green-400 font-medium">Welcome to CythroDash!</p>
                <p className="text-neutral-300 text-sm">{message}</p>
                <p className="text-neutral-400 text-xs">
                  Redirecting to dashboard in {countdown} seconds...
                </p>
              </div>
              <Button
                onClick={handleGoToDashboard}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Go to Dashboard Now
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center">
                  <Icon name="AlertCircle" className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-red-400 font-medium">Authentication Failed</p>
                <Alert className="bg-red-500/10 border-red-500/20">
                  <AlertDescription className="text-red-300 text-sm">
                    {message}
                  </AlertDescription>
                </Alert>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={handleReturnToLogin}
                  className="w-full bg-neutral-700 hover:bg-neutral-600 text-white"
                >
                  <Icon name="ArrowLeft" className="h-4 w-4 mr-2" />
                  Return to Login
                </Button>
                <Button
                  onClick={handleGoToDashboard}
                  variant="outline"
                  className="w-full border-neutral-600 text-neutral-300 hover:bg-neutral-700"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
