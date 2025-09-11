"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminSettingsStore, type Setting } from '@/stores/admin-settings-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Icon, { type IconName } from '@/components/IconProvider'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Save, Download, Upload, RefreshCw } from 'lucide-react'
import { showError, showSuccess } from '@/lib/toast'
import { useAuthStore } from '@/stores/user-store'
import { IntegrationSettings } from '@/components/Admin/IntegrationSettings'

// Integration Settings Component (now imported from components)


type CategoryConfig = {
  id: string
  label: string
  description: string
  icon: IconName
}

const categories: CategoryConfig[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Basic application settings and branding',
    icon: 'Settings'
  },
  {
    id: 'features',
    label: 'Features',
    description: 'Enable or disable dashboard features',
    icon: 'Activity'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Customize the look and feel',
    icon: 'Home'
  },
  {
    id: 'integration',
    label: 'Integration',
    description: 'Third-party service integrations',
    icon: 'Lock'
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Security and access control settings',
    icon: 'Shield'
  }
]

export default function AdminSettingsPage() {
  const { items, loading, error, fetchAll, update } = useAdminSettingsStore()
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState('general')
  const [editedValues, setEditedValues] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const settingsByCategory = React.useMemo(() => {
    return items.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = []
      }
      acc[setting.category].push(setting)
      return acc
    }, {} as Record<string, Setting[]>)
  }, [items])

  const handleValueChange = useCallback((key: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (Object.keys(editedValues).length === 0) {
      toast({
        title: "No changes",
        description: "No settings have been modified.",
      })
      return
    }

    setIsSaving(true)
    let successCount = 0
    let errorCount = 0

    for (const [key, value] of Object.entries(editedValues)) {
      const success = await update(key, value)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    }

    setIsSaving(false)
    setEditedValues({})

    if (errorCount === 0) {
      // Broadcast to all tabs that public settings changed
      try {
        if (typeof window !== 'undefined') {
          const bc = new BroadcastChannel('public-settings-updated')
          bc.postMessage({ type: 'updated' })
          bc.close()
        }
      } catch {}

      toast({
        title: "Settings saved",
        description: `Successfully updated ${successCount} setting(s).`,
      })
    } else {
      toast({
        title: "Partial success",
        description: `Updated ${successCount} setting(s), ${errorCount} failed.`,
        variant: "destructive",
      })
    }
  }, [editedValues, update, toast])

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(items, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [items])

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string)
        if (Array.isArray(importedSettings)) {
          // Set all imported values as edited
          const newEditedValues: Record<string, any> = {}
          importedSettings.forEach((setting: Setting) => {
            newEditedValues[setting.key] = setting.value
          })
          setEditedValues(newEditedValues)
          toast({
            title: "Settings imported",
            description: `Imported ${importedSettings.length} settings. Click Save to apply.`,
          })
        }
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Invalid JSON file format.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
    // Reset input
    event.target.value = ''
  }, [toast])


  const renderSettingInput = useCallback((setting: Setting) => {
    const currentValue = editedValues[setting.key] ?? setting.value
    const hasChanges = setting.key in editedValues

    switch (setting.data_type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={currentValue}
              onCheckedChange={(checked) => handleValueChange(setting.key, checked)}
            />
            <Label className={hasChanges ? 'text-neutral-200' : 'text-neutral-300'}>
              {currentValue ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        )

      case 'number':
        return (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(setting.key, Number(e.target.value))}
            className={`bg-neutral-800 border-neutral-700 text-white ${hasChanges ? 'border-neutral-500' : ''}`}
          />
        )

      case 'json':
        return (
          <Textarea
            value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleValueChange(setting.key, parsed)
              } catch {
                handleValueChange(setting.key, e.target.value)
              }
            }}
            className={`bg-neutral-800 border-neutral-700 text-white font-mono text-sm ${hasChanges ? 'border-neutral-500' : ''}`}
            rows={4}
          />
        )

      default:
        return setting.key.includes('CUSTOM_CSS') ? (
          <Textarea
            value={currentValue}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            className={`bg-neutral-800 border-neutral-700 text-white font-mono text-sm ${hasChanges ? 'border-neutral-500' : ''}`}
            rows={6}
            placeholder="/* Custom CSS styles */"
          />
        ) : (
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            className={`bg-neutral-800 border-neutral-700 text-white ${hasChanges ? 'border-neutral-500' : ''}`}
          />
        )
    }
  }, [editedValues, handleValueChange])

  if (loading && items.length === 0) {
    return (
      <AdminLayout title="Settings" subtitle="Configure application settings">
        <div className="space-y-6">
          <Skeleton className="h-12 w-full bg-neutral-800" />
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-neutral-800" />
            ))}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Settings" subtitle="Configure application settings and features">
      <div className="space-y-6">
        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || Object.keys(editedValues).length === 0}
              className="bg-neutral-700 hover:bg-neutral-600"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
              {Object.keys(editedValues).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(editedValues).length}
                </Badge>
              )}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">

            <Button
              variant="outline"
              onClick={handleExport}
              className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
            >
              <Download className="w-4 h-4 mr-2 text-neutral-300" />
              Export
            </Button>

            <Button
              variant="outline"
              onClick={() => document.getElementById('import-file')?.click()}
              className="border-neutral-600 text-neutral-300 hover:bg-neutral-800"
            >
              <Upload className="w-4 h-4 mr-2 text-neutral-300" />
              Import
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-neutral-900/60 border border-neutral-800 overflow-x-auto flex md:grid md:grid-cols-5 gap-1 p-1 rounded-lg">
            {categories.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="whitespace-nowrap flex-1 data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
              >
                <Icon name={category.icon} className="h-3.5 w-3.5 mr-2 text-neutral-300" />
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="space-y-4">
              {category.id === 'integration' ? (
                <IntegrationSettings />
              ) : (
                <Card className="bg-neutral-900/60 border border-neutral-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center">
                      <Icon name={category.icon} className="h-4 w-4 mr-2 text-neutral-300" />
                      {category.label} Settings
                    </CardTitle>
                    <CardDescription className="text-neutral-400">
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {settingsByCategory[category.id]?.map((setting) => (
                        <div key={setting.key} className="space-y-2 p-3 rounded-lg bg-neutral-900/40 border border-neutral-800">
                          <div className="flex items-center justify-between">
                            <Label className="text-neutral-300 font-medium">
                              {setting.key.replace('NEXT_PUBLIC_', '').replace(/_/g, ' ')}
                              {setting.key in editedValues && (
                                <Badge variant="outline" className="ml-2 text-neutral-300 border-neutral-500">
                                  Modified
                                </Badge>
                              )}
                            </Label>
                            <Badge variant="secondary" className="text-xs text-neutral-300 bg-neutral-800 border border-neutral-700">
                              {setting.data_type}
                            </Badge>
                          </div>
                          {setting.description && (
                            <p className="text-sm text-neutral-505">{setting.description}</p>
                          )}
                          {renderSettingInput(setting)}
                        </div>
                      ))}

                      {!settingsByCategory[category.id]?.length && (
                        <div className="text-center py-8 text-neutral-500 md:col-span-2">
                          No settings found for this category
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  )
}
