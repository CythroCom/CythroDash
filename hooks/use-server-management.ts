"use client"

import { useEffect } from 'react'
import { useServerManagementStore } from '@/stores/server-management-store'
import { useToast } from '@/hooks/use-toast'

/**
 * Custom hook for server management functionality
 * Provides easy access to server creation data and actions with automatic error handling
 */
export function useServerManagement() {
  const store = useServerManagementStore()
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

  return store
}

/**
 * Hook for server creation wizard functionality
 */
export function useServerCreationWizard() {
  const {
    serverTypes,
    serverSoftware,
    locations,
    plans,
    capacityInfo,
    userPermissions,
    isLoading,
    isCreatingServer,
    selectedServerType,
    selectedLocation,
    error,
    
    // Actions
    fetchServerTypes,
    fetchServerSoftware,
    fetchLocations,
    fetchPlans,
    checkCapacity,
    createServer,
    setSelectedServerType,
    setSelectedLocation,
    clearError,
    
    // Helpers
    getServerTypeById,
    getLocationById,
    getPlanById,
    getSoftwareById
  } = useServerManagement()

  // Initialize data on mount
  useEffect(() => {
    if (serverTypes.length === 0) {
      fetchServerTypes()
    }
    if (locations.length === 0) {
      fetchLocations()
    }
  }, [])

  // Fetch software when server type changes
  useEffect(() => {
    if (selectedServerType && selectedServerType !== '') {
      fetchServerSoftware(selectedServerType)
    }
  }, [selectedServerType])

  // Fetch plans when location changes
  useEffect(() => {
    if (selectedLocation && selectedLocation !== '') {
      fetchPlans(selectedLocation, selectedServerType ? { server_type_id: selectedServerType } : {})
    }
  }, [selectedLocation, selectedServerType])

  // Helper to check if wizard step is complete
  const isStepComplete = (step: 'type' | 'software' | 'location' | 'plan') => {
    switch (step) {
      case 'type':
        return !!selectedServerType
      case 'software':
        return !!selectedServerType && serverSoftware.length > 0
      case 'location':
        return !!selectedLocation
      case 'plan':
        return !!selectedLocation && plans.length > 0
      default:
        return false
    }
  }

  // Helper to get current step
  const getCurrentStep = (): 'type' | 'software' | 'location' | 'plan' | 'review' => {
    if (!selectedServerType) return 'type'
    if (!serverSoftware.length || !selectedServerType) return 'software'
    if (!selectedLocation) return 'location'
    if (!plans.length || !selectedLocation) return 'plan'
    return 'review'
  }

  // Helper to check if user can proceed
  const canProceed = () => {
    if (!userPermissions) return false
    if (!userPermissions.can_create_servers) return false
    if (userPermissions.requires_verification) return false
    if (userPermissions.max_servers && userPermissions.current_servers >= userPermissions.max_servers) return false
    return true
  }

  return {
    // Data
    serverTypes,
    serverSoftware,
    locations,
    plans,
    capacityInfo,
    userPermissions,
    
    // State
    isLoading,
    isCreatingServer,
    selectedServerType,
    selectedLocation,
    error,
    
    // Actions
    fetchServerTypes,
    fetchServerSoftware,
    fetchLocations,
    fetchPlans,
    checkCapacity,
    createServer,
    setSelectedServerType,
    setSelectedLocation,
    clearError,
    
    // Helpers
    getServerTypeById,
    getLocationById,
    getPlanById,
    getSoftwareById,
    isStepComplete,
    getCurrentStep,
    canProceed
  }
}

/**
 * Hook for capacity checking functionality
 */
export function useCapacityCheck() {
  const { checkCapacity, capacityInfo, error, clearError } = useServerManagement()

  const checkLocationCapacity = async (
    locationId: string,
    requiredMemory: number,
    requiredDisk: number,
    requiredCpu?: number
  ) => {
    return await checkCapacity(locationId, requiredMemory, requiredDisk, requiredCpu)
  }

  return {
    checkLocationCapacity,
    capacityInfo,
    error,
    clearError
  }
}

/**
 * Utility functions for server management
 */
export const serverManagementUtils = {
  // Format memory/disk sizes
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  },

  // Format pricing
  formatPrice: (price: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price)
  },

  // Get capacity status color
  getCapacityStatusColor: (status: string): string => {
    switch (status) {
      case 'available':
        return 'text-green-500'
      case 'limited':
        return 'text-yellow-500'
      case 'full':
        return 'text-red-500'
      case 'maintenance':
        return 'text-gray-500'
      default:
        return 'text-gray-400'
    }
  },

  // Get capacity status badge
  getCapacityStatusBadge: (status: string) => {
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

  // Calculate estimated monthly cost
  calculateMonthlyCost: (hourlyPrice: number): number => {
    return hourlyPrice * 24 * 30 // 30 days
  },

  // Validate server name
  validateServerName: (name: string): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Server name is required' }
    }
    if (name.length < 3) {
      return { valid: false, error: 'Server name must be at least 3 characters' }
    }
    if (name.length > 50) {
      return { valid: false, error: 'Server name must be less than 50 characters' }
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return { valid: false, error: 'Server name can only contain letters, numbers, spaces, hyphens, and underscores' }
    }
    return { valid: true }
  },

  // Get server type icon
  getServerTypeIcon: (category: string): string => {
    switch (category.toLowerCase()) {
      case 'minecraft':
        return '🎮'
      case 'discord':
        return '🤖'
      case 'web':
        return '🌐'
      case 'database':
        return '🗄️'
      case 'game':
        return '🎯'
      default:
        return '⚙️'
    }
  },

  // Check if plan is recommended
  isPlanRecommended: (plan: any): boolean => {
    return plan.popular || plan.featured || false
  },

  // Get plan recommendation reason
  getPlanRecommendationReason: (plan: any): string | null => {
    if (plan.popular && plan.featured) {
      return 'Most Popular & Featured'
    } else if (plan.popular) {
      return 'Most Popular'
    } else if (plan.featured) {
      return 'Featured'
    }
    return null
  }
}
