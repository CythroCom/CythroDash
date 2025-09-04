"use client"

import React, { memo, Suspense, lazy, ComponentType } from "react"
import { LucideProps } from "lucide-react"

// Icon loading cache to prevent duplicate imports
const iconCache = new Map<string, ComponentType<LucideProps>>()

// Preload commonly used icons for better UX
const commonIcons = [
  "Activity",
  "Gamepad2",
  "Users",
  "Database",
  "Search",
  "Menu",
  "Bell"
]

// Icon name type for better TypeScript support
export type IconName =
  | "Activity"
  | "DollarSign"
  | "Gift"
  | "RefreshCw"
  | "Gamepad2"
  | "Plus"
  | "UserCheck"
  | "ChevronLeft"
  | "Menu"
  | "Search"
  | "Bell"
  | "Users"
  | "Clock"
  | "Cpu"
  | "HardDrive"
  | "Database"
  | "ExternalLink"
  | "Copy"
  | "Play"
  | "RotateCcw"
  | "CheckCircle"
  | "Loader"
  | "PauseCircle"
  | "Eye"
  | "EyeOff"
  | "AlertCircle"
  | "Lock"
  | "Mail"
  | "User"
  | "LogIn"
  | "UserPlus"
  | "ArrowRight"
  | "Home"
  | "Shield"
  | "Settings"

// Dynamic icon loader with caching
const loadIcon = async (name: IconName): Promise<ComponentType<LucideProps>> => {
  // Check cache first
  if (iconCache.has(name)) {
    return iconCache.get(name)!
  }

  try {
    // Dynamic import with proper error handling
    const iconModule = await import("lucide-react")
    const IconComponent = iconModule[name as keyof typeof iconModule] as ComponentType<LucideProps>
    
    if (!IconComponent) {
      throw new Error(`Icon "${name}" not found`)
    }

    // Cache the loaded icon
    iconCache.set(name, IconComponent)
    return IconComponent
  } catch (error) {
    console.warn(`Failed to load icon "${name}":`, error)
    // Return a fallback icon
    const { Square } = await import("lucide-react")
    return Square
  }
}

// Lazy icon components with proper error boundaries
const createLazyIcon = (name: IconName) => {
  return lazy(() => 
    loadIcon(name).then(IconComponent => ({ 
      default: IconComponent 
    }))
  )
}

// Icon component with optimized loading and fallback
interface IconProps extends LucideProps {
  name: IconName
  fallback?: React.ReactNode
  preload?: boolean
}

// Fallback component for loading state
const IconFallback = memo(({ className }: { className?: string }) => (
  <div 
    className={`animate-pulse bg-neutral-600 rounded ${className || "w-4 h-4"}`}
    aria-hidden="true"
  />
))
IconFallback.displayName = "IconFallback"

// Error fallback component
const IconError = memo(({ className }: { className?: string }) => (
  <div 
    className={`bg-neutral-500 rounded ${className || "w-4 h-4"}`}
    aria-hidden="true"
    title="Icon failed to load"
  />
))
IconError.displayName = "IconError"

// Error boundary for icon loading
class IconErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("Icon loading error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

// Main Icon component with all optimizations
const Icon = memo(({ name, className, fallback, preload = false, ...props }: IconProps) => {
  // Create lazy icon component
  const LazyIcon = React.useMemo(() => createLazyIcon(name), [name])

  // Preload icon if requested
  React.useEffect(() => {
    if (preload || commonIcons.includes(name)) {
      loadIcon(name).catch(() => {
        // Silently handle preload errors
      })
    }
  }, [name, preload])

  const iconFallback = fallback || <IconFallback className={className} />
  const errorFallback = <IconError className={className} />

  return (
    <IconErrorBoundary fallback={errorFallback}>
      <Suspense fallback={iconFallback}>
        <LazyIcon 
          className={`icon-optimized ${className || ""}`} 
          {...props} 
        />
      </Suspense>
    </IconErrorBoundary>
  )
})

Icon.displayName = "Icon"

// Hook for preloading icons
export const usePreloadIcons = (icons: IconName[]) => {
  React.useEffect(() => {
    const preloadPromises = icons.map(iconName => 
      loadIcon(iconName).catch(() => {
        // Silently handle preload errors
      })
    )
    
    Promise.all(preloadPromises)
  }, [icons])
}

// Utility function to preload icons manually
export const preloadIcon = async (name: IconName): Promise<void> => {
  try {
    await loadIcon(name)
  } catch {
    // Silently handle errors
  }
}

// Utility function to preload multiple icons
export const preloadIcons = (names: IconName[]): Promise<void[]> => {
  return Promise.all(names.map(preloadIcon))
}

// Context for icon configuration
interface IconContextValue {
  preloadCommonIcons: boolean
  fallbackComponent?: React.ComponentType<{ className?: string }>
  errorComponent?: React.ComponentType<{ className?: string }>
}

const IconContext = React.createContext<IconContextValue>({
  preloadCommonIcons: true
})

// Provider component for icon configuration
export const IconProvider = memo(({ 
  children, 
  preloadCommonIcons = true,
  fallbackComponent,
  errorComponent
}: {
  children: React.ReactNode
  preloadCommonIcons?: boolean
  fallbackComponent?: React.ComponentType<{ className?: string }>
  errorComponent?: React.ComponentType<{ className?: string }>
}) => {
  // Preload common icons on mount
  React.useEffect(() => {
    if (preloadCommonIcons) {
      preloadIcons(commonIcons as IconName[])
    }
  }, [preloadCommonIcons])

  const contextValue = React.useMemo(() => ({
    preloadCommonIcons,
    fallbackComponent,
    errorComponent
  }), [preloadCommonIcons, fallbackComponent, errorComponent])

  return (
    <IconContext.Provider value={contextValue}>
      {children}
    </IconContext.Provider>
  )
})

IconProvider.displayName = "IconProvider"

// Hook to use icon context
export const useIconContext = () => React.useContext(IconContext)

// Export the main Icon component and utilities
export default Icon
export { IconFallback, IconError, IconErrorBoundary }

// Performance monitoring for icon loading
export const getIconCacheStats = () => ({
  cacheSize: iconCache.size,
  cachedIcons: Array.from(iconCache.keys())
})

// Clear icon cache (useful for testing or memory management)
export const clearIconCache = () => {
  iconCache.clear()
}
