"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar, Header, ServerList } from "@/components/LazyComponents"
import { usePerformanceMonitor, useMemoryMonitor } from "@/hooks/usePerformance"
import { preloadCriticalComponents, preloadOnInteraction } from "@/components/LazyComponents"
import PerformanceMonitor from "@/components/PerformanceMonitor"
import { useAuthStore } from "@/stores/user-store"
import { useServerStore } from "@/stores/server-store"
import { showSuccess } from "@/lib/toast"
import type { Server as UiServer } from "@/components/ServerCard"
import { useAppBootstrap } from "@/hooks/use-bootstrap"
import LoadingOverlay from "@/components/LoadingOverlay"

export default function Dashboard() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { checkSession } = useAuthStore()
  const { servers, isLoading, error, fetchServers } = useServerStore()

  // Performance monitoring in development
  usePerformanceMonitor("Dashboard")
  useMemoryMonitor("Dashboard")

  // Preload critical components and setup interaction-based preloading
  useEffect(() => {
    preloadCriticalComponents()
    preloadOnInteraction(["ServerCard"])
  }, [])

  // Auth guard + fetch servers
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const ok = await checkSession()
      if (!ok) {
        if (!cancelled) router.replace('/login')
        return
      }
      const success = await fetchServers()
      if (!success && !cancelled && error) {
        const e = error
        const { showError } = await import('@/lib/toast')
        showError('Failed to load servers', e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [checkSession, fetchServers, router])

  // Memoized event handlers to prevent unnecessary re-renders
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleMenuClick = useCallback(() => {
    setSidebarOpen(true)
  }, [])



  const handleCopyIP = useCallback((ip: string) => {
    navigator.clipboard.writeText(ip)
    showSuccess('Copied to clipboard')
  }, [])

  const handleOpenExternal = useCallback((serverId: number) => {
    console.log("Opening external for server:", serverId)
    // TODO: Implement external link logic
  }, [])

  const handleCreateServer = useCallback(() => {
    console.log("Creating new server")
    // TODO: Implement create server logic
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery("")
  }, [])

  const handleServerRenew = useCallback(async (serverId: string | number) => {
    try {
      const { showSuccess, showError } = await import('@/lib/toast')
      const user = useAuthStore.getState().currentUser

      if (!user) {
        showError('Authentication required')
        return
      }

      const response = await fetch(`/api/servers/${serverId}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': encodeURIComponent(JSON.stringify(user))
        },
        credentials: 'include',
        body: JSON.stringify({ confirm: true })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('Server renewed successfully')
        // Refresh server data
        await fetchServers()
      } else {
        showError(result.message || 'Failed to renew server')
      }
    } catch (error) {
      console.error('Error renewing server:', error)
      const { showError } = await import('@/lib/toast')
      showError('Failed to renew server')
    }
  }, [fetchServers])

  const handleManageServer = useCallback((serverId: string | number) => {
    router.push(`/servers/${serverId}`)
  }, [router])

  // Map store servers to UI shape
  const mapStoreServersToUi = useCallback((s: import("@/stores/server-store").Server[]): UiServer[] => {
    return s.map((sv) => ({
      id: sv.id,
      name: sv.name,
      status: sv.status as UiServer['status'],
      game: sv.type || 'Game',
      ip: (() => {
        const allocs = sv.allocations || []
        const primary = allocs.find(a => a.assigned) || allocs[0]
        return primary ? `${primary.ip}:${primary.port}` : ''
      })(),
      billing_status: sv.billing_status,
      expiry_date: sv.expiry_date,
      auto_delete_at: sv.auto_delete_at,
      overdue_amount: sv.overdue_amount,
    }))
  }, [])

  const { isLoading: bootLoading } = useAppBootstrap()

  return (
    <div className="min-h-screen bg-neutral-900">
      {bootLoading && <LoadingOverlay message="Preparing your dashboard..." />}

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
      />

      <div className={`transition-all duration-200 ${sidebarOpen ? "lg:ml-72" : "lg:ml-16"}`}>
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onMenuClick={handleMenuClick}
        />

        {isLoading ? (
          <main className="p-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-white">Your Servers</h2>
                <p className="text-neutral-400 text-lg mt-1">Loading your servers...</p>
              </div>
              <div className="h-12 w-40 bg-neutral-600/50 rounded-xl animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-neutral-700/30 bg-neutral-800/40 rounded-2xl overflow-hidden animate-pulse h-72" />
              ))}
            </div>
          </main>
        ) : (
          <ServerList
            servers={mapStoreServersToUi(servers)}
            searchQuery={searchQuery}
            onCreateServer={handleCreateServer}
            onCopyIP={handleCopyIP}
            onOpenExternal={handleOpenExternal}
            onServerRenew={handleServerRenew}
            onManageServer={handleManageServer}
            onClearSearch={handleClearSearch}
          />
        )}
      </div>

      {/* Performance Monitor for development */}
      <PerformanceMonitor />
    </div>
  )
}
