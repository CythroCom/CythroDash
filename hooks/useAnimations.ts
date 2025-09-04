"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"

// Animation frame scheduler for 60fps animations
export const useAnimationFrame = (callback: (deltaTime: number) => void, deps: React.DependencyList = []) => {
  const requestRef = useRef<number | undefined>(undefined)
  const previousTimeRef = useRef<number | undefined>(undefined)
  const callbackRef = useRef(callback)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current
      callbackRef.current(deltaTime)
    }
    previousTimeRef.current = time
    requestRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate)
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, deps)

  const stop = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
    }
  }, [])

  const start = useCallback(() => {
    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  return { stop, start }
}

// Optimized hover animation hook
export const useHoverAnimation = (
  elementRef: React.RefObject<HTMLElement>,
  options: {
    scale?: number
    translateY?: number
    duration?: number
    easing?: string
  } = {}
) => {
  const {
    scale = 1.02,
    translateY = -2,
    duration = 150,
    easing = 'cubic-bezier(0.4, 0, 0.2, 1)'
  } = options

  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Use CSS custom properties for better performance
    element.style.setProperty('--hover-scale', scale.toString())
    element.style.setProperty('--hover-translate-y', `${translateY}px`)
    element.style.setProperty('--hover-duration', `${duration}ms`)
    element.style.setProperty('--hover-easing', easing)

    // Add CSS class for optimized transitions
    element.classList.add('hover-optimized')

    const handleMouseEnter = () => {
      setIsHovered(true)
      element.style.transform = `scale(var(--hover-scale)) translateY(var(--hover-translate-y))`
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
      element.style.transform = 'scale(1) translateY(0)'
    }

    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      element.classList.remove('hover-optimized')
    }
  }, [scale, translateY, duration, easing])

  return isHovered
}

// Smooth scroll animation hook
export const useSmoothScroll = () => {
  const scrollTo = useCallback((
    target: HTMLElement | string,
    options: {
      duration?: number
      offset?: number
      easing?: (t: number) => number
    } = {}
  ) => {
    const {
      duration = 500,
      offset = 0,
      easing = (t: number) => t * (2 - t) // easeOutQuad
    } = options

    const targetElement = typeof target === 'string' 
      ? document.querySelector(target) as HTMLElement
      : target

    if (!targetElement) return

    const startPosition = window.pageYOffset
    const targetPosition = targetElement.offsetTop - offset
    const distance = targetPosition - startPosition
    let startTime: number | null = null

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const timeElapsed = currentTime - startTime
      const progress = Math.min(timeElapsed / duration, 1)
      const easedProgress = easing(progress)

      window.scrollTo(0, startPosition + distance * easedProgress)

      if (progress < 1) {
        requestAnimationFrame(animation)
      }
    }

    requestAnimationFrame(animation)
  }, [])

  return { scrollTo }
}

// Intersection-based animation hook
export const useIntersectionAnimation = (
  options: IntersectionObserverInit = {},
  animationClass: string = 'animate-fade-in'
) => {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isVisible) {
        setIsVisible(true)
        element.classList.add(animationClass)
        // Disconnect after first intersection for performance
        observer.disconnect()
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [animationClass, isVisible, options])

  return { elementRef, isVisible }
}

// Staggered animation hook for lists
export const useStaggeredAnimation = (
  itemCount: number,
  delay: number = 50,
  animationClass: string = 'animate-fade-in'
) => {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // Stagger the animations
        for (let i = 0; i < itemCount; i++) {
          setTimeout(() => {
            setVisibleItems(prev => new Set([...prev, i]))
            const item = container.children[i] as HTMLElement
            if (item) {
              item.classList.add(animationClass)
            }
          }, i * delay)
        }
        observer.disconnect()
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px'
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [itemCount, delay, animationClass])

  return { containerRef, visibleItems }
}

// Performance-optimized transition hook
export const useOptimizedTransition = (
  isVisible: boolean,
  duration: number = 300
) => {
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      // Use RAF to ensure DOM update before animation
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    } else {
      setIsAnimating(false)
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration])

  return { shouldRender, isAnimating }
}

// FPS monitor for animation performance
export const useAnimationFPS = () => {
  const [fps, setFps] = useState(0)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())

  useAnimationFrame((_deltaTime) => {
    frameCount.current++
    const now = performance.now()

    if (now - lastTime.current >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / (now - lastTime.current)))
      frameCount.current = 0
      lastTime.current = now
    }
  })

  return fps
}

// Reduced motion preference hook
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

// Animation performance utilities
export const animationUtils = {
  // Force GPU acceleration
  enableGPUAcceleration: (element: HTMLElement) => {
    element.style.transform = 'translateZ(0)'
    element.style.backfaceVisibility = 'hidden'
    element.style.perspective = '1000px'
  },

  // Optimize for 60fps
  optimizeForSixtyFPS: (element: HTMLElement) => {
    element.style.willChange = 'transform, opacity'
    animationUtils.enableGPUAcceleration(element)
  },

  // Clean up after animation
  cleanupAnimation: (element: HTMLElement) => {
    element.style.willChange = 'auto'
    element.style.transform = ''
    element.style.backfaceVisibility = ''
    element.style.perspective = ''
  },

  // Batch DOM updates
  batchDOMUpdates: (updates: (() => void)[]) => {
    requestAnimationFrame(() => {
      updates.forEach(update => update())
    })
  }
}

// CSS-in-JS animation styles for better performance
export const animationStyles = {
  fadeIn: {
    opacity: 0,
    animation: 'fadeIn 0.3s ease-out forwards'
  },
  slideIn: {
    transform: 'translateX(-100%)',
    animation: 'slideIn 0.2s ease-out forwards'
  },
  scaleIn: {
    transform: 'scale(0.95)',
    opacity: 0,
    animation: 'scaleIn 0.2s ease-out forwards'
  },
  hoverLift: {
    transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-2px) scale(1.02)'
    }
  }
}
