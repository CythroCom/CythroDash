/**
 * CythroDash - Admin Integration Settings Store
 * 
 * Manages integration settings state and API calls for admin users
 */

import React from 'react'
import { create } from 'zustand'
import { useAuthStore } from './user-store'

export interface IntegrationSettings {
  discord: {
    enabled: boolean
    login: boolean
    clientId: string
    clientSecret: string
    botToken: string
    redirectUri: string
  }
  github: {
    enabled: boolean
    login: boolean
    clientId: string
    clientSecret: string
    redirectUri: string
  }
  pterodactyl: {
    panelUrl: string
    apiKey: string
  }
}

interface AdminIntegrationsState {
  // State
  settings: IntegrationSettings | null
  loading: boolean
  initialized: boolean
  error: string | null
  
  // Actions
  loadSettings: () => Promise<void>
  updateSetting: (service: string, key: string, value: any) => Promise<boolean>
  refreshSettings: () => Promise<void>
  clearError: () => void
}

// Helper function to get admin auth headers
function getAdminAuthHeaders(): HeadersInit {
  const base: HeadersInit = { 'Content-Type': 'application/json' }
  try {
    const currentUser = useAuthStore.getState().currentUser
    if (currentUser && currentUser.id && currentUser.username && currentUser.email) {
      return { 
        ...base, 
        'x-user-data': encodeURIComponent(JSON.stringify({ 
          id: currentUser.id, 
          username: currentUser.username, 
          email: currentUser.email, 
          role: currentUser.role 
        })) 
      }
    }
  } catch {}
  return base
}

export const useAdminIntegrationsStore = create<AdminIntegrationsState>((set, get) => ({
  // Initial state
  settings: null,
  loading: false,
  initialized: false,
  error: null,

  // Load integration settings from API
  loadSettings: async () => {
    const state = get()
    
    // Prevent duplicate calls
    if (state.loading || state.initialized) {
      console.log('Integration settings already loading or initialized, skipping duplicate call')
      return
    }

    set({ loading: true, error: null })

    try {
      const headers = getAdminAuthHeaders()
      console.log('Loading integration settings with headers:', { 
        ...headers, 
        'x-user-data': (headers as any)['x-user-data'] ? '[REDACTED]' : undefined 
      })

      const response = await fetch('/api/admin/integrations', {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      console.log('Integration settings response status:', response.status)
      const result = await response.json()

      if (result.success) {
        set({ 
          settings: result.data, 
          initialized: true, 
          loading: false,
          error: null
        })
        console.log('Integration settings loaded successfully')
      } else {
        console.error('Failed to load integration settings:', result.message)
        set({ 
          error: result.message || 'Failed to load integration settings',
          loading: false
        })
      }
    } catch (error) {
      console.error('Failed to load integration settings:', error)
      set({ 
        error: 'Network error occurred',
        loading: false
      })
    }
  },

  // Update a specific integration setting
  updateSetting: async (service: string, key: string, value: any): Promise<boolean> => {
    const state = get()
    if (!state.settings) return false

    try {
      const headers = getAdminAuthHeaders()
      const response = await fetch('/api/admin/integrations', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ service, key, value })
      })

      const result = await response.json()

      if (result.success) {
        // Update local state optimistically
        const updatedSettings = { ...state.settings }
        if (updatedSettings[service as keyof IntegrationSettings]) {
          (updatedSettings[service as keyof IntegrationSettings] as any)[key] = value
        }
        
        set({ settings: updatedSettings, error: null })
        console.log(`Integration setting updated: ${service}.${key}`)
        return true
      } else {
        console.error('Failed to update integration setting:', result.message)
        set({ error: result.message || 'Failed to update setting' })
        return false
      }
    } catch (error) {
      console.error('Integration setting update error:', error)
      set({ error: 'Network error occurred' })
      return false
    }
  },

  // Refresh settings (force reload)
  refreshSettings: async () => {
    set({ initialized: false, loading: false })
    await get().loadSettings()
  },

  // Clear error state
  clearError: () => {
    set({ error: null })
  }
}))

// Hook for easy access to integration settings
export const useIntegrationSettings = () => {
  const store = useAdminIntegrationsStore()

  // Auto-load settings when hook is first used
  React.useEffect(() => {
    const currentUser = useAuthStore.getState().currentUser
    console.log('useIntegrationSettings effect:', {
      currentUser: !!currentUser,
      initialized: store.initialized,
      loading: store.loading
    })

    if (currentUser && !store.initialized && !store.loading) {
      console.log('Triggering loadSettings from hook')
      store.loadSettings()
    }
  }, [store.initialized, store.loading, store.loadSettings])

  return store
}
