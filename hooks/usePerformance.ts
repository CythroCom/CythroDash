"use client"

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react"

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(Date.now())
  
  useEffect(() => {
    renderCount.current += 1
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime.current
    lastRenderTime.current = now
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} rendered ${renderCount.current} times. Time since last render: ${timeSinceLastRender}ms`)
    }
  })
  
  return {
    renderCount: renderCount.current,
    getStats: () => ({
      componentName,
      renderCount: renderCount.current,
      lastRenderTime: lastRenderTime.current
    })
  }
}

// Debounced callback hook for performance
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay, ...deps]) as T
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedCallback
}

// Throttled callback hook for performance
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T => {
  const lastCallTime = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime.current
    
    if (timeSinceLastCall >= delay) {
      lastCallTime.current = now
      callback(...args)
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallTime.current = Date.now()
        callback(...args)
      }, delay - timeSinceLastCall)
    }
  }, [callback, delay, ...deps]) as T
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return throttledCallback
}

// Memoized search filter hook
export const useSearchFilter = <T>(
  items: T[],
  searchQuery: string,
  searchFields: (keyof T)[],
  delay: number = 300
) => {
  const debouncedQuery = useDebouncedValue(searchQuery, delay)
  
  return useMemo(() => {
    if (!debouncedQuery.trim()) return items
    
    const query = debouncedQuery.toLowerCase()
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field]
        return typeof value === 'string' && value.toLowerCase().includes(query)
      })
    )
  }, [items, debouncedQuery, searchFields])
}

// Debounced value hook
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

// Intersection observer hook for lazy loading
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false)
  const [hasIntersected, setHasIntersected] = React.useState(false)
  const elementRef = useRef<HTMLElement>(null)
  
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true)
      }
    }, options)
    
    observer.observe(element)
    
    return () => {
      observer.unobserve(element)
    }
  }, [options, hasIntersected])
  
  return { elementRef, isIntersecting, hasIntersected }
}

// Virtual scrolling hook for large lists
export const useVirtualScrolling = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = React.useState(0)
  
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
  }, [items, visibleRange])
  
  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.startIndex * itemHeight
  
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    visibleRange
  }
}

// Performance-optimized state hook
export const useOptimizedState = <T>(
  initialValue: T,
  equalityFn?: (prev: T, next: T) => boolean
) => {
  const [state, setState] = React.useState(initialValue)
  
  const setOptimizedState = useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prevState => {
      const nextState = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prevState)
        : newValue
      
      if (equalityFn && equalityFn(prevState, nextState)) {
        return prevState
      }
      
      return nextState
    })
  }, [equalityFn])
  
  return [state, setOptimizedState] as const
}

// Memory usage monitoring hook
export const useMemoryMonitor = (componentName: string) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
      const logMemory = () => {
        const memory = (performance as any).memory
        console.log(`[Memory] ${componentName}:`, {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
        })
      }
      
      logMemory()
      
      const interval = setInterval(logMemory, 10000) // Log every 10 seconds
      
      return () => clearInterval(interval)
    }
  }, [componentName])
}

// FPS monitoring hook
export const useFPSMonitor = () => {
  const [fps, setFps] = React.useState(0)
  const frameCount = useRef(0)
  const lastTime = useRef(Date.now())
  
  useEffect(() => {
    let animationId: number
    
    const measureFPS = () => {
      frameCount.current++
      const now = Date.now()
      
      if (now - lastTime.current >= 1000) {
        setFps(frameCount.current)
        frameCount.current = 0
        lastTime.current = now
      }
      
      animationId = requestAnimationFrame(measureFPS)
    }
    
    animationId = requestAnimationFrame(measureFPS)
    
    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])
  
  return fps
}

// Bundle size monitoring
export const getBundleStats = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      transferSize: navigation.transferSize,
      encodedBodySize: navigation.encodedBodySize,
      decodedBodySize: navigation.decodedBodySize
    }
  }
  
  return null
}
