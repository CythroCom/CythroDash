"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminServerSoftwareStore } from '@/stores/admin-server-software-store'
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
import { Plus, Search, Edit, Trash2, Package, Star, TrendingUp, Code } from 'lucide-react'
import { SoftwareStability, SoftwareStatus } from '@/database/tables/cythro_dash_server_software'
import { showSuccess, showError } from '@/lib/toast'
import type { CreateServerSoftwareData, UpdateServerSoftwareData } from '@/stores/admin-server-software-store'
import type { CythroDashServerSoftware } from '@/database/tables/cythro_dash_server_software'

interface ServerSoftwareCardProps {
  software: CythroDashServerSoftware
  onEdit: (software: CythroDashServerSoftware) => void
  onDelete: (id: string) => void
  getStatusColor: (status: SoftwareStatus) => string
  getStabilityColor: (stability: SoftwareStability) => string
}

const ServerSoftwareCard = ({ software, onEdit, onDelete, getStatusColor, getStabilityColor }: ServerSoftwareCardProps) => (
  <Card className="border-neutral-700/50 bg-neutral-800/40">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{software.name}</h3>
            <Badge className={getStatusColor(software.status)}>{software.status}</Badge>
            <Badge className={getStabilityColor(software.stability)}>{software.stability}</Badge>
            {software.recommended && <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><Star className="h-3 w-3 mr-1" />Recommended</Badge>}
            {software.latest && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Code className="h-3 w-3 mr-1" />Latest</Badge>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-neutral-400">Version</p>
              <p className="text-white font-mono">{software.version_info.version}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Pterodactyl Egg ID</p>
              <p className="text-white">{software.pterodactyl_egg_id}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Display Order</p>
              <p className="text-white">{software.display_order || 'Default'}</p>
            </div>
          </div>

          {software.description && (
            <p className="text-neutral-300 mb-4">{software.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-neutral-400 mb-2">Docker Configuration</p>
              <div className="bg-neutral-900/50 rounded p-2">
                <p className="text-xs text-neutral-300 font-mono">{software.docker_config.image}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-neutral-400 mb-2">Environment Variables</p>
              <div className="flex flex-wrap gap-1">
                {software.environment_variables?.slice(0, 3).map((env, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">{env.name}</Badge>
                ))}
                {(software.environment_variables?.length || 0) > 3 && (
                  <Badge variant="outline" className="text-xs">+{(software.environment_variables?.length || 0) - 3} more</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(software)}
            className="border-neutral-600 hover:bg-neutral-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(software.id)}
            className="border-red-600 hover:bg-red-700 text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)

interface ServerSoftwareFormProps {
  initialData?: CythroDashServerSoftware
  onSubmit: (data: CreateServerSoftwareData | UpdateServerSoftwareData) => void
}

const ServerSoftwareForm = ({ initialData, onSubmit }: ServerSoftwareFormProps) => {
  const [formData, setFormData] = useState<CreateServerSoftwareData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    short_description: initialData?.short_description || '',
    server_type_id: initialData?.server_type_id || '',
    pterodactyl_egg_id: initialData?.pterodactyl_egg_id || 0,
    version_info: {
      version: initialData?.version_info?.version || '',
      minecraft_version: initialData?.version_info?.minecraft_version || '',
      build_number: initialData?.version_info?.build_number || '',
      release_date: initialData?.version_info?.release_date || new Date(),
      changelog_url: initialData?.version_info?.changelog_url || '',
    },
    stability: initialData?.stability || SoftwareStability.STABLE,
    recommended: initialData?.recommended || false,
    latest: initialData?.latest || false,
    docker_config: {
      image: initialData?.docker_config?.image || '',
      startup_command: initialData?.docker_config?.startup_command || '',
      stop_command: initialData?.docker_config?.stop_command || '',
    },
    environment_variables: initialData?.environment_variables || [],
    display_order: initialData?.display_order || 0,
  })

  // Pterodactyl eggs integration
  const { pterodactylEggs, isLoadingPterodactylEggs, getPterodactylEggs, getEggEnvironmentVariables } = useAdminServerSoftwareStore()
  const { getServerType, serverTypesList, getServerTypesList, isLoadingServerTypesList } = useAdminServerTypesStore()
  const [isLoadingEggEnv, setIsLoadingEggEnv] = useState(false)

  // Load server types on mount
  useEffect(() => {
    void getServerTypesList({ include_stats: false })
  }, [getServerTypesList])

  // Load eggs when server type changes (fetch nest -> eggs)
  useEffect(() => {
    const loadEggs = async () => {
      if (!formData.server_type_id) return
      try {
        const res = await getServerType(formData.server_type_id)
        const nestId = (res as any)?.data?.pterodactyl_nest_id
        if (nestId) {
          await getPterodactylEggs(nestId, true)
        }
      } catch (e) {
        // No-op; UI will show empty eggs
      }
    }
    void loadEggs()
  }, [formData.server_type_id, getServerType, getPterodactylEggs])

  const handleEggSelect = async (value: string) => {
    const eggId = Number(value)
    setFormData(prev => ({ ...prev, pterodactyl_egg_id: eggId }))

    const egg = pterodactylEggs.find(e => e.id === eggId)
    if (egg) {
      setFormData(prev => ({
        ...prev,
        // If name is empty, use egg name as a sensible default
        name: prev.name || egg.name || prev.name,
        docker_config: {
          ...prev.docker_config,
          image: egg.docker_image || prev.docker_config.image,
          startup_command: egg.startup || prev.docker_config.startup_command
        }
      }))
    }

    setIsLoadingEggEnv(true)
    const envRes = await getEggEnvironmentVariables(eggId)
    setIsLoadingEggEnv(false)
    if (envRes.success && envRes.data) {
      setFormData(prev => ({ ...prev, environment_variables: envRes.data }))
      showSuccess('Environment variables populated from Pterodactyl egg')
    } else {
      showError(envRes.message || 'Failed to load environment variables for selected egg')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = structuredClone(formData)
    if (Array.isArray(data.environment_variables)) {
      data.environment_variables = data.environment_variables
        .filter((v: any) => v && v.name && v.display_name)
        .map((v: any) => ({
          ...v,
          select_options: v.field_type === 'select' ? (v.select_options || []) : undefined,
          user_viewable: v.user_viewable !== false,
          user_editable: v.user_editable !== false,
        }))
    }
    onSubmit(data)
  }

  const addEnvironmentVariable = () => {
    setFormData(prev => ({
      ...prev,
      environment_variables: [
        ...(prev.environment_variables || []),
        {
          name: '',
          display_name: '',
          description: '',
          default_value: '',
          user_viewable: true,
          user_editable: true,
          field_type: 'text' as const,
          validation_rules: '',
          select_options: []
        }
      ]
    }))
  }

  const removeEnvironmentVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables?.filter((_, i) => i !== index) || []
    }))
  }

  const updateEnvironmentVariable = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables?.map((env, i) =>
        i === index ? { ...env, [field]: value } : env
      ) || []
    }))
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
          <Label className="text-neutral-200">Server Type *</Label>
          <Select
            value={formData.server_type_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, server_type_id: value }))}
            disabled={isLoadingServerTypesList}
          >
            <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
              <SelectValue placeholder={isLoadingServerTypesList ? "Loading server types..." : "Select a server type"} />
            </SelectTrigger>
            <SelectContent>
              {serverTypesList.map((serverType) => (
                <SelectItem key={serverType.id} value={serverType.id}>
                  {serverType.name} ({serverType.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      <div>
        <Label className="text-neutral-200">Pterodactyl Egg</Label>
        <Select
          disabled={!formData.server_type_id || isLoadingPterodactylEggs}
          value={formData.pterodactyl_egg_id ? String(formData.pterodactyl_egg_id) : undefined}
          onValueChange={handleEggSelect}
        >
          <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
            <SelectValue placeholder={
              !formData.server_type_id ? 'Enter server type ID to load eggs' :
              (isLoadingPterodactylEggs ? 'Loading eggs...' : (pterodactylEggs.length ? 'Select an egg' : 'No eggs found'))
            } />
          </SelectTrigger>
          <SelectContent>
            {pterodactylEggs.map((egg) => (
              <SelectItem key={egg.id} value={String(egg.id)}>
                {egg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-neutral-400 mt-1">
          {isLoadingEggEnv
            ? 'Loading environment variables from selected egg...'
            : (formData.environment_variables?.length
                ? `${formData.environment_variables.length} variables loaded from egg`
                : 'Selecting an egg will auto-populate environment variables')}
        </p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="pterodactyl_egg_id" className="text-neutral-200">Pterodactyl Egg ID *</Label>
          <Input
            id="pterodactyl_egg_id"
            type="number"
            value={formData.pterodactyl_egg_id}
            onChange={(e) => setFormData(prev => ({ ...prev, pterodactyl_egg_id: parseInt(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            required
          />
        </div>
        <div>
          <Label htmlFor="stability" className="text-neutral-200">Stability</Label>
          <Select value={formData.stability} onValueChange={(value) => setFormData(prev => ({ ...prev, stability: value as SoftwareStability }))}>
            <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value={SoftwareStability.STABLE}>Stable</SelectItem>
              <SelectItem value={SoftwareStability.BETA}>Beta</SelectItem>
              <SelectItem value={SoftwareStability.ALPHA}>Alpha</SelectItem>
              <SelectItem value={SoftwareStability.EXPERIMENTAL}>Experimental</SelectItem>
            </SelectContent>
          </Select>
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
            id="recommended"
            checked={formData.recommended}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, recommended: checked as boolean }))}
          />
          <Label htmlFor="recommended" className="text-neutral-300">Recommended</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="latest"
            checked={formData.latest}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, latest: checked as boolean }))}
          />
          <Label htmlFor="latest" className="text-neutral-300">Latest</Label>
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Version Information</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="version" className="text-neutral-200">Version *</Label>
            <Input
              id="version"
              value={formData.version_info.version}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                version_info: { ...prev.version_info, version: e.target.value }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
              required
            />
          </div>
          <div>
            <Label htmlFor="build_number" className="text-neutral-200">Build Number</Label>
            <Input
              id="build_number"
              value={formData.version_info.build_number}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                version_info: { ...prev.version_info, build_number: e.target.value }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="release_date" className="text-neutral-200">Release Date</Label>
            <Input
              id="release_date"
              type="date"
              value={formData.version_info.release_date ? new Date(formData.version_info.release_date).toISOString().split('T')[0] : ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                version_info: { ...prev.version_info, release_date: new Date(e.target.value) }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="changelog_url" className="text-neutral-200">Changelog URL</Label>
            <Input
              id="changelog_url"
              value={formData.version_info.changelog_url}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                version_info: { ...prev.version_info, changelog_url: e.target.value }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Docker Configuration</Label>
        <div className="space-y-4">
          <div>
            <Label htmlFor="docker_image" className="text-neutral-200">Docker Image *</Label>
            <Input
              id="docker_image"
              value={formData.docker_config.image}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                docker_config: { ...prev.docker_config, image: e.target.value }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
              required
            />
          </div>
          <div>
            <Label htmlFor="startup_command" className="text-neutral-200">Startup Command</Label>
            <Input
              id="startup_command"
              value={formData.docker_config.startup_command}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                docker_config: { ...prev.docker_config, startup_command: e.target.value }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-neutral-200">Environment Variables</Label>
          <Button type="button" onClick={addEnvironmentVariable} variant="outline" size="sm" className="border-neutral-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>
        </div>
        <div className="space-y-3">
          {formData.environment_variables?.map((env, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-neutral-600 rounded">
              <Input
                placeholder="Variable name"
                value={env.name}
                onChange={(e) => updateEnvironmentVariable(index, 'name', e.target.value)}
                className="bg-neutral-700/50 border-neutral-600/50"
              />
              <Input
                placeholder="Display name"
                value={env.display_name}
                onChange={(e) => updateEnvironmentVariable(index, 'display_name', e.target.value)}
                className="bg-neutral-700/50 border-neutral-600/50"
              />
              <Input
                placeholder="Default value"
                value={env.default_value}
                onChange={(e) => updateEnvironmentVariable(index, 'default_value', e.target.value)}
                className="bg-neutral-700/50 border-neutral-600/50"
              />
              <Select value={env.field_type} onValueChange={(val) => updateEnvironmentVariable(index, 'field_type', val)}>
                <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
                  <SelectValue placeholder="Field type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!env.user_viewable}
                  onCheckedChange={(checked) => updateEnvironmentVariable(index, 'user_viewable', Boolean(checked))}
                />
                <Label className="text-neutral-300 text-sm">User Viewable</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!env.user_editable}
                  onCheckedChange={(checked) => updateEnvironmentVariable(index, 'user_editable', Boolean(checked))}
                />
                <Label className="text-neutral-300 text-sm">User Editable</Label>
              </div>
              <Input
                placeholder="Description (optional)"
                value={env.description || ''}
                onChange={(e) => updateEnvironmentVariable(index, 'description', e.target.value)}
                className="md:col-span-3 bg-neutral-700/50 border-neutral-600/50"
              />
              <Input
                placeholder="Validation rules (regex) optional"
                value={env.validation_rules || ''}
                onChange={(e) => updateEnvironmentVariable(index, 'validation_rules', e.target.value)}
                className="md:col-span-2 bg-neutral-700/50 border-neutral-600/50"
              />
              {env.field_type === 'select' && (
                <Input
                  placeholder="Select options (comma-separated)"
                  value={(env.select_options || []).join(',')}
                  onChange={(e) => updateEnvironmentVariable(index, 'select_options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="md:col-span-3 bg-neutral-700/50 border-neutral-600/50"
                />
              )}
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  onClick={() => removeEnvironmentVariable(index)}
                  variant="outline"
                  size="sm"
                  className="border-red-600 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="bg-neutral-700 hover:bg-neutral-600">
          {initialData ? 'Update Software' : 'Create Software'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function AdminServerSoftware() {
  const router = useRouter()
  const { isLoading, hasAccess } = useAdminGuard()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSoftware, setEditingSoftware] = useState<CythroDashServerSoftware | null>(null)

  const {
    serverSoftwareList,
    serverSoftwareListPagination,
    serverSoftwareListStats,
    isLoadingServerSoftwareList,
    getServerSoftwareList,
    createServerSoftware,
    updateServerSoftware,
    deleteServerSoftware
  } = useAdminServerSoftwareStore()

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const fetchServerSoftware = useCallback(async () => {
    await getServerSoftwareList({ search: searchQuery, include_stats: true })
  }, [getServerSoftwareList, searchQuery])

  useEffect(() => {
    if (hasAccess) {
      fetchServerSoftware()
    }
  }, [hasAccess, fetchServerSoftware])

  const handleCreateSoftware = async (data: CreateServerSoftwareData) => {
    try {
      const response = await createServerSoftware(data)
      if (response.success) {
        showSuccess('Server software created successfully')
        setIsCreateDialogOpen(false)
        fetchServerSoftware()
      } else {
        showError(response.message || 'Failed to create server software')
      }
    } catch (error) {
      showError('Failed to create server software')
    }
  }

  const handleUpdateSoftware = async (id: string, data: UpdateServerSoftwareData) => {
    try {
      const response = await updateServerSoftware(id, data)
      if (response.success) {
        showSuccess('Server software updated successfully')
        setIsEditDialogOpen(false)
        setEditingSoftware(null)
        fetchServerSoftware()
      } else {
        showError(response.message || 'Failed to update server software')
      }
    } catch (error) {
      showError('Failed to update server software')
    }
  }

  const handleDeleteSoftware = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server software?')) return

    try {
      const response = await deleteServerSoftware(id)
      if (response.success) {
        showSuccess('Server software deleted successfully')
        fetchServerSoftware()
      } else {
        showError(response.message || 'Failed to delete server software')
      }
    } catch (error) {
      showError('Failed to delete server software')
    }
  }

  const getStatusColor = (status: SoftwareStatus) => {
    switch (status) {
      case SoftwareStatus.ACTIVE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case SoftwareStatus.DEPRECATED: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case SoftwareStatus.DISABLED: return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }

  const getStabilityColor = (stability: SoftwareStability) => {
    switch (stability) {
      case SoftwareStability.STABLE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case SoftwareStability.BETA: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case SoftwareStability.ALPHA: return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case SoftwareStability.EXPERIMENTAL: return 'bg-red-500/10 text-red-400 border-red-500/20'
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
      title="Server Software Management"
      subtitle="Manage server software and configurations"
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
                  placeholder="Search server software..."
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
                  Create Software
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-800 border-neutral-700 max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Server Software</DialogTitle>
                  <DialogDescription className="text-neutral-400">
                    Add new server software to the system
                  </DialogDescription>
                </DialogHeader>
                <ServerSoftwareForm onSubmit={(data) => { void handleCreateSoftware(data as CreateServerSoftwareData) }} />
              </DialogContent>
            </Dialog>
          </div>

          {serverSoftwareListStats && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Total Software</CardTitle>
                  <Package className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverSoftwareListStats.total_software}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Active</CardTitle>
                  <TrendingUp className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverSoftwareListStats.active_software}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Recommended</CardTitle>
                  <Star className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverSoftwareListStats.recommended_software}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Latest</CardTitle>
                  <Code className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverSoftwareListStats.latest_software}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Beta</CardTitle>
                  <Package className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverSoftwareListStats.beta_software}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Disabled</CardTitle>
                  <Package className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serverSoftwareListStats.disabled_software}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {isLoadingServerSoftwareList ? (
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
            ) : serverSoftwareList.length === 0 ? (
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardContent className="p-6 text-center">
                  <p className="text-neutral-400">No server software found</p>
                </CardContent>
              </Card>
            ) : (
              serverSoftwareList.map((software) => (
                <ServerSoftwareCard
                  key={software.id}
                  software={software}
                  onEdit={(sw) => {
                    setEditingSoftware(sw)
                    setIsEditDialogOpen(true)
                  }}
                  onDelete={(id) => handleDeleteSoftware(id)}
                  getStatusColor={getStatusColor}
                  getStabilityColor={getStabilityColor}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-neutral-800 border-neutral-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Server Software</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update server software settings and configuration
            </DialogDescription>
          </DialogHeader>
          {editingSoftware && (
            <ServerSoftwareForm
              initialData={editingSoftware}
              onSubmit={(data) => handleUpdateSoftware(editingSoftware.id, data)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
