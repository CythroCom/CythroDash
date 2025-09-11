/**
 * CythroDash - User Settings Store
 * 
 * Manages user settings, social connections, and preloading
 */

import React from 'react'
import { create } from 'zustand'
import { useAuthStore } from './user-store'
import { useIntegrationSettings } from './admin-integrations-store'

export interface SocialConnection {
  platform: 'discord' | 'github'
  connected: boolean
  username?: string
  avatar_url?: string
  user_id?: string
  connected_at?: string
}

export interface UserSettings {
  // Profile settings
  display_name?: string
  first_name?: string
  last_name?: string
  email?: string
  avatar_url?: string
  
  // Preferences
  theme?: string
  language?: string
  timezone?: string
  email_notifications?: boolean
  push_notifications?: boolean
  
  // Social connections
  social_connections: SocialConnection[]
}

interface UserSettingsState {
  // State
  settings: UserSettings | null
  loading: boolean
  initialized: boolean
  error: string | null
  
  // Actions
  loadSettings: () => Promise<void>
  updateProfile: (updates: Partial<UserSettings>) => Promise<boolean>
  connectSocial: (platform: 'discord' | 'github') => Promise<boolean>
  disconnectSocial: (platform: 'discord' | 'github') => Promise<boolean>
  refreshSettings: () => Promise<void>
  clearError: () => void
}

// Helper function to get auth headers
function getAuthHeaders(): HeadersInit {
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

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  // Initial state
  settings: null,
  loading: false,
  initialized: false,
  error: null,

  // Load user settings and social connections
  loadSettings: async () => {
    const state = get()
    
    // Prevent duplicate calls
    if (state.loading || state.initialized) {
      console.log('User settings already loading or initialized, skipping duplicate call')
      return
    }

    set({ loading: true, error: null })

    try {
      const headers = getAuthHeaders()
      
      // Load user profile
      const profileResponse = await fetch('/api/user/profile', {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      if (!profileResponse.ok) {
        throw new Error('Failed to load user profile')
      }

      const profileResult = await profileResponse.json()
      
      // Load social connections
      const socialConnections: SocialConnection[] = []
      
      // Check Discord connection
      try {
        const discordResponse = await fetch('/api/auth/discord/status', {
          method: 'GET',
          headers,
          credentials: 'include'
        })
        
        if (discordResponse.ok) {
          const discordResult = await discordResponse.json()
          socialConnections.push({
            platform: 'discord',
            connected: discordResult.connected || false,
            username: discordResult.username,
            avatar_url: discordResult.avatar_url,
            user_id: discordResult.user_id,
            connected_at: discordResult.connected_at
          })
        }
      } catch (error) {
        console.warn('Failed to load Discord connection status:', error)
        socialConnections.push({
          platform: 'discord',
          connected: false
        })
      }

      // Check GitHub connection
      try {
        const githubResponse = await fetch('/api/auth/github/status', {
          method: 'GET',
          headers,
          credentials: 'include'
        })
        
        if (githubResponse.ok) {
          const githubResult = await githubResponse.json()
          socialConnections.push({
            platform: 'github',
            connected: githubResult.connected || false,
            username: githubResult.username,
            avatar_url: githubResult.avatar_url,
            user_id: githubResult.user_id,
            connected_at: githubResult.connected_at
          })
        }
      } catch (error) {
        console.warn('Failed to load GitHub connection status:', error)
        socialConnections.push({
          platform: 'github',
          connected: false
        })
      }

      const settings: UserSettings = {
        ...profileResult.data,
        social_connections: socialConnections
      }

      set({ 
        settings, 
        initialized: true, 
        loading: false,
        error: null
      })
      
      console.log('User settings loaded successfully')
    } catch (error) {
      console.error('Failed to load user settings:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load user settings',
        loading: false
      })
    }
  },

  // Update user profile
  updateProfile: async (updates: Partial<UserSettings>): Promise<boolean> => {
    const state = get()
    if (!state.settings) return false

    try {
      const headers = getAuthHeaders()
      const response = await fetch('/api/user/update-profile', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(updates)
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        const updatedSettings = { ...state.settings, ...updates }
        set({ settings: updatedSettings, error: null })
        console.log('User profile updated successfully')
        return true
      } else {
        console.error('Failed to update user profile:', result.message)
        set({ error: result.message || 'Failed to update profile' })
        return false
      }
    } catch (error) {
      console.error('Profile update error:', error)
      set({ error: 'Network error occurred' })
      return false
    }
  },

  // Connect social account
  connectSocial: async (platform: 'discord' | 'github'): Promise<boolean> => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(`/api/auth/${platform}/connect`, {
        method: 'POST',
        headers,
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        // Refresh settings to get updated social connections
        await get().refreshSettings()
        return true
      } else {
        set({ error: result.message || `Failed to connect ${platform}` })
        return false
      }
    } catch (error) {
      console.error(`${platform} connection error:`, error)
      set({ error: 'Network error occurred' })
      return false
    }
  },

  // Disconnect social account
  disconnectSocial: async (platform: 'discord' | 'github'): Promise<boolean> => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(`/api/auth/${platform}/disconnect`, {
        method: 'POST',
        headers,
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        // Refresh settings to get updated social connections
        await get().refreshSettings()
        return true
      } else {
        set({ error: result.message || `Failed to disconnect ${platform}` })
        return false
      }
    } catch (error) {
      console.error(`${platform} disconnection error:`, error)
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

// Hook for easy access to user settings with auto-loading
export const useUserSettings = () => {
  const store = useUserSettingsStore()
  const integrationSettings = useIntegrationSettings()
  
  // Auto-load settings when hook is first used
  React.useEffect(() => {
    const currentUser = useAuthStore.getState().currentUser
    if (currentUser && !store.initialized && !store.loading) {
      console.log('Auto-loading user settings')
      store.loadSettings()
    }
  }, [store.initialized, store.loading, store.loadSettings])

  // Filter social connections based on integration settings
  const availableSocialConnections = React.useMemo(() => {
    if (!store.settings || !integrationSettings.settings) {
      return []
    }

    return store.settings.social_connections.filter(connection => {
      if (connection.platform === 'discord') {
        return integrationSettings.settings?.discord.enabled
      }
      if (connection.platform === 'github') {
        return integrationSettings.settings?.github.enabled
      }
      return false
    })
  }, [store.settings, integrationSettings.settings])

  return {
    ...store,
    availableSocialConnections
  }
}
