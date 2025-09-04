"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useAnimationFPS, useReducedMotion } from "@/hooks/useAnimations"
import { usePerformanceMonitor, useFPSMonitor } from "@/hooks/usePerformance"
import { getPerformanceMetrics, getCacheSize } from "@/lib/serviceWorker"

interface PerformanceMonitorProps {
  enabled?: boolean
  showOverlay?: boolean
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  enabled = process.env.NODE_ENV === 'development',
  showOverlay = false 
}) => {
  const [isVisible, setIsVisible] = useState(showOverlay)
  const [metrics, setMetrics] = useState<any>(null)
  const [cacheSize, setCacheSize] = useState<number>(0)
  const [performanceScore, setPerformanceScore] = useState<number>(0)

  // Performance monitoring hooks
  usePerformanceMonitor("PerformanceMonitor")
  const fps = useFPSMonitor()
  const prefersReducedMotion = useReducedMotion()

  // Collect performance metrics
  const collectMetrics = useCallback(async () => {
    if (!enabled) return

    try {
      const performanceData = getPerformanceMetrics()
      const cacheSizeData = await getCacheSize()
      
      setMetrics(performanceData)
      setCacheSize(cacheSizeData)

      // Calculate performance score (0-100)
      let score = 100
      
      if (performanceData) {
        // Penalize slow load times
        if (performanceData.totalLoadTime > 3000) score -= 20
        if (performanceData.totalLoadTime > 5000) score -= 30
        
        // Penalize slow FCP
        if (performanceData.firstContentfulPaint && performanceData.firstContentfulPaint > 2000) score -= 15
        
        // Penalize large bundle sizes
        if (performanceData.transferSize > 1000000) score -= 10 // 1MB
        if (performanceData.transferSize > 2000000) score -= 20 // 2MB
      }

      // Penalize low FPS
      if (fps < 30) score -= 25
      if (fps < 45) score -= 15

      setPerformanceScore(Math.max(0, score))
    } catch (error) {
      console.error("Failed to collect performance metrics:", error)
    }
  }, [enabled, fps])

  // Collect metrics on mount and periodically
  useEffect(() => {
    if (!enabled) return

    collectMetrics()
    const interval = setInterval(collectMetrics, 5000) // Every 5 seconds

    return () => clearInterval(interval)
  }, [collectMetrics, enabled])

  // Keyboard shortcut to toggle overlay
  useEffect(() => {
    if (!enabled) return

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [enabled])

  // Performance warnings
  const getPerformanceWarnings = () => {
    const warnings = []

    if (fps < 30) {
      warnings.push("Low FPS detected - animations may be choppy")
    }

    if (metrics?.totalLoadTime > 5000) {
      warnings.push("Slow page load time - consider optimizing bundle size")
    }

    if (cacheSize > 50 * 1024 * 1024) { // 50MB
      warnings.push("Large cache size - consider clearing old cache entries")
    }

    if (prefersReducedMotion) {
      warnings.push("User prefers reduced motion - animations are disabled")
    }

    return warnings
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (!enabled || !isVisible) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg shadow-lg max-w-sm text-xs font-mono">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-neutral-400 hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Performance Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span>Performance Score:</span>
          <span className={`font-bold ${getScoreColor(performanceScore)}`}>
            {performanceScore}/100
          </span>
        </div>
        <div className="w-full bg-neutral-700 rounded-full h-2 mt-1">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              performanceScore >= 90 ? 'bg-green-400' :
              performanceScore >= 70 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${performanceScore}%` }}
          />
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between">
          <span>FPS:</span>
          <span className={fps < 30 ? 'text-red-400' : fps < 45 ? 'text-yellow-400' : 'text-green-400'}>
            {fps}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Cache Size:</span>
          <span>{formatBytes(cacheSize)}</span>
        </div>

        {metrics && (
          <>
            <div className="flex justify-between">
              <span>Load Time:</span>
              <span className={metrics.totalLoadTime > 3000 ? 'text-yellow-400' : 'text-green-400'}>
                {Math.round(metrics.totalLoadTime)}ms
              </span>
            </div>

            <div className="flex justify-between">
              <span>Bundle Size:</span>
              <span>{formatBytes(metrics.transferSize || 0)}</span>
            </div>

            {metrics.firstContentfulPaint && (
              <div className="flex justify-between">
                <span>FCP:</span>
                <span className={metrics.firstContentfulPaint > 2000 ? 'text-yellow-400' : 'text-green-400'}>
                  {Math.round(metrics.firstContentfulPaint)}ms
                </span>
              </div>
            )}

            {metrics.connectionType && (
              <div className="flex justify-between">
                <span>Connection:</span>
                <span>{metrics.connectionType}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Warnings */}
      {getPerformanceWarnings().length > 0 && (
        <div className="border-t border-neutral-700 pt-3">
          <h4 className="text-yellow-400 font-bold mb-2">Warnings:</h4>
          <ul className="space-y-1">
            {getPerformanceWarnings().map((warning, index) => (
              <li key={index} className="text-yellow-400 text-xs">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Controls */}
      <div className="border-t border-neutral-700 pt-3 mt-3">
        <div className="flex gap-2">
          <button
            onClick={collectMetrics}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Refresh
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-2 py-1 bg-neutral-600 text-white rounded text-xs hover:bg-neutral-700"
          >
            Reload
          </button>
        </div>
        <p className="text-neutral-400 mt-2 text-xs">
          Press Ctrl+Shift+P to toggle
        </p>
      </div>
    </div>
  )
}

// Performance testing utilities
export const runPerformanceTests = async () => {
  const results = {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    tests: {} as Record<string, any>
  }

  // Test 1: Animation performance
  results.tests.animationPerformance = await testAnimationPerformance()
  
  // Test 2: Bundle size
  results.tests.bundleSize = await testBundleSize()
  
  // Test 3: Memory usage
  results.tests.memoryUsage = testMemoryUsage()
  
  // Test 4: Cache performance
  results.tests.cachePerformance = await testCachePerformance()

  console.log("Performance Test Results:", results)
  return results
}

const testAnimationPerformance = async (): Promise<any> => {
  return new Promise((resolve) => {
    let frameCount = 0
    const startTime = performance.now()
    
    const testAnimation = () => {
      frameCount++
      
      if (frameCount >= 60) { // Test for 1 second at 60fps
        const endTime = performance.now()
        const actualFPS = (frameCount / (endTime - startTime)) * 1000
        
        resolve({
          targetFPS: 60,
          actualFPS: Math.round(actualFPS),
          passed: actualFPS >= 55 // Allow 5fps tolerance
        })
      } else {
        requestAnimationFrame(testAnimation)
      }
    }
    
    requestAnimationFrame(testAnimation)
  })
}

const testBundleSize = async () => {
  const metrics = getPerformanceMetrics()
  const transferSize = metrics?.transferSize || 0
  
  return {
    transferSize,
    passed: transferSize < 1000000, // Less than 1MB
    recommendation: transferSize > 1000000 ? "Consider code splitting" : "Bundle size is optimal"
  }
}

const testMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    const usedMB = memory.usedJSHeapSize / 1024 / 1024
    
    return {
      usedMemoryMB: Math.round(usedMB),
      passed: usedMB < 50, // Less than 50MB
      recommendation: usedMB > 50 ? "High memory usage detected" : "Memory usage is normal"
    }
  }
  
  return { error: "Memory API not available" }
}

const testCachePerformance = async () => {
  const cacheSize = await getCacheSize()
  const cacheSizeMB = cacheSize / 1024 / 1024
  
  return {
    cacheSizeMB: Math.round(cacheSizeMB),
    passed: cacheSizeMB < 25, // Less than 25MB
    recommendation: cacheSizeMB > 25 ? "Consider cache cleanup" : "Cache size is optimal"
  }
}

export default PerformanceMonitor
