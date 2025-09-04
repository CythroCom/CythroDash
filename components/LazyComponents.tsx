"use client"

import React, { lazy, Suspense, memo } from "react"

// Loading fallback components
const ComponentSkeleton = memo(({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-neutral-700/30 rounded-xl ${className || "h-32"}`}>
    <div className="p-4 space-y-3">
      <div className="h-4 bg-neutral-600/50 rounded w-3/4"></div>
      <div className="h-4 bg-neutral-600/50 rounded w-1/2"></div>
      <div className="h-4 bg-neutral-600/50 rounded w-5/6"></div>
    </div>
  </div>
))
ComponentSkeleton.displayName = "ComponentSkeleton"

const SidebarSkeleton = memo(() => (
  <div className="fixed inset-y-0 left-0 z-50 w-72 bg-neutral-800/95 border-r border-neutral-700/50 animate-pulse">
    <div className="p-4 border-b border-neutral-700/30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-600/50 rounded-xl"></div>
        <div className="space-y-2">
          <div className="h-4 bg-neutral-600/50 rounded w-24"></div>
          <div className="h-3 bg-neutral-600/50 rounded w-16"></div>
        </div>
      </div>
    </div>
    <div className="p-3 space-y-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-12 bg-neutral-600/30 rounded-lg"></div>
      ))}
    </div>
  </div>
))
SidebarSkeleton.displayName = "SidebarSkeleton"

const HeaderSkeleton = memo(() => (
  <header className="bg-neutral-800/30 border-b border-neutral-700/30 px-6 py-8 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-12 bg-neutral-600/50 rounded w-48"></div>
        <div className="h-6 bg-neutral-600/50 rounded w-64"></div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-12 bg-neutral-600/50 rounded-xl w-96"></div>
        <div className="h-12 w-12 bg-neutral-600/50 rounded-xl"></div>
        <div className="h-12 w-32 bg-neutral-600/50 rounded-xl"></div>
      </div>
    </div>
  </header>
))
HeaderSkeleton.displayName = "HeaderSkeleton"

const ServerCardSkeleton = memo(() => (
  <div className="border border-neutral-700/30 bg-neutral-800/40 rounded-2xl overflow-hidden animate-pulse">
    <div className="p-6 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-600/50 rounded-xl"></div>
          <div className="space-y-2">
            <div className="h-5 bg-neutral-600/50 rounded w-24"></div>
            <div className="h-4 bg-neutral-600/50 rounded w-16"></div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-neutral-600/50 rounded"></div>
          <div className="h-9 w-9 bg-neutral-600/50 rounded"></div>
        </div>
      </div>
      <div className="h-6 bg-neutral-600/50 rounded w-20"></div>
    </div>
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="p-3 bg-neutral-600/30 rounded-xl h-20"></div>
        <div className="p-3 bg-neutral-600/30 rounded-xl h-20"></div>
      </div>
      <div className="space-y-4">
        <div className="p-3 bg-neutral-600/30 rounded-xl h-16"></div>
        <div className="p-3 bg-neutral-600/30 rounded-xl h-16"></div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-12 bg-neutral-600/50 rounded-xl"></div>
        <div className="h-12 w-12 bg-neutral-600/50 rounded-xl"></div>
      </div>
    </div>
  </div>
))
ServerCardSkeleton.displayName = "ServerCardSkeleton"

const ServerListSkeleton = memo(() => (
  <main className="p-8">
    <div className="flex items-center justify-between mb-10">
      <div className="space-y-2">
        <div className="h-8 bg-neutral-600/50 rounded w-48 animate-pulse"></div>
        <div className="h-5 bg-neutral-600/50 rounded w-64 animate-pulse"></div>
      </div>
      <div className="h-12 w-40 bg-neutral-600/50 rounded-xl animate-pulse"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <ServerCardSkeleton key={i} />
      ))}
    </div>
  </main>
))
ServerListSkeleton.displayName = "ServerListSkeleton"

// Lazy loaded components with proper error boundaries
const LazyServerCard = lazy(() => 
  import("./ServerCard").then(module => ({ default: module.default }))
)

const LazySidebar = lazy(() => 
  import("./Sidebar").then(module => ({ default: module.default }))
)

const LazyHeader = lazy(() => 
  import("./Header").then(module => ({ default: module.default }))
)

const LazyServerList = lazy(() => 
  import("./ServerList").then(module => ({ default: module.default }))
)

// Error boundary for lazy components
class LazyComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; componentName: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode; componentName: string }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Lazy component error in ${this.props.componentName}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

// Wrapper components with suspense and error boundaries
export const ServerCard = memo((props: any) => (
  <LazyComponentErrorBoundary 
    fallback={<ServerCardSkeleton />} 
    componentName="ServerCard"
  >
    <Suspense fallback={<ServerCardSkeleton />}>
      <LazyServerCard {...props} />
    </Suspense>
  </LazyComponentErrorBoundary>
))
ServerCard.displayName = "LazyServerCard"

export const Sidebar = memo((props: any) => (
  <LazyComponentErrorBoundary 
    fallback={<SidebarSkeleton />} 
    componentName="Sidebar"
  >
    <Suspense fallback={<SidebarSkeleton />}>
      <LazySidebar {...props} />
    </Suspense>
  </LazyComponentErrorBoundary>
))
Sidebar.displayName = "LazySidebar"

export const Header = memo((props: any) => (
  <LazyComponentErrorBoundary 
    fallback={<HeaderSkeleton />} 
    componentName="Header"
  >
    <Suspense fallback={<HeaderSkeleton />}>
      <LazyHeader {...props} />
    </Suspense>
  </LazyComponentErrorBoundary>
))
Header.displayName = "LazyHeader"

export const ServerList = memo((props: any) => (
  <LazyComponentErrorBoundary 
    fallback={<ServerListSkeleton />} 
    componentName="ServerList"
  >
    <Suspense fallback={<ServerListSkeleton />}>
      <LazyServerList {...props} />
    </Suspense>
  </LazyComponentErrorBoundary>
))
ServerList.displayName = "LazyServerList"

// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload the most important components
  import("./Sidebar")
  import("./Header")
  import("./ServerList")
}

// Utility to preload components on user interaction
export const preloadOnInteraction = (componentNames: string[]) => {
  const preloadMap: Record<string, () => Promise<any>> = {
    ServerCard: () => import("./ServerCard"),
    Sidebar: () => import("./Sidebar"),
    Header: () => import("./Header"),
    ServerList: () => import("./ServerList"),
  }

  const handleInteraction = () => {
    componentNames.forEach(name => {
      if (preloadMap[name]) {
        preloadMap[name]()
      }
    })
    
    // Remove listeners after first interaction
    document.removeEventListener('mouseenter', handleInteraction)
    document.removeEventListener('touchstart', handleInteraction)
  }

  // Preload on first user interaction
  document.addEventListener('mouseenter', handleInteraction, { once: true })
  document.addEventListener('touchstart', handleInteraction, { once: true })
}

// Export skeletons for direct use
export {
  ComponentSkeleton,
  SidebarSkeleton,
  HeaderSkeleton,
  ServerCardSkeleton,
  ServerListSkeleton
}
