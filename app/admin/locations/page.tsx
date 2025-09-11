"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminLocationsStore } from '@/stores/admin-locations-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Edit, Trash2, MapPin, Server, Activity } from 'lucide-react'
import { LocationStatus, LocationVisibility } from '@/database/tables/cythro_dash_locations'
import { showSuccess, showError } from '@/lib/toast'
import type { CreateLocationData, UpdateLocationData, AdminLocationSummary } from '@/stores/admin-locations-store'

interface LocationCardProps {
  location: AdminLocationSummary
  onEdit: (location: AdminLocationSummary) => void
  onDelete: (id: string) => void
  getStatusColor: (status: LocationStatus) => string
  getVisibilityColor: (visibility: LocationVisibility) => string
}

const LocationCard = ({ location, onEdit, onDelete, getStatusColor, getVisibilityColor }: LocationCardProps) => (
  <Card className="border-neutral-700/50 bg-neutral-800/40">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{location.name}</h3>
            <Badge className={getStatusColor(location.status)}>{location.status}</Badge>
            <Badge className={getVisibilityColor(location.visibility)}>{location.visibility}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-neutral-400">Short Code</p>
              <p className="text-white font-mono">{location.short_code}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Location</p>
              <p className="text-white">{[location.city, location.region, location.country].filter(Boolean).join(', ') || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Priority</p>
              <p className="text-white">{location.priority || 'Default'}</p>
            </div>
          </div>

          {location.description && (
            <p className="text-neutral-300 mb-4">{location.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-neutral-400 mb-2">Features</p>
              <div className="flex flex-wrap gap-1">
                {location.features?.ddos_protection && <Badge variant="outline" className="text-xs">DDoS Protection</Badge>}
                {location.features?.backup_storage && <Badge variant="outline" className="text-xs">Backup Storage</Badge>}
                {location.features?.high_availability && <Badge variant="outline" className="text-xs">High Availability</Badge>}
                {location.features?.ssd_storage && <Badge variant="outline" className="text-xs">SSD Storage</Badge>}
              </div>
            </div>
            <div>
              <p className="text-sm text-neutral-400 mb-2">Network</p>
              <div className="flex flex-wrap gap-1">
                {location.network?.ipv4_available && <Badge variant="outline" className="text-xs">IPv4</Badge>}
                {location.network?.ipv6_available && <Badge variant="outline" className="text-xs">IPv6</Badge>}
                {location.network?.port_range_start && (
                  <Badge variant="outline" className="text-xs">
                    Ports: {location.network.port_range_start}-{location.network.port_range_end}
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
            onClick={() => onEdit(location)}
            className="border-neutral-600 hover:bg-neutral-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(location.id)}
            className="border-red-600 hover:bg-red-700 text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)

interface LocationFormProps {
  initialData?: AdminLocationSummary
  onSubmit: (data: CreateLocationData) => void | Promise<void>
}

const LocationForm = ({ initialData, onSubmit }: LocationFormProps) => {
  const [formData, setFormData] = useState<CreateLocationData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    short_code: initialData?.short_code || '',
    country: initialData?.country || '',
    region: initialData?.region || '',
    city: initialData?.city || '',
    pterodactyl_location_id: initialData?.pterodactyl_location_id || 0,
    status: initialData?.status || LocationStatus.ACTIVE,
    visibility: initialData?.visibility || LocationVisibility.PUBLIC,
    priority: initialData?.priority || 0,
    max_servers_per_user: initialData?.max_servers_per_user || 0,
    features: {
      ddos_protection: initialData?.features?.ddos_protection || false,
      backup_storage: initialData?.features?.backup_storage || false,
      high_availability: initialData?.features?.high_availability || false,
      ssd_storage: initialData?.features?.ssd_storage || false,
    },
    network: {
      ipv4_available: initialData?.network?.ipv4_available || true,
      ipv6_available: initialData?.network?.ipv6_available || false,
      port_range_start: initialData?.network?.port_range_start || 25565,
      port_range_end: initialData?.network?.port_range_end || 25665,
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <Label htmlFor="short_code" className="text-neutral-200">Short Code *</Label>
          <Input
            id="short_code"
            value={formData.short_code}
            onChange={(e) => setFormData(prev => ({ ...prev, short_code: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            required
          />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="country" className="text-neutral-200">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>
        <div>
          <Label htmlFor="region" className="text-neutral-200">Region</Label>
          <Input
            id="region"
            value={formData.region}
            onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>
        <div>
          <Label htmlFor="city" className="text-neutral-200">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="pterodactyl_location_id" className="text-neutral-200">Pterodactyl Location ID *</Label>
          <Input
            id="pterodactyl_location_id"
            type="number"
            value={formData.pterodactyl_location_id}
            onChange={(e) => setFormData(prev => ({ ...prev, pterodactyl_location_id: parseInt(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            required
          />
        </div>
        <div>
          <Label htmlFor="status" className="text-neutral-200">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as LocationStatus }))}>
            <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value={LocationStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={LocationStatus.MAINTENANCE}>Maintenance</SelectItem>
              <SelectItem value={LocationStatus.DISABLED}>Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="visibility" className="text-neutral-200">Visibility</Label>
          <Select value={formData.visibility} onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value as LocationVisibility }))}>
            <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value={LocationVisibility.PUBLIC}>Public</SelectItem>
              <SelectItem value={LocationVisibility.PRIVATE}>Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority" className="text-neutral-200">Priority</Label>
          <Input
            id="priority"
            type="number"
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>
        <div>
          <Label htmlFor="max_servers_per_user" className="text-neutral-200">Max Servers Per User</Label>
          <Input
            id="max_servers_per_user"
            type="number"
            value={formData.max_servers_per_user}
            onChange={(e) => setFormData(prev => ({ ...prev, max_servers_per_user: parseInt(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Features</Label>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries({
            ddos_protection: 'DDoS Protection',
            backup_storage: 'Backup Storage',
            high_availability: 'High Availability',
            ssd_storage: 'SSD Storage'
          }).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={formData.features?.[key as keyof typeof formData.features] || false}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    features: { ...prev.features, [key]: checked }
                  }))
                }
              />
              <Label htmlFor={key} className="text-neutral-300">{label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Network Configuration</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ipv4_available"
              checked={formData.network?.ipv4_available || false}
              onCheckedChange={(checked) =>
                setFormData(prev => ({
                  ...prev,
                  network: { ...prev.network, ipv4_available: checked as boolean }
                }))
              }
            />
            <Label htmlFor="ipv4_available" className="text-neutral-300">IPv4 Available</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="ipv6_available"
              checked={formData.network?.ipv6_available || false}
              onCheckedChange={(checked) =>
                setFormData(prev => ({
                  ...prev,
                  network: { ...prev.network, ipv6_available: checked as boolean }
                }))
              }
            />
            <Label htmlFor="ipv6_available" className="text-neutral-300">IPv6 Available</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="port_range_start" className="text-neutral-200">Port Range Start</Label>
            <Input
              id="port_range_start"
              type="number"
              value={formData.network?.port_range_start || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                network: { ...prev.network, port_range_start: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="port_range_end" className="text-neutral-200">Port Range End</Label>
            <Input
              id="port_range_end"
              type="number"
              value={formData.network?.port_range_end || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                network: { ...prev.network, port_range_end: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="bg-neutral-700 hover:bg-neutral-600">
          {initialData ? 'Update Location' : 'Create Location'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function AdminLocations() {
  const router = useRouter()
  const { isLoading, hasAccess } = useAdminGuard()

  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<AdminLocationSummary | null>(null)

  const {
    locationsList,
    locationsListPagination,
    locationsListStats,
    isLoadingLocationsList,
    getLocationsList,
    createLocation,
    updateLocation,
    deleteLocation
  } = useAdminLocationsStore()


  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const fetchLocations = useCallback(async () => {
    await getLocationsList({ search: searchQuery, include_capacity: true })
  }, [getLocationsList, searchQuery])

  useEffect(() => {
    if (hasAccess) {
      fetchLocations()
    }
  }, [hasAccess, fetchLocations])

  const handleCreateLocation = async (data: CreateLocationData) => {
    try {
      const response = await createLocation(data)
      if (response.success) {
        showSuccess('Location created successfully')
        setIsCreateDialogOpen(false)
        fetchLocations()
      } else {
        showError(response.message || 'Failed to create location')
      }
    } catch (error) {
      showError('Failed to create location')
    }
  }

  const handleUpdateLocation = async (id: string, data: UpdateLocationData) => {
    try {
      const response = await updateLocation(id, data)
      if (response.success) {
        showSuccess('Location updated successfully')
        setIsEditDialogOpen(false)
        setEditingLocation(null)
        fetchLocations()
      } else {
        showError(response.message || 'Failed to update location')
      }
    } catch (error) {
      showError('Failed to update location')
    }
  }

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return
    
    try {
      const response = await deleteLocation(id)
      if (response.success) {
        showSuccess('Location deleted successfully')
        fetchLocations()
      } else {
        showError(response.message || 'Failed to delete location')
      }
    } catch (error) {
      showError('Failed to delete location')
    }
  }

  const getStatusColor = (status: LocationStatus) => {
    switch (status) {
      case LocationStatus.ACTIVE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case LocationStatus.MAINTENANCE: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case LocationStatus.DISABLED: return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }

  const getVisibilityColor = (visibility: LocationVisibility) => {
    switch (visibility) {
      case LocationVisibility.PUBLIC: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case LocationVisibility.PRIVATE: return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
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
      title="Location Management"
      subtitle="Manage server locations and capacity"
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
                    placeholder="Search locations..."
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
                    Create Location
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-neutral-800 border-neutral-700 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Location</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                      Add a new server location to the system
                    </DialogDescription>
                  </DialogHeader>
                  <LocationForm onSubmit={handleCreateLocation} />
                </DialogContent>
              </Dialog>
            </div>

            {locationsListStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">Total Locations</CardTitle>
                    <MapPin className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{locationsListStats.total_locations}</div>
                  </CardContent>
                </Card>

                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">Active Locations</CardTitle>
                    <Activity className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{locationsListStats.active_locations}</div>
                  </CardContent>
                </Card>

                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">Total Nodes</CardTitle>
                    <Server className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{locationsListStats.total_nodes}</div>
                  </CardContent>
                </Card>

                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">Avg Capacity</CardTitle>
                    <Activity className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{Math.round(locationsListStats.average_capacity_usage)}%</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {isLoadingLocationsList ? (
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
              ) : locationsList.length === 0 ? (
                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardContent className="p-6 text-center">
                    <p className="text-neutral-400">No locations found</p>
                  </CardContent>
                </Card>
              ) : (
                locationsList.map((location) => (
                  <LocationCard
                    key={location.id}
                    location={location}
                    onEdit={(loc) => {
                      setEditingLocation(loc)
                      setIsEditDialogOpen(true)
                    }}
                    onDelete={(id) => handleDeleteLocation(id)}
                    getStatusColor={getStatusColor}
                    getVisibilityColor={getVisibilityColor}
                  />
                ))
              )}
            </div>
          </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-neutral-800 border-neutral-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Location</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update location settings and configuration
            </DialogDescription>
          </DialogHeader>
          {editingLocation && (
            <LocationForm
              initialData={editingLocation}
              onSubmit={(data) => handleUpdateLocation(editingLocation.id, data)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
