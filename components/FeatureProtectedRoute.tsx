/**
 * Feature Protected Route Component
 * Protects entire routes based on feature flags
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { useFeatureFlag, type FeatureFlag } from '@/hooks/use-feature-flags'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Icon from '@/components/IconProvider'

interface FeatureProtectedRouteProps {
  feature: FeatureFlag
  children: React.ReactNode
  fallbackTitle?: string
  fallbackDescription?: string
  redirectTo?: string
  showSkeleton?: boolean
}

export function FeatureProtectedRoute({
  feature,
  children,
  fallbackTitle = 'Feature Unavailable',
  fallbackDescription = 'This feature is currently disabled.',
  redirectTo = '/',
  showSkeleton = true
}: FeatureProtectedRouteProps) {
  const router = useRouter()
  const { enabled, loading } = useFeatureFlag(feature)

  if (loading && showSkeleton) {
    return (
      <div className="min-h-screen bg-neutral-900 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64 bg-neutral-800" />
          <Skeleton className="h-6 w-96 bg-neutral-800" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full bg-neutral-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-neutral-800 border-neutral-700">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Lock" className="h-8 w-8 text-neutral-400" />
            </div>
            <CardTitle className="text-white">{fallbackTitle}</CardTitle>
            <CardDescription className="text-neutral-400">
              {fallbackDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => router.push(redirectTo)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

// Convenience components for common routes
export function ServerCreationProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <FeatureProtectedRoute
      feature="NEXT_PUBLIC_SERVER_CREATION"
      fallbackTitle="Server Creation Disabled"
      fallbackDescription="Server creation is currently disabled by the administrator."
      redirectTo="/"
    >
      {children}
    </FeatureProtectedRoute>
  )
}

export function ReferralProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <FeatureProtectedRoute
      feature="NEXT_PUBLIC_REFERRAL_PROGRAM"
      fallbackTitle="Referral Program Disabled"
      fallbackDescription="The referral program is currently disabled."
      redirectTo="/"
    >
      {children}
    </FeatureProtectedRoute>
  )
}

export function RedeemCodesProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <FeatureProtectedRoute
      feature="NEXT_PUBLIC_REDEEM_CODES"
      fallbackTitle="Redeem Codes Disabled"
      fallbackDescription="Redeem codes are currently disabled."
      redirectTo="/"
    >
      {children}
    </FeatureProtectedRoute>
  )
}

export function TransfersProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <FeatureProtectedRoute
      feature="NEXT_PUBLIC_TRANSFERS"
      fallbackTitle="Transfers Disabled"
      fallbackDescription="Coin transfers are currently disabled."
      redirectTo="/"
    >
      {children}
    </FeatureProtectedRoute>
  )
}

// Multi-feature protection (requires all features to be enabled)
interface MultiFeatureProtectedRouteProps {
  features: FeatureFlag[]
  mode?: 'all' | 'any'
  children: React.ReactNode
  fallbackTitle?: string
  fallbackDescription?: string
  redirectTo?: string
}

export function MultiFeatureProtectedRoute({
  features,
  mode = 'all',
  children,
  fallbackTitle = 'Features Unavailable',
  fallbackDescription = 'Required features are currently disabled.',
  redirectTo = '/'
}: MultiFeatureProtectedRouteProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    let mounted = true

    const checkFeatures = async () => {
      try {
        // Ensure we're in a browser environment
        if (typeof window === 'undefined') {
          if (mounted) {
            setEnabled(false)
            setLoading(false)
          }
          return
        }

        const { usePublicSettingsStore } = await import('@/stores/public-settings-store')
        const store = usePublicSettingsStore.getState()

        if (!store.loaded) {
          await store.load()
        }

        if (!mounted) return

        const results = features.map(feature => Boolean(store.get(feature, false)))

        const isEnabled = mode === 'all'
          ? results.every(Boolean)
          : results.some(Boolean)

        setEnabled(isEnabled)
        setLoading(false)
      } catch (error) {
        if (mounted) {
          setEnabled(false)
          setLoading(false)
        }
      }
    }

    checkFeatures()

    return () => {
      mounted = false
    }
  }, [features, mode])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64 bg-neutral-800" />
          <Skeleton className="h-6 w-96 bg-neutral-800" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full bg-neutral-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-neutral-800 border-neutral-700">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Lock" className="h-8 w-8 text-neutral-400" />
            </div>
            <CardTitle className="text-white">{fallbackTitle}</CardTitle>
            <CardDescription className="text-neutral-400">
              {fallbackDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => router.push(redirectTo)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
