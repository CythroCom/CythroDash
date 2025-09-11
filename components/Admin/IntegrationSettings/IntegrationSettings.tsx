/**
 * CythroDash - Integration Settings Component
 * 
 * Main container for managing third-party service integrations
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { IntegrationCard } from './IntegrationCard'
import { useIntegrationSettings } from '@/stores/admin-integrations-store'

export function IntegrationSettings() {
  const { settings, loading, error, refreshSettings, clearError } = useIntegrationSettings()

  // Show loading state on initial load
  if (!settings && loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-neutral-400">Loading integration settings...</div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="text-red-400 font-medium">Error loading integration settings</div>
          <div className="text-red-300 text-sm mt-1">{error}</div>
          <div className="mt-3 flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshSettings}
              className="text-red-300 border-red-600 hover:bg-red-900/30"
            >
              Retry
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearError}
              className="text-red-300 hover:bg-red-900/30"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Integration Settings</h3>
          <p className="text-sm text-neutral-400">Configure third-party service integrations</p>
        </div>
        <Button 
          variant="outline" 
          onClick={refreshSettings}
          disabled={loading}
          className="text-neutral-300 border-neutral-600 hover:bg-neutral-800"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discord Integration */}
        <IntegrationCard
          title="Discord Integration"
          service="discord"
          fields={[
            { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Discord application client ID' },
            { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Discord application client secret' },
            { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'Discord bot token' },
            { key: 'redirectUri', label: 'Redirect URI', type: 'url', placeholder: 'OAuth redirect URI' }
          ]}
        />

        {/* GitHub Integration */}
        <IntegrationCard
          title="GitHub Integration"
          service="github"
          fields={[
            { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'GitHub OAuth app client ID' },
            { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'GitHub OAuth app client secret' },
            { key: 'redirectUri', label: 'Redirect URI', type: 'url', placeholder: 'OAuth redirect URI' }
          ]}
        />

        {/* Pterodactyl Integration - Full width */}
        <div className="lg:col-span-2">
          <IntegrationCard
            title="Pterodactyl Integration"
            service="pterodactyl"
            alwaysEnabled
            fields={[
              { key: 'panelUrl', label: 'Panel URL', type: 'url', placeholder: 'https://panel.example.com' },
              { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Pterodactyl API key' }
            ]}
          />
        </div>
      </div>
    </div>
  )
}
