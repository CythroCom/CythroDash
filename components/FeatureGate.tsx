/**
 * Feature Gate Component
 * Conditionally renders children based on feature flags
 */

import React from 'react'
import { useFeatureFlag, type FeatureFlag } from '@/hooks/use-feature-flags'
import { Skeleton } from '@/components/ui/skeleton'

interface FeatureGateProps {
  feature: FeatureFlag
  children: React.ReactNode
  fallback?: React.ReactNode
  loadingFallback?: React.ReactNode
  showSkeleton?: boolean
  skeletonHeight?: number
}

export function FeatureGate({
  feature,
  children,
  fallback = null,
  loadingFallback,
  showSkeleton = false,
  skeletonHeight = 40
}: FeatureGateProps) {
  const { enabled, loading } = useFeatureFlag(feature)

  if (loading) {
    if (loadingFallback) {
      return <>{loadingFallback}</>
    }
    if (showSkeleton) {
      return <Skeleton className={`h-${skeletonHeight} w-full bg-neutral-800`} />
    }
    return null
  }

  if (!enabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface MultiFeatureGateProps {
  features: FeatureFlag[]
  mode?: 'all' | 'any' // 'all' = all features must be enabled, 'any' = at least one must be enabled
  children: React.ReactNode
  fallback?: React.ReactNode
  loadingFallback?: React.ReactNode
}

export function MultiFeatureGate({
  features,
  mode = 'all',
  children,
  fallback = null,
  loadingFallback
}: MultiFeatureGateProps) {
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
    return loadingFallback ? <>{loadingFallback}</> : null
  }

  if (!enabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// Convenience components for common patterns
export function ServerCreationGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_SERVER_CREATION" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}

export function ReferralProgramGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_REFERRAL_PROGRAM" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}

export function RedeemCodesGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_REDEEM_CODES" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}

export function TransfersGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_TRANSFERS" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}

export function MaintenanceModeGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_MAINTENANCE_MODE" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}

export function AccountCreationGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_ACCOUNT_CREATION" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}

export function OAuthGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGate feature="NEXT_PUBLIC_OAUTH_ENABLED" fallback={fallback}>
      {children}
    </FeatureGate>
  )
}
