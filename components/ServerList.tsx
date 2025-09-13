"use client"

import React, { memo, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import ServerCard, { type Server } from "./ServerCard"
import Icon from "@/components/IconProvider"

interface ServerListProps {
  servers: Server[]
  searchQuery?: string
  onCreateServer?: () => void
  onCopyIP?: (ip: string) => void
  onOpenExternal?: (serverId: string | number) => void
  onServerRenew?: (serverId: string | number) => void
  onManageServer?: (serverId: string | number) => void
  onClearSearch?: () => void
}

// Memoized empty state component
const EmptyState = memo(({ searchQuery, onClearSearch }: { 
  searchQuery: string
  onClearSearch?: () => void 
}) => {
  const handleClearSearch = useCallback(() => {
    onClearSearch?.()
  }, [onClearSearch])

  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-neutral-700/30 rounded-2xl flex items-center justify-center border border-neutral-600/30 mx-auto mb-6">
        <Icon name="Database" className="h-10 w-10 text-neutral-400" />
      </div>
      <h3 className="text-2xl font-bold mb-3 text-white">No servers found</h3>
      <p className="text-neutral-400 mb-6 text-lg">No servers match "{searchQuery}"</p>
      <Button
        variant="outline"
        onClick={handleClearSearch}
        className="border-neutral-600/20 hover:bg-neutral-700/30 bg-transparent h-12 px-6 rounded-xl focus:bg-neutral-700/30 focus:ring-0 focus:outline-none transition-colors duration-200"
      >
        Clear search
      </Button>
    </div>
  )
})
EmptyState.displayName = "EmptyState"

// Memoized header section
const ListHeader = memo(({ onCreateServer }: { onCreateServer?: () => void }) => {
  const handleCreateServer = useCallback(() => {
    onCreateServer?.()
  }, [onCreateServer])

  return (
    <div className="flex items-center justify-between mb-10">
      <div>
        <h2 className="text-3xl font-bold text-white">Your Servers</h2>
        <p className="text-neutral-400 text-lg mt-1">Manage your game server instances</p>
      </div>
      <Button 
        className="gap-3 bg-neutral-600/10 hover:bg-neutral-600/20 text-neutral-300 border border-neutral-500/20 h-12 px-6 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 focus:bg-neutral-600/20 focus:ring-0 focus:outline-none"
        onClick={handleCreateServer}
      >
        <Icon name="Plus" className="h-5 w-5" href="/create-server"/>
        Create Server
      </Button>
    </div>
  )
})
ListHeader.displayName = "ListHeader"

// Main ServerList component with optimizations
const ServerList = memo(({
  servers,
  searchQuery = "",
  onCreateServer,
  onCopyIP,
  onOpenExternal,
  onServerRenew,
  onManageServer,
  onClearSearch
}: ServerListProps) => {
  // Memoize filtered servers to prevent unnecessary recalculations
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers
    
    const query = searchQuery.toLowerCase()
    return servers.filter(server => 
      server.name.toLowerCase().includes(query) ||
      server.game.toLowerCase().includes(query)
    )
  }, [servers, searchQuery])

  // Memoize event handlers to prevent unnecessary re-renders
  const handleCopyIP = useCallback((ip: string) => {
    onCopyIP?.(ip)
  }, [onCopyIP])

  const handleOpenExternal = useCallback((serverId: string | number) => {
    onOpenExternal?.(serverId)
  }, [onOpenExternal])

  const handleClearSearch = useCallback(() => {
    onClearSearch?.()
  }, [onClearSearch])

  const handleCreateServer = useCallback(() => {
    onCreateServer?.()
  }, [onCreateServer])

  const handleServerRenew = useCallback((serverId: string | number) => {
    onServerRenew?.(serverId)
  }, [onServerRenew])

  const handleManageServer = useCallback((serverId: string | number) => {
    onManageServer?.(serverId)
  }, [onManageServer])

  // Show empty state if no servers match search
  if (filteredServers.length === 0 && searchQuery) {
    return (
      <main className="p-8">
        <ListHeader onCreateServer={handleCreateServer} />
        <EmptyState searchQuery={searchQuery} onClearSearch={handleClearSearch} />
      </main>
    )
  }

  return (
    <main className="p-8">
      <ListHeader onCreateServer={handleCreateServer} />
      
      {/* Server Grid - Optimized with CSS Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredServers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            onCopyIP={handleCopyIP}
            onOpenExternal={handleOpenExternal}
            onRenew={handleServerRenew}
            onManageServer={handleManageServer}
          />
        ))}
      </div>

      {/* Empty state for no servers at all */}
      {filteredServers.length === 0 && !searchQuery && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-neutral-700/30 rounded-2xl flex items-center justify-center border border-neutral-600/30 mx-auto mb-6">
            <Icon name="Database" className="h-10 w-10 text-neutral-400" />
          </div>
          <h3 className="text-2xl font-bold mb-3 text-white">No servers yet</h3>
          <p className="text-neutral-400 mb-6 text-lg">Create your first server to get started</p>
          <Button
            className="gap-3 bg-neutral-600/10 hover:bg-neutral-600/20 text-neutral-300 border border-neutral-500/20 h-12 px-6 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={handleCreateServer}
          >
            <Icon name="Plus" className="h-5 w-5"  />
            Create Server
          </Button>
        </div>
      )}
    </main>
  )
})

ServerList.displayName = "ServerList"

export default ServerList
