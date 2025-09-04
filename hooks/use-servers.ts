"use client"

import { useEffect } from 'react'
import { useServerStore, type Server, type ServerStatus } from '@/stores/server-store'
import { useToast } from '@/hooks/use-toast'

// Re-export types for easier importing
export type { Server, ServerStatus } from '@/stores/server-store'

/**
 * Custom hook for server management functionality
 * Provides easy access to server data and actions with automatic error handling
 */
export function useServers() {
  const store = useServerStore()
  const { toast } = useToast()

  // Show error toast when error occurs
  useEffect(() => {
    if (store.error) {
      toast({
        title: "Error",
        description: store.error,
        variant: "destructive",
      })
      // Clear error after showing toast
      setTimeout(() => store.clearError(), 100)
    }
  }, [store.error, toast])

  // Auto-fetch servers on mount if not already loaded
  useEffect(() => {
    if (store.servers.length === 0 && !store.isLoading) {
      store.fetchServers()
    }
  }, [])

  return store
}

/**
 * Hook for individual server management
 */
export function useServer(serverId: string) {
  const { servers, fetchServerById, refreshServer, error, clearError } = useServerStore()
  const { toast } = useToast()

  // Find server in store
  const server = servers.find(s => s.id === serverId)

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      // Clear error after showing toast
      setTimeout(() => clearError(), 100)
    }
  }, [error, toast])

  // Fetch server details if not in store
  useEffect(() => {
    if (!server && serverId) {
      fetchServerById(serverId)
    }
  }, [serverId, server])

  const refresh = async () => {
    if (serverId) {
      return await refreshServer(serverId)
    }
    return false
  }

  return {
    server,
    refresh,
    isLoading: !server,
    error
  }
}

/**
 * Utility functions for server management
 */
export const serverUtils = {
  // Format server status
  getStatusColor: (status: ServerStatus): string => {
    switch (status) {
      case 'online':
        return 'text-green-500'
      case 'offline':
        return 'text-gray-500'
      case 'starting':
        return 'text-yellow-500'
      case 'stopping':
        return 'text-orange-500'
      default:
        return 'text-gray-400'
    }
  },

  // Get status badge properties
  getStatusBadge: (status: ServerStatus) => {
    switch (status) {
      case 'online':
        return { variant: 'default' as const, className: 'bg-green-500', label: 'Online' }
      case 'offline':
        return { variant: 'secondary' as const, className: 'bg-gray-500', label: 'Offline' }
      case 'starting':
        return { variant: 'secondary' as const, className: 'bg-yellow-500', label: 'Starting' }
      case 'stopping':
        return { variant: 'secondary' as const, className: 'bg-orange-500', label: 'Stopping' }
      default:
        return { variant: 'outline' as const, className: '', label: status }
    }
  },

  // Format memory/disk sizes
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  },

  // Format uptime
  formatUptime: (uptime: string): string => {
    // If uptime is already formatted, return as is
    if (uptime.includes('d') || uptime.includes('h') || uptime.includes('m')) {
      return uptime
    }
    
    // Try to parse as seconds
    const seconds = parseInt(uptime)
    if (isNaN(seconds)) return uptime
    
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) {
      return `${days}d ${hours}h`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  },

  // Get resource usage color
  getResourceUsageColor: (percentage: number): string => {
    if (percentage >= 90) return 'text-red-500'
    if (percentage >= 75) return 'text-yellow-500'
    if (percentage >= 50) return 'text-blue-500'
    return 'text-green-500'
  },

  // Get resource usage background color for progress bars
  getResourceUsageBgColor: (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    if (percentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  },

  // Get server type icon
  getServerTypeIcon: (type: string): string => {
    switch (type.toLowerCase()) {
      case 'minecraft':
        return '🎮'
      case 'rust':
        return '🔫'
      case 'cs:go':
      case 'csgo':
        return '🎯'
      case 'valheim':
        return '⚔️'
      case 'ark':
        return '🦕'
      case 'discord':
        return '🤖'
      case 'web':
        return '🌐'
      case 'database':
        return '🗄️'
      case 'game':
        return '🎲'
      default:
        return '⚙️'
    }
  },

  // Check if server is running
  isServerRunning: (status: ServerStatus): boolean => {
    return status === 'online'
  },

  // Check if server can be started
  canStartServer: (status: ServerStatus): boolean => {
    return status === 'offline'
  },

  // Check if server can be stopped
  canStopServer: (status: ServerStatus): boolean => {
    return status === 'online' || status === 'starting'
  },

  // Check if server can be restarted
  canRestartServer: (status: ServerStatus): boolean => {
    return status === 'online'
  },

  // Get server performance score (0-100)
  getPerformanceScore: (server: Server): number => {
    if (!server.resources) return 0
    
    const memoryScore = Math.max(0, 100 - server.resources.memory.percentage)
    const diskScore = Math.max(0, 100 - server.resources.disk.percentage)
    const cpuScore = Math.max(0, 100 - server.resources.cpu.percentage)
    
    return Math.round((memoryScore + diskScore + cpuScore) / 3)
  },

  // Get server health status
  getHealthStatus: (server: Server): 'excellent' | 'good' | 'warning' | 'critical' => {
    const score = serverUtils.getPerformanceScore(server)
    
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'warning'
    return 'critical'
  },

  // Format player count
  formatPlayerCount: (players: string): { current: number; max: number; percentage: number } => {
    const match = players.match(/(\d+)\/(\d+)/)
    if (!match) return { current: 0, max: 0, percentage: 0 }
    
    const current = parseInt(match[1])
    const max = parseInt(match[2])
    const percentage = max > 0 ? (current / max) * 100 : 0
    
    return { current, max, percentage }
  },

  // Get server age
  getServerAge: (createdAt?: string): string => {
    if (!createdAt) return 'Unknown'
    
    const created = new Date(createdAt)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  },

  // Sort servers by various criteria
  sortServers: (servers: Server[], sortBy: 'name' | 'status' | 'created_at' | 'performance', order: 'asc' | 'desc' = 'asc'): Server[] => {
    const sorted = [...servers].sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          // Order: online, starting, stopping, offline, unknown
          const statusOrder: Record<ServerStatus, number> = { online: 0, starting: 1, stopping: 2, offline: 3, unknown: 4 }
          aValue = statusOrder[a.status]
          bValue = statusOrder[b.status]
          break
        case 'created_at':
          aValue = new Date(a.created_at || 0)
          bValue = new Date(b.created_at || 0)
          break
        case 'performance':
          aValue = serverUtils.getPerformanceScore(a)
          bValue = serverUtils.getPerformanceScore(b)
          break
        default:
          return 0
      }
      
      if (order === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      }
    })
    
    return sorted
  }
}
