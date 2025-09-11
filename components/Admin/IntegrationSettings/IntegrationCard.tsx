/**
 * CythroDash - Integration Card Component
 * 
 * Individual integration service configuration card
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SecretField } from './SecretField'
import { useIntegrationSettings, type IntegrationSettings } from '@/stores/admin-integrations-store'

interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder?: string
}

interface IntegrationCardProps {
  title: string
  service: keyof IntegrationSettings
  fields: FieldConfig[]
  alwaysEnabled?: boolean
}

export function IntegrationCard({ 
  title, 
  service, 
  fields, 
  alwaysEnabled = false 
}: IntegrationCardProps) {
  const { settings, updateSetting, loading } = useIntegrationSettings()

  if (!settings) {
    return (
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-neutral-400">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const serviceSettings = settings[service]
  if (!serviceSettings) {
    return null
  }

  const handleToggleChange = async (key: string, checked: boolean) => {
    await updateSetting(service, key, checked)
  }

  const handleFieldChange = async (key: string, value: string) => {
    await updateSetting(service, key, value)
  }

  const renderField = (field: FieldConfig) => {
    const value = (serviceSettings as any)[field.key] || ''
    
    if (field.type === 'password') {
      return (
        <SecretField
          key={field.key}
          label={field.label}
          value={value}
          placeholder={field.placeholder}
          onChange={(newValue) => handleFieldChange(field.key, newValue)}
          disabled={loading}
        />
      )
    }

    return (
      <div key={field.key} className="space-y-2">
        <label className="text-sm font-medium text-neutral-300">
          {field.label}
        </label>
        <Input
          type={field.type}
          value={value}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={loading}
          className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-400 focus:border-neutral-500"
        />
      </div>
    )
  }

  return (
    <Card className="bg-neutral-900 border-neutral-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          {title}
          {!alwaysEnabled && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-normal text-neutral-400">Enabled</span>
              <Switch
                checked={(serviceSettings as any).enabled || false}
                onCheckedChange={(checked) => handleToggleChange('enabled', checked)}
                disabled={loading}
              />
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Login toggle for services that support it */}
        {!alwaysEnabled && 'login' in serviceSettings && (
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-neutral-300">
                Enable Login
              </label>
              <p className="text-xs text-neutral-500">
                Allow users to login with {service}
              </p>
            </div>
            <Switch
              checked={(serviceSettings as any).login || false}
              onCheckedChange={(checked) => handleToggleChange('login', checked)}
              disabled={loading || !(serviceSettings as any).enabled}
            />
          </div>
        )}

        {/* Configuration fields */}
        <div className="space-y-4">
          {fields.map(renderField)}
        </div>
      </CardContent>
    </Card>
  )
}
