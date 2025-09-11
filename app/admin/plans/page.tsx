"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminPlansStore } from '@/stores/admin-plans-store'
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
import { Plus, Search, Edit, Trash2, CreditCard, Star, TrendingUp, DollarSign } from 'lucide-react'
import { PlanStatus, BillingCycle } from '@/database/tables/cythro_dash_plans'
import { showSuccess, showError } from '@/lib/toast'
import type { CreatePlanData, UpdatePlanData, AdminPlanSummary } from '@/stores/admin-plans-store'

interface PlanCardProps {
  plan: AdminPlanSummary
  onEdit: (plan: AdminPlanSummary) => void
  onDelete: (id: string) => void
  getStatusColor: (status: PlanStatus) => string
  getBillingCycleColor: (cycle: BillingCycle) => string
}

const PlanCard = ({ plan, onEdit, onDelete, getStatusColor, getBillingCycleColor }: PlanCardProps) => (
  <Card className="border-neutral-700/50 bg-neutral-800/40">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            <Badge className={getStatusColor(plan.status)}>{plan.status}</Badge>
            <Badge className={getBillingCycleColor(plan.billing_cycle)}>{plan.billing_cycle}</Badge>
            {plan.popular && <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"><Star className="h-3 w-3 mr-1" />Popular</Badge>}
            {plan.featured && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><TrendingUp className="h-3 w-3 mr-1" />Featured</Badge>}
            {plan.premium && <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">Premium</Badge>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-neutral-400">Price</p>
              <p className="text-white font-bold text-lg">${plan.price}/{plan.billing_cycle}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Resources</p>
              <p className="text-white text-sm">
                {plan.resources.memory}MB RAM, {plan.resources.disk}MB Disk, {plan.resources.cpu} CPU
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Locations</p>
              <p className="text-white text-sm">{plan.available_locations.length} available</p>
            </div>
            <div>
              <p className="text-sm text-neutral-400">Display Order</p>
              <p className="text-white">{plan.display_order}</p>
            </div>
          </div>

          {plan.description && (
            <p className="text-neutral-300 mb-4">{plan.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-neutral-400 mb-2">Features</p>
              <div className="flex flex-wrap gap-1">
                {plan.features.priority_support && <Badge variant="outline" className="text-xs">Priority Support</Badge>}
                {plan.features.ddos_protection && <Badge variant="outline" className="text-xs">DDoS Protection</Badge>}
                {plan.features.automatic_backups && <Badge variant="outline" className="text-xs">Auto Backups</Badge>}
                {plan.features.mysql_databases && <Badge variant="outline" className="text-xs">MySQL</Badge>}
                {plan.features.ftp_access && <Badge variant="outline" className="text-xs">FTP Access</Badge>}
              </div>
            </div>
            <div>
              <p className="text-sm text-neutral-400 mb-2">Limits</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">{plan.resources.databases} DBs</Badge>
                <Badge variant="outline" className="text-xs">{plan.resources.allocations} Ports</Badge>
                <Badge variant="outline" className="text-xs">{plan.resources.backups} Backups</Badge>
                {plan.quotas.max_concurrent_servers && (
                  <Badge variant="outline" className="text-xs">Max: {plan.quotas.max_concurrent_servers} servers</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(plan)}
            className="border-neutral-600 hover:bg-neutral-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(plan.id)}
            className="border-red-600 hover:bg-red-700 text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
)

interface PlanFormProps {
  initialData?: AdminPlanSummary
  onSubmit: (data: any) => void
}

const PlanForm = ({ initialData, onSubmit }: PlanFormProps) => {
  const { locationsList, isLoadingLocationsList, getLocationsList } = useAdminLocationsStore()

  // Load locations on mount
  useEffect(() => {
    void getLocationsList()
  }, [getLocationsList])

  const [formData, setFormData] = useState<CreatePlanData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    tagline: initialData?.tagline || '',
    resources: {
      memory: initialData?.resources?.memory || 512,
      disk: initialData?.resources?.disk || 1024,
      cpu: initialData?.resources?.cpu || 1,
      swap: initialData?.resources?.swap || 0,
      io: initialData?.resources?.io || 500,
      databases: initialData?.resources?.databases || 1,
      allocations: initialData?.resources?.allocations || 1,
      backups: initialData?.resources?.backups || 1,
      threads: initialData?.resources?.threads || '',
      oom_disabled: initialData?.resources?.oom_disabled || false,
    },
    price: initialData?.price || 0,
    billing_cycle: initialData?.billing_cycle || BillingCycle.MONTHLY,
    billing_cycle_value: initialData?.billing_cycle_value || '',
    setup_fee: initialData?.setup_fee || 0,
    available_locations: initialData?.available_locations || [],
    popular: initialData?.popular || false,
    premium: initialData?.premium || false,
    featured: initialData?.featured || false,
    display_order: initialData?.display_order || 0,
    color_scheme: initialData?.color_scheme || '',
    features: {
      priority_support: initialData?.features?.priority_support || false,
      ddos_protection: initialData?.features?.ddos_protection || false,
      automatic_backups: initialData?.features?.automatic_backups || false,
      custom_jar_upload: initialData?.features?.custom_jar_upload || false,
      ftp_access: initialData?.features?.ftp_access || false,
      mysql_databases: initialData?.features?.mysql_databases || false,
      subdomain_included: initialData?.features?.subdomain_included || false,
      custom_startup: initialData?.features?.custom_startup || false,
    },
    restrictions: {
      min_user_role: initialData?.restrictions?.min_user_role ?? 1,
      // undefined by default so it's omitted unless user sets a value >= 1
      max_servers_per_user: initialData?.restrictions?.max_servers_per_user ?? undefined,
      allowed_server_types: initialData?.restrictions?.allowed_server_types || [],
      blocked_server_types: initialData?.restrictions?.blocked_server_types || [],
      requires_verification: initialData?.restrictions?.requires_verification || false,
    },
    quotas: {
      // undefined by default so it's omitted unless user sets a value >= 1
      max_concurrent_servers: initialData?.quotas?.max_concurrent_servers ?? undefined,
      bandwidth_limit: initialData?.quotas?.bandwidth_limit ?? 0,
      storage_limit: initialData?.quotas?.storage_limit ?? 0,
      api_requests_limit: initialData?.quotas?.api_requests_limit ?? 0,
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that exactly one location is selected
    if (formData.available_locations.length !== 1) {
      alert('Please select exactly one location for this plan.')
      return
    }

    const data = structuredClone(formData)
    if (data.restrictions) {
      const v = data.restrictions.max_servers_per_user
      if (!v || v < 1) delete (data.restrictions as any).max_servers_per_user
    }
    if (data.quotas) {
      const v = data.quotas.max_concurrent_servers
      if (!v || v < 1) delete (data.quotas as any).max_concurrent_servers
    }
    onSubmit(data)
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
          <Label htmlFor="tagline" className="text-neutral-200">Tagline</Label>
          <Input
            id="tagline"
            value={formData.tagline}
            onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
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
          <Label htmlFor="price" className="text-neutral-200">Price *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            required
          />
        </div>
        <div>
          <Label htmlFor="billing_cycle" className="text-neutral-200">Billing Cycle</Label>
          <Select value={formData.billing_cycle} onValueChange={(value) => setFormData(prev => ({ ...prev, billing_cycle: value as BillingCycle }))}>
            <SelectTrigger className="bg-neutral-700/50 border-neutral-600/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value={BillingCycle.MINUTELY}>Minutely</SelectItem>
              <SelectItem value={BillingCycle.HOURLY}>Hourly</SelectItem>
              <SelectItem value={BillingCycle.DAILY}>Daily</SelectItem>
              <SelectItem value={BillingCycle.WEEKLY}>Weekly</SelectItem>
              <SelectItem value={BillingCycle.MONTHLY}>Monthly</SelectItem>
              <SelectItem value={BillingCycle.YEARLY}>Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="setup_fee" className="text-neutral-200">Setup Fee</Label>
          <Input
            id="setup_fee"
            type="number"
            step="0.01"
            value={formData.setup_fee}
            onChange={(e) => setFormData(prev => ({ ...prev, setup_fee: parseFloat(e.target.value) || 0 }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="billing_cycle_value" className="text-neutral-200">Custom Interval (optional)</Label>
          <Input
            id="billing_cycle_value"
            placeholder="e.g. 90m, 6h, 2w, 1month"
            value={formData.billing_cycle_value || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, billing_cycle_value: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
          />
          <p className="text-xs text-neutral-400 mt-1">Overrides the Billing Cycle when provided. Supported units: m, h, d, w, month, y</p>
        </div>
      </div>
      </div>

      {/* Available Location */}
      <div>
        <Label className="text-neutral-200">Available Location *</Label>
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border border-neutral-600/50 rounded-md p-3 bg-neutral-700/30">
          {isLoadingLocationsList ? (
            <p className="text-neutral-400 text-sm">Loading locations...</p>
          ) : locationsList.length === 0 ? (
            <p className="text-neutral-400 text-sm">No locations available</p>
          ) : (
            locationsList.map((location) => (
              <div key={location.id} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`location-${location.id}`}
                  name="plan-location"
                  checked={formData.available_locations.includes(location.id)}
                  onChange={() => {
                    setFormData(prev => ({
                      ...prev,
                      available_locations: [location.id]
                    }))
                  }}
                  className="text-blue-600 bg-neutral-700 border-neutral-600 focus:ring-blue-500"
                />
                <Label htmlFor={`location-${location.id}`} className="text-neutral-300 text-sm cursor-pointer">
                  {location.name} ({location.short_code})
                  {location.city && ` - ${location.city}`}
                </Label>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          {formData.available_locations.length === 0
            ? 'Please select exactly one location for this plan'
            : `Selected: ${locationsList.find(l => l.id === formData.available_locations[0])?.name || 'Unknown'}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="popular"
            checked={formData.popular}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, popular: checked as boolean }))}
          />
          <Label htmlFor="popular" className="text-neutral-300">Popular</Label>
        </div>
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
            id="premium"
            checked={formData.premium}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, premium: checked as boolean }))}
          />
          <Label htmlFor="premium" className="text-neutral-300">Premium</Label>
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Resource Allocation</Label>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="memory" className="text-neutral-200">Memory (MB)</Label>
            <Input
              id="memory"
              type="number"
              value={formData.resources.memory}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, memory: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="disk" className="text-neutral-200">Disk (MB)</Label>
            <Input
              id="disk"
              type="number"
              value={formData.resources.disk}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, disk: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="cpu" className="text-neutral-200">CPU (%)</Label>
            <Input
              id="cpu"
              type="number"
              value={formData.resources.cpu}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, cpu: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="swap" className="text-neutral-200">Swap (MB)</Label>
            <Input
              id="swap"
              type="number"
              value={formData.resources.swap}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, swap: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <Label htmlFor="io" className="text-neutral-200">I/O Weight</Label>
            <Input
              id="io"
              type="number"
              value={formData.resources.io}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, io: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="databases" className="text-neutral-200">Databases</Label>
            <Input
              id="databases"
              type="number"
              value={formData.resources.databases}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, databases: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="allocations" className="text-neutral-200">Allocations</Label>
            <Input
              id="allocations"
              type="number"
              value={formData.resources.allocations}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, allocations: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
          <div>
            <Label htmlFor="backups" className="text-neutral-200">Backups</Label>
            <Input
              id="backups"
              type="number"
              value={formData.resources.backups}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                resources: { ...prev.resources, backups: parseInt(e.target.value) || 0 }
              }))}
              className="bg-neutral-700/50 border-neutral-600/50"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-neutral-200 mb-3 block">Features</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries({
            priority_support: 'Priority Support',
            ddos_protection: 'DDoS Protection',
            automatic_backups: 'Automatic Backups',
            custom_jar_upload: 'Custom JAR Upload',
            ftp_access: 'FTP Access',
            mysql_databases: 'MySQL Databases',
            subdomain_included: 'Subdomain Included',
            custom_startup: 'Custom Startup'
          }).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={formData.features[key as keyof typeof formData.features] || false}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    features: { ...prev.features, [key]: checked }
                  }))
                }
              />
              <Label htmlFor={key} className="text-neutral-300 text-sm">{label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div>
          <Label htmlFor="color_scheme" className="text-neutral-200">Color Scheme</Label>
          <Input
            id="color_scheme"
            value={formData.color_scheme}
            onChange={(e) => setFormData(prev => ({ ...prev, color_scheme: e.target.value }))}
            className="bg-neutral-700/50 border-neutral-600/50"
            placeholder="#ffffff"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="bg-neutral-700 hover:bg-neutral-600">
          {initialData ? 'Update Plan' : 'Create Plan'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function AdminPlans() {
  const router = useRouter()
  const { isLoading, hasAccess } = useAdminGuard()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPlanSummary | null>(null)

  const {
    plansList,
    plansListPagination,
    plansListStats,
    isLoadingPlansList,
    getPlansList,
    createPlan,
    updatePlan,
    deletePlan
  } = useAdminPlansStore()

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const fetchPlans = useCallback(async () => {
    await getPlansList({ search: searchQuery, include_stats: true })
  }, [getPlansList, searchQuery])

  useEffect(() => {
    if (hasAccess) {
      fetchPlans()
    }
  }, [hasAccess, fetchPlans])

  const handleCreatePlan = async (data: CreatePlanData) => {
    try {
      const response = await createPlan(data)
      if (response.success) {
        showSuccess('Plan created successfully')
        setIsCreateDialogOpen(false)
        fetchPlans()
      } else {
        showError(response.message || 'Failed to create plan')
      }
    } catch (error) {
      showError('Failed to create plan')
    }
  }

  const handleUpdatePlan = async (id: string, data: UpdatePlanData) => {
    try {
      const response = await updatePlan(id, data)
      if (response.success) {
        showSuccess('Plan updated successfully')
        setIsEditDialogOpen(false)
        setEditingPlan(null)
        fetchPlans()
      } else {
        showError(response.message || 'Failed to update plan')
      }
    } catch (error) {
      showError('Failed to update plan')
    }
  }

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return
    
    try {
      const response = await deletePlan(id)
      if (response.success) {
        showSuccess('Plan deleted successfully')
        fetchPlans()
      } else {
        showError(response.message || 'Failed to delete plan')
      }
    } catch (error) {
      showError('Failed to delete plan')
    }
  }

  const getStatusColor = (status: PlanStatus) => {
    switch (status) {
      case PlanStatus.ACTIVE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case PlanStatus.DISABLED: return 'bg-red-500/10 text-red-400 border-red-500/20'
      case PlanStatus.DEPRECATED: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }

  const getBillingCycleColor = (cycle: BillingCycle) => {
    switch (cycle) {
      case BillingCycle.MONTHLY: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case BillingCycle.WEEKLY: return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case BillingCycle.DAILY: return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case BillingCycle.HOURLY: return 'bg-red-500/10 text-red-400 border-red-500/20'
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
      title="Plans Management"
      subtitle="Manage hosting plans and pricing"
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
                  placeholder="Search plans..."
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
                  Create Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-800 border-neutral-700 max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Plan</DialogTitle>
                  <DialogDescription className="text-neutral-400">
                    Add a new hosting plan to the system
                  </DialogDescription>
                </DialogHeader>
                <PlanForm onSubmit={(data) => { void handleCreatePlan(data as CreatePlanData) }} />
              </DialogContent>
            </Dialog>
          </div>

          {plansListStats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Total Plans</CardTitle>
                  <CreditCard className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{plansListStats.total_plans}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Active</CardTitle>
                  <TrendingUp className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{plansListStats.active_plans}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Featured</CardTitle>
                  <Star className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{plansListStats.featured_plans}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Avg Price</CardTitle>
                  <DollarSign className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">${plansListStats.average_price.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">${plansListStats.total_revenue.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {isLoadingPlansList ? (
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
            ) : plansList.length === 0 ? (
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardContent className="p-6 text-center">
                  <p className="text-neutral-400">No plans found</p>
                </CardContent>
              </Card>
            ) : (
              plansList.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={(p) => {
                    setEditingPlan(p)
                    setIsEditDialogOpen(true)
                  }}
                  onDelete={(id) => handleDeletePlan(id)}
                  getStatusColor={getStatusColor}
                  getBillingCycleColor={getBillingCycleColor}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-neutral-800 border-neutral-700 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Plan</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update plan settings and configuration
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <PlanForm
              initialData={editingPlan}
              onSubmit={(data) => handleUpdatePlan(editingPlan.id, data)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
