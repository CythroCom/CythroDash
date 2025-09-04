"use client"

import { useEffect } from 'react'
import { useMonitoringStore, type NodeStatus, type LocationStatus } from '@/stores/monitoring-store'

/**
 * Custom hook for monitoring functionality
 * Provides easy access to monitoring data and actions with automatic lifecycle management
 */
export function useMonitoring() {
  const store = useMonitoringStore()

  // Auto-start monitoring on mount
  useEffect(() => {
    // Initial data fetch
    if (!store.monitoringStats && !store.isLoading) {
      store.fetchMonitoringData()
    }

    // Setup auto-refresh if enabled
    if (store.autoRefresh) {
      store.startAutoRefresh()
    }

    // Cleanup on unmount
    return () => {
      store.stopAutoRefresh()
    }
  }, [])

  // Restart auto-refresh when settings change
  useEffect(() => {
    if (store.autoRefresh) {
      store.stopAutoRefresh()
      store.startAutoRefresh()
    } else {
      store.stopAutoRefresh()
    }
  }, [store.autoRefresh, store.refreshInterval])

  return store
}

/**
 * Hook for capacity checking functionality
 */
export function useCapacityCheck() {
  const { checkCapacity, error, setError } = useMonitoringStore()

  const checkLocationCapacity = async (
    locationId: number,
    requiredMemory: number,
    requiredDisk: number,
    requiredCpu?: number
  ) => {
    return await checkCapacity({
      location_id: locationId,
      required_memory: requiredMemory,
      required_disk: requiredDisk,
      required_cpu: requiredCpu,
      include_recommendations: true
    })
  }

  const checkNodeCapacity = async (
    nodeId: number,
    requiredMemory: number,
    requiredDisk: number,
    requiredCpu?: number
  ) => {
    return await checkCapacity({
      node_id: nodeId,
      required_memory: requiredMemory,
      required_disk: requiredDisk,
      required_cpu: requiredCpu
    })
  }

  return {
    checkLocationCapacity,
    checkNodeCapacity,
    error,
    clearError: () => setError(null)
  }
}

/**
 * Utility functions for monitoring data
 */
export const monitoringUtils = {
  // Get status badge properties
  getStatusBadge: (status: NodeStatus | LocationStatus) => {
    switch (status) {
      case 'available':
        return { variant: 'default' as const, className: 'bg-green-500', label: 'Available' }
      case 'limited':
        return { variant: 'secondary' as const, className: 'bg-yellow-500', label: 'Limited' }
      case 'full':
        return { variant: 'destructive' as const, className: '', label: 'Full' }
      case 'maintenance':
        return { variant: 'outline' as const, className: '', label: 'Maintenance' }
      default:
        return { variant: 'outline' as const, className: '', label: status }
    }
  },

  // Get usage color for progress bars
  getUsageColor: (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    if (percentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  },

  // Get usage severity
  getUsageSeverity: (percentage: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (percentage >= 95) return 'critical'
    if (percentage >= 85) return 'high'
    if (percentage >= 70) return 'medium'
    return 'low'
  },

  // Calculate efficiency score (0-100)
  calculateEfficiency: (allocated: number, total: number): number => {
    if (total === 0) return 0
    const usage = (allocated / total) * 100
    // Optimal usage is around 70-80%
    const optimal = 75
    const distance = Math.abs(usage - optimal)
    return Math.max(0, 100 - (distance * 2))
  },

  // Format uptime
  formatUptime: (seconds: number): string => {
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

  // Calculate resource utilization trend
  calculateTrend: (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const threshold = 2 // 2% threshold for stability
    const diff = current - previous
    
    if (Math.abs(diff) < threshold) return 'stable'
    return diff > 0 ? 'up' : 'down'
  },

  // Get recommended action based on usage
  getRecommendedAction: (memoryUsage: number, diskUsage: number): string | null => {
    const maxUsage = Math.max(memoryUsage, diskUsage)
    
    if (maxUsage >= 95) {
      return 'Critical: Immediate action required - Consider adding more nodes'
    } else if (maxUsage >= 85) {
      return 'Warning: High usage detected - Monitor closely'
    } else if (maxUsage >= 75) {
      return 'Caution: Usage approaching limits - Plan for expansion'
    }
    
    return null
  },

  // Calculate load distribution score
  calculateLoadDistribution: (nodes: Array<{ memory_usage_percentage: number; disk_usage_percentage: number }>): number => {
    if (nodes.length === 0) return 0
    
    const usages = nodes.map(node => Math.max(node.memory_usage_percentage, node.disk_usage_percentage))
    const average = usages.reduce((sum, usage) => sum + usage, 0) / usages.length
    const variance = usages.reduce((sum, usage) => sum + Math.pow(usage - average, 2), 0) / usages.length
    const standardDeviation = Math.sqrt(variance)
    
    // Lower standard deviation = better distribution (score closer to 100)
    return Math.max(0, 100 - standardDeviation)
  },

  // Predict capacity exhaustion
  predictCapacityExhaustion: (
    currentUsage: number, 
    totalCapacity: number, 
    growthRatePerDay: number
  ): number | null => {
    if (growthRatePerDay <= 0) return null
    
    const remainingCapacity = totalCapacity - currentUsage
    const daysUntilFull = remainingCapacity / growthRatePerDay
    
    return daysUntilFull > 0 ? Math.ceil(daysUntilFull) : 0
  }
}

/**
 * Hook for monitoring statistics and analytics
 */
export function useMonitoringAnalytics() {
  const { monitoringStats, locations, nodes } = useMonitoringStore()

  const analytics = {
    // Overall system health score (0-100)
    systemHealthScore: (() => {
      if (!monitoringStats) return 0
      
      const memoryScore = Math.max(0, 100 - monitoringStats.overall_memory_usage)
      const diskScore = Math.max(0, 100 - monitoringStats.overall_disk_usage)
      const nodeAvailabilityScore = monitoringStats.total_nodes > 0 
        ? (monitoringStats.active_nodes / monitoringStats.total_nodes) * 100 
        : 0
      
      return Math.round((memoryScore + diskScore + nodeAvailabilityScore) / 3)
    })(),

    // Load distribution quality
    loadDistribution: monitoringUtils.calculateLoadDistribution(nodes),

    // Critical alerts count
    criticalAlerts: (() => {
      let alerts = 0
      
      // Check nodes for critical usage
      nodes.forEach(node => {
        if (node.memory_usage_percentage >= 95 || node.disk_usage_percentage >= 95) {
          alerts++
        }
      })
      
      // Check locations for critical usage
      locations.forEach(location => {
        if (location.memory_usage_percentage >= 95 || location.disk_usage_percentage >= 95) {
          alerts++
        }
      })
      
      return alerts
    })(),

    // Efficiency metrics
    efficiency: {
      memory: monitoringStats ? monitoringUtils.calculateEfficiency(
        monitoringStats.allocated_memory, 
        monitoringStats.total_memory
      ) : 0,
      disk: monitoringStats ? monitoringUtils.calculateEfficiency(
        monitoringStats.allocated_disk, 
        monitoringStats.total_disk
      ) : 0
    },

    // Capacity recommendations
    recommendations: (() => {
      const recs: string[] = []
      
      if (monitoringStats) {
        const memoryRec = monitoringUtils.getRecommendedAction(
          monitoringStats.overall_memory_usage,
          monitoringStats.overall_disk_usage
        )
        if (memoryRec) recs.push(memoryRec)
      }
      
      // Check for unbalanced nodes
      const unbalancedNodes = nodes.filter(node => 
        Math.abs(node.memory_usage_percentage - node.disk_usage_percentage) > 30
      )
      if (unbalancedNodes.length > 0) {
        recs.push(`${unbalancedNodes.length} nodes have unbalanced resource usage`)
      }
      
      return recs
    })()
  }

  return analytics
}
