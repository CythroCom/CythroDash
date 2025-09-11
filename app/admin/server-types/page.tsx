"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminServerTypesStore } from '@/stores/admin-server-types-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Edit, Trash2, Server, Star, TrendingUp } from 'lucide-react'
import { ServerTypeCategory, ServerTypeStatus } from '@/database/tables/cythro_dash_server_types'
import { showSuccess, showError } from '@/lib/toast'
import type { CreateServerTypeData, UpdateServerTypeData } from '@/stores/admin-server-types-store'
import type { CythroDashServerType } from '@/database/tables/cythro_dash_server_types'

interface ServerTypeCardProps {
  serverType: CythroDashServerType
  onEdit: (serverType: CythroDashServerType) => void
  onDelete: (id: string) => void
  getStatusColor: (status: ServerTypeStatus) => string
  getCategoryColor: (category: ServerTypeCategory) => string
}

const ServerTypeCard = ({ serverType, onEdit, onDelete, getStatusColor, getCategoryColor }: ServerTypeCardProps) => (
  <Card className="border-neutral-700/50 bg-neutral-800/40">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {serverType.display_config?.icon && (
              <img
                src={serverType.display_config.icon}
                alt={`${serverType.name} icon`}
                className="w-8 h-8 object-cover rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <h3 className="text-lg font-semibold text-white">{serverType.name}</h3>
            <Badge className={getStatusColor(serverType.status)}>{serverType.status}</Badge>
            <Badge className={getCategoryColor(serverType.category)}>{serverType.category}</Badge>
            {serverType.featured && <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><Star className="h-3 w-3 mr-1" />Featured</Badge>}
            {serverType.popular && <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20"><TrendingUp className="h-3 w-3 mr-1" />Popular</Badge>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-neutral-400">Pterodactyl Nest ID</p>
              <p className="text-white font-mono">{serverType.pterodactyl_nest_id}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Display Order</p>
              <p className="text-white">{serverType.display_order || 'Default'}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Min Resources</p>
              <p className="text-white text-sm">
                {serverType.resource_requirements.min_memory}MB RAM, {serverType.resource_requirements.min_disk}MB Disk, {serverType.resource_requirements.min_cpu} CPU
              </p>
            </div>
          </div>

          {serverType.description && (
            <p className="text-neutral-300 mb-4">{serverType.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-neutral-400 mb-2">Configuration</p>
              <div className="flex flex-wrap gap-1">
                {serverType.configuration?.supports_custom_jar && <Badge variant="outline" className="text-xs">Custom JAR</Badge>}
                {serverType.configuration?.supports_plugins && <Badge variant="outline" className="text-xs">Plugins</Badge>}
                {serverType.configuration?.supports_mods && <Badge variant="outline" className="text-xs">Mods</Badge>}
                {serverType.configuration?.auto_start && <Badge variant="outline" className="text-xs">Auto Start</Badge>}
                {serverType.configuration?.crash_detection && <Badge variant="outline" className="text-xs">Crash Detection</Badge>}
              </div>
            </div>
            <div>
              <p className="text-sm text-neutral-400 mb-2">Access</p>
              <div className="flex flex-wrap gap-1">
                {serverType.access_restrictions?.requires_verification && <Badge variant="outline" className="text-xs">Verification Required</Badge>}
                {serverType.access_restrictions?.max_servers_per_user && (
                  <Badge variant="outline" className="text-xs">
                    Max: {serverType.access_restrictions.max_servers_per_user} servers
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(serverType)}
            className="border-neutral-600 hover:bg-neutral-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(serverType.id)}
            className="border-red-600 hover:bg-red-700 text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)

interface ServerTypeFormProps {
  initialData?: CythroDashServerType
  onSubmit: (data: CreateServerTypeData | UpdateServerTypeData) => void
}

const ServerTypeForm = ({ initialData, onSubmit }: ServerTypeFormProps) => {
  const [formData, setFormData] = useState<CreateServerTypeData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    short_description: initialData?.short_description || '',
    category: initialData?.category || ServerTypeCategory.GAMING,
    pterodactyl_nest_id: initialData?.pterodactyl_nest_id || 0,
    display_order: initialData?.display_order || 0,
    featured: initialData?.featured || false,
    popular: initialData?.popular || false,
    resource_requirements: {
      min_memory: initialData?.resource_requirements?.min_memory || 512,
      min_disk: initialData?.resource_requirements?.min_disk || 1024,
      min_cpu: initialData?.resource_requirements?.min_cpu || 1,
    },
    display_config: {
      icon: initialData?.display_config?.icon || '',
      color: initialData?.display_config?.color || '',
      banner_image: initialData?.display_config?.banner_image || '',
      thumbnail: initialData?.display_config?.thumbnail || '',
    },
    access_restrictions: {
      min_user_role: initialData?.access_restrictions?.min_user_role || 1,
      requires_verification: initialData?.access_restrictions?.requires_verification || false,
      max_servers_per_user: initialData?.access_restrictions?.max_servers_per_user || 0,
    },
    configuration: {
      supports_custom_jar: initialData?.configuration?.supports_custom_jar || false,
      supports_plugins: initialData?.configuration?.supports_plugins || false,
      supports_mods: initialData?.configuration?.supports_mods || false,
      supports_custom_startup: initialData?.configuration?.supports_custom_startup || false,
      auto_start: initialData?.configuration?.auto_start || false,
      crash_detection: initialData?.configuration?.crash_detection || false,
    }
  })

  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)

  // Test image URL validity
  const testImageUrl = (url: string, callback: (isValid: boolean) => void) => {
    if (!url) {
      callback(false)
      return
    }
    const img = document.createElement('img')
    img.onload = () => callback(true)
    img.onerror = () => callback(false)
    img.src = url
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name" className="text-neutral-200">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            required
          />
        </div>
        <div>
          <Label htmlFor="category" className="text-neutral-200">Category *</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as ServerTypeCategory }))}>
            <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value={ServerTypeCategory.GAMING}>Gaming</SelectItem>
              <SelectItem value={ServerTypeCategory.BOTS}>Bots</SelectItem>
              <SelectItem value={ServerTypeCategory.WEB}>Web</SelectItem>
              <SelectItem value={ServerTypeCategory.DATABASE}>Database</SelectItem>
              <SelectItem value={ServerTypeCategory.OTHER}>Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description" className="text-neutral-200">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="bg-neutral-700/50 border-neutral-600/50"
        />
      </div>

      <div>
        <Label htmlFor="short_description" className="text-neutral-200">Short Description</Label>
        <Input
          id="short_description"
          value={formData.short_description}
          onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
          className="bg-neutral-700/50 border-neutral-600/50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pterodactyl_nest_id" className="text-neutral-200">Pterodactyl Nest ID *</Label>
          <Input
            id="pterodactyl_nest_id"
            type="number"
            value={formData.pterodactyl_nest_id}
            onChange={(e) => setFormData(prev => ({ ...prev, pterodactyl_nest_id: parseInt(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            required
          />
        </div>
        <div>
          <Label htmlFor="display_order" className="text-neutral-200">Display Order</Label>
          <Input
            id="display_order"
            type="number"
            value={formData.display_order}
            onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="featured"
            checked={formData.featured}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked as boolean }))}
          />
          <Label htmlFor="featured" className="text-neutral-300">Featured</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="popular"
            checked={formData.popular}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, popular: checked as boolean }))}
          />
          <Label htmlFor="popular" className="text-neutral-300">Popular</Label>
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Resource Requirements</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="min_memory" className="text-neutral-200">Min Memory (MB)</Label>
            <Input
              id="min_memory"
              type="number"
              value={formData.resource_requirements.min_memory}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resource_requirements: { ...prev.resource_requirements, min_memory: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="min_disk" className="text-neutral-200">Min Disk (MB)</Label>
            <Input
              id="min_disk"
              type="number"
              value={formData.resource_requirements.min_disk}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resource_requirements: { ...prev.resource_requirements, min_disk: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="min_cpu" className="text-neutral-200">Min CPU</Label>
            <Input
              id="min_cpu"
              type="number"
              value={formData.resource_requirements.min_cpu}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resource_requirements: { ...prev.resource_requirements, min_cpu: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>
      </div>

      {/* Display Configuration */}
      <div>
        <Label className="text-neutral-200 mb-3 block">Display Configuration</Label>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="icon_url" className="text-neutral-200">Icon URL</Label>
              <Input
                id="icon_url"
                type="url"
                placeholder="https://example.com/icon.png"
                value={formData.display_config?.icon || ''}
                onChange={(e) => {
                  const url = e.target.value
                  setFormData(prev => ({
                    ...prev,
                    display_config: { ...prev.display_config, icon: url }
                  }))
                  if (url) {
                    testImageUrl(url, (isValid) => {
                      setIconPreview(isValid ? url : null)
                    })
                  } else {
                    setIconPreview(null)
                  }
                }}
                className="bg-neutral-700/50 border-neutral-600/50"
              />
              <p className="text-xs text-neutral-400 mt-1">Small icon (32x32px recommended) for lists and dropdowns</p>
            </div>
            <div>
              <Label htmlFor="banner_url" className="text-neutral-200">Banner Image URL</Label>
              <Input
                id="banner_url"
                type="url"
                placeholder="https://example.com/banner.jpg"
                value={formData.display_config?.banner_image || ''}
                onChange={(e) => {
                  const url = e.target.value
                  setFormData(prev => ({
                    ...prev,
                    display_config: { ...prev.display_config, banner_image: url }
                  }))
                  if (url) {
                    testImageUrl(url, (isValid) => {
                      setBannerPreview(isValid ? url : null)
                    })
                  } else {
                    setBannerPreview(null)
                  }
                }}
                className="bg-neutral-700/50 border-neutral-600/50"
              />
              <p className="text-xs text-neutral-400 mt-1">Card background (300x200px recommended) for server type cards</p>
            </div>
          </div>

          <div>
            <Label htmlFor="color" className="text-neutral-200">Theme Color</Label>
            <Input
              id="color"
              type="text"
              placeholder="#3b82f6"
              value={formData.display_config?.color || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                display_config: { ...prev.display_config, color: e.target.value }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
            <p className="text-xs text-neutral-400 mt-1">Hex color code for theme accents</p>
          </div>

          {/* Preview Section */}
          {(iconPreview || bannerPreview) && (
            <div className="border border-neutral-600 rounded-lg p-4">
              <p className="text-sm text-neutral-400 mb-3">Preview:</p>
              <div className="space-y-3">
                {iconPreview && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Icon Preview:</p>
                    <div className="flex items-center gap-2">
                      <img src={iconPreview} alt="Icon preview" className="w-8 h-8 object-cover rounded" />
                      <span className="text-white">{formData.name || 'Server Type Name'}</span>
                    </div>
                  </div>
                )}
                {bannerPreview && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Banner Preview:</p>
                    <div
                      className="relative h-24 rounded-lg overflow-hidden bg-cover bg-center"
                      style={{ backgroundImage: `url(${bannerPreview})` }}
                    >
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-semibold">{formData.name || 'Server Type Name'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Configuration</Label>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries({
            supports_custom_jar: 'Custom JAR Support',
            supports_plugins: 'Plugin Support',
            supports_mods: 'Mod Support',
            supports_custom_startup: 'Custom Startup',
            auto_start: 'Auto Start',
            crash_detection: 'Crash Detection'
          }).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={formData.configuration?.[key as keyof typeof formData.configuration] || false}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    configuration: { ...prev.configuration, [key]: checked }
                  }))
                }
              />
              <Label htmlFor={key} className="text-neutral-300">{label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Access Restrictions</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="min_user_role" className="text-neutral-200">Min User Role</Label>
            <Input
              id="min_user_role"
              type="number"
              value={formData.access_restrictions?.min_user_role}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                access_restrictions: { ...prev.access_restrictions, min_user_role: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="max_servers_per_user" className="text-neutral-200">Max Servers Per User</Label>
            <Input
              id="max_servers_per_user"
              type="number"
              value={formData.access_restrictions?.max_servers_per_user}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                access_restrictions: { ...prev.access_restrictions, max_servers_per_user: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requires_verification"
              checked={formData.access_restrictions?.requires_verification || false}
              onCheckedChange={(checked) =>
                setFormData(prev => ({
                  ...prev,
                  access_restrictions: { ...prev.access_restrictions, requires_verification: checked as boolean }
                }))
              }
            />
            <Label htmlFor="requires_verification" className="text-neutral-300">Requires Verification</Label>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="bg-neutral-700 hover:bg-neutral-600">
          {initialData ? 'Update Server Type' : 'Create Server Type'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function AdminServerTypes() {
  const router = useRouter()
  const { isLoading, hasAccess } = useAdminGuard()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingServerType, setEditingServerType] = useState<CythroDashServerType | null>(null)

  const {
    serverTypesList,
    serverTypesListPagination,
    serverTypesListStats,
    isLoadingServerTypesList,
    getServerTypesList,
    createServerType,
    updateServerType,
    deleteServerType
  } = useAdminServerTypesStore()

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const fetchServerTypes = useCallback(async () => {
    await getServerTypesList({ search: searchQuery, include_stats: true })
  }, [getServerTypesList, searchQuery])

  useEffect(() => {
    if (hasAccess) {
      fetchServerTypes()
    }
  }, [hasAccess, fetchServerTypes])

  const handleCreateServerType = async (data: CreateServerTypeData) => {
    try {
      const response = await createServerType(data)
      if (response.success) {
        showSuccess('Server type created successfully')
        setIsCreateDialogOpen(false)
        fetchServerTypes()
      } else {
        showError(response.message || 'Failed to create server type')
      }
    } catch (error) {
      showError('Failed to create server type')
    }
  }

  const handleUpdateServerType = async (id: string, data: UpdateServerTypeData) => {
    try {
      const response = await updateServerType(id, data)
      if (response.success) {
        showSuccess('Server type updated successfully')
        setIsEditDialogOpen(false)
        setEditingServerType(null)
        fetchServerTypes()
      } else {
        showError(response.message || 'Failed to update server type')
      }
    } catch (error) {
      showError('Failed to update server type')
    }
  }

  const handleDeleteServerType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server type?')) return
    
    try {
      const response = await deleteServerType(id)
      if (response.success) {
        showSuccess('Server type deleted successfully')
        fetchServerTypes()
      } else {
        showError(response.message || 'Failed to delete server type')
      }
    } catch (error) {
      showError('Failed to delete server type')
    }
  }

  const getStatusColor = (status: ServerTypeStatus) => {
    switch (status) {
      case ServerTypeStatus.ACTIVE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case ServerTypeStatus.MAINTENANCE: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case ServerTypeStatus.DISABLED: return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }

  const getCategoryColor = (category: ServerTypeCategory) => {
    switch (category) {
      case ServerTypeCategory.GAMING: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case ServerTypeCategory.BOTS: return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case ServerTypeCategory.WEB: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case ServerTypeCategory.DATABASE: return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case ServerTypeCategory.OTHER: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <AdminLayout
      title="Server Type Management"
      subtitle="Manage server types and configurations"
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
    >
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search server types..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80 bg-neutral-800/50 border-neutral-700/50"
                />
              </div>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-neutral-700 hover:bg-neutral-600 border border-neutral-600/40">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Server Type
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-800 border-neutral-700 max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Server Type</DialogTitle>
                  <DialogDescription className="text-neutral-400">
                    Add a new server type to the system
                  </DialogDescription>
                </DialogHeader>
                <ServerTypeForm onSubmit={(data) => { void handleCreateServerType(data as CreateServerTypeData) }} />
              </DialogContent>
            </Dialog>
          </div>

          {serverTypesListStats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Total Types</CardTitle>
                  <Server className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverTypesListStats.total_types}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Active</CardTitle>
                  <TrendingUp className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverTypesListStats.active_types}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Featured</CardTitle>
                  <Star className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverTypesListStats.featured_types}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Gaming</CardTitle>
                  <Server className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverTypesListStats.gaming_types}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Disabled</CardTitle>
                  <Server className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverTypesListStats.disabled_types}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {isLoadingServerTypesList ? (
              [...Array(3)].map((_, i) => (
                <Card key={i} className="border-neutral-700/50 bg-neutral-800/40">
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-neutral-700 rounded w-1/4"></div>
                      <div className="h-6 bg-neutral-700 rounded w-1/2"></div>
                      <div className="h-4 bg-neutral-700 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : serverTypesList.length === 0 ? (
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardContent className="p-6 text-center">
                  <p className="text-neutral-400">No server types found</p>
                </CardContent>
              </Card>
            ) : (
              serverTypesList.map((serverType) => (
                <ServerTypeCard
                  key={serverType.id}
                  serverType={serverType}
                  onEdit={(type) => {
                    setEditingServerType(type)
                    setIsEditDialogOpen(true)
                  }}
                  onDelete={(id) => handleDeleteServerType(id)}
                  getStatusColor={getStatusColor}
                  getCategoryColor={getCategoryColor}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-neutral-800 border-neutral-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Server Type</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update server type settings and configuration
            </DialogDescription>
          </DialogHeader>
          {editingServerType && (
            <ServerTypeForm
              initialData={editingServerType}
              onSubmit={(data) => handleUpdateServerType(editingServerType.id, data)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
