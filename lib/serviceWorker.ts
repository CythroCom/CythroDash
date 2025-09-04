"use client"

// Service Worker registration and management utilities

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onError?: (error: Error) => void
}

// Register service worker
export const registerServiceWorker = async (config: ServiceWorkerConfig = {}) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service Worker not supported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })

    console.log('Service Worker registered:', registration)

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content available
            console.log('New content available, please refresh')
            config.onUpdate?.(registration)
          } else {
            // Content cached for first time
            console.log('Content cached for offline use')
            config.onSuccess?.(registration)
          }
        }
      })
    })

    // Handle controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed')
      window.location.reload()
    })

    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    config.onError?.(error as Error)
  }
}

// Unregister service worker
export const unregisterServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.unregister()
    console.log('Service Worker unregistered')
  } catch (error) {
    console.error('Service Worker unregistration failed:', error)
  }
}

// Update service worker
export const updateServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
    console.log('Service Worker update triggered')
  } catch (error) {
    console.error('Service Worker update failed:', error)
  }
}

// Skip waiting and activate new service worker
export const skipWaiting = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }
}

// Cache specific URLs
export const cacheUrls = async (urls: string[]) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  if (registration.active) {
    registration.active.postMessage({
      type: 'CACHE_URLS',
      urls
    })
  }
}

// Check if app is running in standalone mode (PWA)
export const isStandalone = () => {
  if (typeof window === 'undefined') return false
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://')
  )
}

// Check if app can be installed (PWA)
export const canInstall = () => {
  if (typeof window === 'undefined') return false
  
  return 'beforeinstallprompt' in window
}

// PWA install prompt handling
let deferredPrompt: any = null

export const setupInstallPrompt = () => {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA install prompt available')
    e.preventDefault()
    deferredPrompt = e
  })

  window.addEventListener('appinstalled', () => {
    console.log('PWA installed')
    deferredPrompt = null
  })
}

export const showInstallPrompt = async () => {
  if (!deferredPrompt) {
    console.log('No install prompt available')
    return false
  }

  try {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('Install prompt outcome:', outcome)
    deferredPrompt = null
    return outcome === 'accepted'
  } catch (error) {
    console.error('Install prompt failed:', error)
    return false
  }
}

// Network status monitoring
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState<boolean>(typeof window !== 'undefined' ? navigator.onLine : true)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    isOffline: !isOnline
  }
}

// Background sync for offline actions
export const queueAction = async (action: {
  id: string
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}) => {
  if (typeof window === 'undefined') return

  try {
    // Store action in IndexedDB or localStorage
    const actions = JSON.parse(localStorage.getItem('pendingActions') || '[]')
    actions.push(action)
    localStorage.setItem('pendingActions', JSON.stringify(actions))

    // Register for background sync if supported
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready
      await (registration as any).sync.register('server-actions')
    }
  } catch (error) {
    console.error('Failed to queue action:', error)
  }
}

// Performance monitoring
export const getPerformanceMetrics = () => {
  if (typeof window === 'undefined' || !('performance' in window)) {
    return null
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  const paint = performance.getEntriesByType('paint')

  return {
    // Core Web Vitals
    firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime,
    largestContentfulPaint: null, // Would need to be measured separately
    cumulativeLayoutShift: null, // Would need to be measured separately
    firstInputDelay: null, // Would need to be measured separately

    // Navigation timing
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,

    // Resource timing
    transferSize: navigation.transferSize,
    encodedBodySize: navigation.encodedBodySize,
    decodedBodySize: navigation.decodedBodySize,

    // Connection info
    connectionType: (navigator as any).connection?.effectiveType,
    downlink: (navigator as any).connection?.downlink,
    rtt: (navigator as any).connection?.rtt
  }
}

// Cache management
export const getCacheSize = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return 0
  }

  try {
    const cacheNames = await caches.keys()
    let totalSize = 0

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName)
      const requests = await cache.keys()
      
      for (const request of requests) {
        const response = await cache.match(request)
        if (response) {
          const blob = await response.blob()
          totalSize += blob.size
        }
      }
    }

    return totalSize
  } catch (error) {
    console.error('Failed to calculate cache size:', error)
    return 0
  }
}

export const clearCache = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return
  }

  try {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
    console.log('All caches cleared')
  } catch (error) {
    console.error('Failed to clear cache:', error)
  }
}

// React hook for service worker
import React from 'react'

export const useServiceWorker = (config: ServiceWorkerConfig = {}) => {
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = React.useState(false)
  const [isInstallable, setIsInstallable] = React.useState(false)

  React.useEffect(() => {
    registerServiceWorker({
      ...config,
      onUpdate: (reg) => {
        setUpdateAvailable(true)
        config.onUpdate?.(reg)
      },
      onSuccess: (reg) => {
        setRegistration(reg)
        config.onSuccess?.(reg)
      }
    })

    setupInstallPrompt()
    setIsInstallable(canInstall())
  }, [])

  return {
    registration,
    updateAvailable,
    isInstallable,
    isStandalone: isStandalone(),
    skipWaiting,
    showInstallPrompt,
    updateServiceWorker
  }
}
