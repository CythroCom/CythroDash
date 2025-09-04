"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useAuthStore } from "./user-store"
import { PlanStatus, BillingCycle } from "@/database/tables/cythro_dash_plans"

// Types for plan management
export type AdminPlanSummary = {
  id: string
  name: string
  description?: string
  tagline?: string
  resources: {
    memory: number
    disk: number
    cpu: number
    swap: number
    io: number
    databases: number
    allocations: number
    backups: number
    threads?: string
    oom_disabled?: boolean
  }
  price: number
  billing_cycle: BillingCycle
  setup_fee?: number
  available_locations: string[]
  status: PlanStatus
  popular?: boolean
  premium?: boolean
  featured?: boolean
  display_order: number
  color_scheme?: string
  features: {
    priority_support: boolean
    ddos_protection: boolean
    automatic_backups: boolean
    custom_jar_upload: boolean
    ftp_access: boolean
    mysql_databases: boolean
    subdomain_included: boolean
    custom_startup: boolean
  }
  restrictions: {
    min_user_role?: number
    max_servers_per_user?: number
    allowed_server_types?: string[]
    blocked_server_types?: string[]
    requires_verification?: boolean
  }
  quotas: {
    max_concurrent_servers?: number
    bandwidth_limit?: number
    storage_limit?: number
    api_requests_limit?: number
  }
  promotion?: {
    discount_percentage?: number
    discount_amount?: number
    valid_until?: string
    promo_code?: string
  }
  stats?: {
    total_subscriptions: number
    active_subscriptions: number
    revenue_generated: number
  }
  created_at: string
  updated_at: string
  created_by: number
  last_modified_by?: number
}

export type AdminPlansPagination = {
  current_page: number
  total_pages: number
  total_items: number
  items_per_page: number
}

export type AdminPlansStats = {
  total_plans: number
  active_plans: number
  disabled_plans: number
  deprecated_plans: number
  popular_plans: number
  featured_plans: number
  premium_plans: number
  total_revenue: number
  average_price: number
  plans_by_billing_cycle: {
    monthly: number
    weekly: number
    daily: number
    hourly: number
  }
}

export type GetPlansFilters = {
  page?: number
  limit?: number
  search?: string
  status?: PlanStatus
  billing_cycle?: BillingCycle
  location_id?: string
  min_price?: number
  max_price?: number
  popular?: boolean
  featured?: boolean
  premium?: boolean
  sort_by?: 'name' | 'price' | 'display_order' | 'created_at' | 'status'
  sort_order?: 'asc' | 'desc'
  include_stats?: boolean
  include_promotions?: boolean
}

export type GetPlansResponse = {
  success: boolean
  message?: string
  plans?: AdminPlanSummary[]
  pagination?: AdminPlansPagination | null
  stats?: AdminPlansStats | null
  errors?: any[]
}

export type CreatePlanData = {
  name: string
  description?: string
  tagline?: string
  resources: {
    memory: number
    disk: number
    cpu: number
    swap: number
    io: number
    databases: number
    allocations: number
    backups: number
    threads?: string
    oom_disabled?: boolean
  }
  price: number
  billing_cycle: BillingCycle
  billing_cycle_value?: string
  setup_fee?: number
  available_locations: string[]
  status?: PlanStatus
  popular?: boolean
  premium?: boolean
  featured?: boolean
  display_order?: number
  color_scheme?: string
  features: {
    priority_support: boolean
    ddos_protection: boolean
    automatic_backups: boolean
    custom_jar_upload: boolean
    ftp_access: boolean
    mysql_databases: boolean
    subdomain_included: boolean
    custom_startup: boolean
  }
  restrictions?: {
    min_user_role?: number
    max_servers_per_user?: number
    allowed_server_types?: string[]
    blocked_server_types?: string[]
    requires_verification?: boolean
  }
  quotas?: {
    max_concurrent_servers?: number
    bandwidth_limit?: number
    storage_limit?: number
    api_requests_limit?: number
  }
  promotion?: {
    discount_percentage?: number
    discount_amount?: number
    valid_until?: Date
    promo_code?: string
  }
}

export type UpdatePlanData = {
  name?: string
  description?: string
  tagline?: string
  resources?: {
    memory?: number
    disk?: number
    cpu?: number
    swap?: number
    io?: number
    databases?: number
    allocations?: number
    backups?: number
    threads?: string
    oom_disabled?: boolean
  }
  price?: number
  billing_cycle?: BillingCycle
  billing_cycle_value?: string
  setup_fee?: number
  available_locations?: string[]
  status?: PlanStatus
  popular?: boolean
  premium?: boolean
  featured?: boolean
  display_order?: number
  color_scheme?: string
  features?: {
    priority_support?: boolean
    ddos_protection?: boolean
    automatic_backups?: boolean
    custom_jar_upload?: boolean
    ftp_access?: boolean
    mysql_databases?: boolean
    subdomain_included?: boolean
    custom_startup?: boolean
  }
  restrictions?: {
    min_user_role?: number
    max_servers_per_user?: number
    allowed_server_types?: string[]
    blocked_server_types?: string[]
    requires_verification?: boolean
  }
  quotas?: {
    max_concurrent_servers?: number
    bandwidth_limit?: number
    storage_limit?: number
    api_requests_limit?: number
  }
  promotion?: {
    discount_percentage?: number
    discount_amount?: number
    valid_until?: Date
    promo_code?: string
  }
}

export type PlanResponse = {
  success: boolean
  message: string
  plan?: AdminPlanSummary
  error?: string
}

export type PlanValidationResponse = {
  success: boolean
  plan_id: string
  location_id?: string
  validation_result: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  effective_price?: number
  monthly_cost?: number
  features_list?: string[]
}

type AdminPlansStore = {
  // Plans list state
  plansList: AdminPlanSummary[]
  plansListPagination: AdminPlansPagination | null
  plansListStats: AdminPlansStats | null
  plansListLastFetch: Date | null
  plansListLastFilters: GetPlansFilters | null
  isLoadingPlansList: boolean

  // Single plan state
  selectedPlan: AdminPlanSummary | null
  isLoadingSelectedPlan: boolean

  // Plan validation state
  planValidations: Record<string, PlanValidationResponse>
  isLoadingPlanValidation: Record<string, boolean>

  // Cache settings
  plansCacheValidDuration: number // 2 minutes in milliseconds

  // Actions
  getPlansList: (filters?: GetPlansFilters, forceRefresh?: boolean) => Promise<GetPlansResponse>
  getPlanById: (planId: string, forceRefresh?: boolean) => Promise<PlanResponse>
  createPlan: (planData: CreatePlanData) => Promise<PlanResponse>
  updatePlan: (planId: string, updateData: UpdatePlanData) => Promise<PlanResponse>
  deletePlan: (planId: string) => Promise<PlanResponse>
  validatePlan: (planId: string, locationId: string, forceRefresh?: boolean) => Promise<PlanValidationResponse>
  addLocationToPlan: (planId: string, locationId: string) => Promise<PlanResponse>
  removeLocationFromPlan: (planId: string, locationId: string) => Promise<PlanResponse>
  clearPlansListCache: () => void
  clearSelectedPlan: () => void
  clearPlanValidations: (planId?: string) => void

  // Utility actions
  isPlansCacheValid: () => boolean
  shouldRefreshPlansData: (newFilters?: GetPlansFilters) => boolean
}

export const useAdminPlansStore = create<AdminPlansStore>()(
  persist(
    (set, get) => ({
      // Initial state
      plansList: [],
      plansListPagination: null,
      plansListStats: null,
      plansListLastFetch: null,
      plansListLastFilters: null,
      isLoadingPlansList: false,
      selectedPlan: null,
      isLoadingSelectedPlan: false,
      planValidations: {},
      isLoadingPlanValidation: {},
      plansCacheValidDuration: 2 * 60 * 1000, // 2 minutes

      // Get plans list with pagination and filtering
      getPlansList: async (filters: GetPlansFilters = {}, forceRefresh: boolean = false) => {
        const { 
          plansList, 
          plansListLastFetch, 
          plansListLastFilters,
          isLoadingPlansList,
          isPlansCacheValid,
          shouldRefreshPlansData
        } = get()

        // Check if we should use cached data
        const shouldUseCache = !forceRefresh && 
                              isPlansCacheValid() && 
                              !shouldRefreshPlansData(filters) &&
                              plansList.length > 0

        if (shouldUseCache) {
          console.log('Returning cached plans list')
          return {
            success: true,
            message: 'Plans list retrieved from cache',
            plans: plansList,
            pagination: get().plansListPagination,
            stats: get().plansListStats
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingPlansList && !forceRefresh) {
          console.log('Plans list request already in progress')
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        set((state) => ({ ...state, isLoadingPlansList: true }))

        try {
          console.log('Fetching plans list with filters:', filters)

          // Build query parameters
          const params = new URLSearchParams()
          
          if (filters.page !== undefined) params.append('page', filters.page.toString())
          if (filters.limit !== undefined) params.append('limit', filters.limit.toString())
          if (filters.search) params.append('search', filters.search)
          if (filters.status) params.append('status', filters.status)
          if (filters.billing_cycle) params.append('billing_cycle', filters.billing_cycle)
          if (filters.location_id) params.append('location_id', filters.location_id)
          if (filters.min_price !== undefined) params.append('min_price', filters.min_price.toString())
          if (filters.max_price !== undefined) params.append('max_price', filters.max_price.toString())
          if (filters.popular !== undefined) params.append('popular', filters.popular.toString())
          if (filters.featured !== undefined) params.append('featured', filters.featured.toString())
          if (filters.premium !== undefined) params.append('premium', filters.premium.toString())
          if (filters.sort_by) params.append('sort_by', filters.sort_by)
          if (filters.sort_order) params.append('sort_order', filters.sort_order)
          if (filters.include_stats !== undefined) params.append('include_stats', filters.include_stats.toString())
          if (filters.include_promotions !== undefined) params.append('include_promotions', filters.include_promotions.toString())

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()
          console.log('Plans list API response:', result)

          if (result.success && result.plans) {
            // Calculate stats from plans data
            const stats = calculatePlansStats(result.plans)

            // Cache the plans data
            set((state) => ({
              ...state,
              plansList: result.plans,
              plansListPagination: result.pagination || null,
              plansListStats: stats,
              plansListLastFetch: new Date(),
              plansListLastFilters: filters,
              isLoadingPlansList: false
            }))

            return {
              success: true,
              message: result.message || 'Plans retrieved successfully',
              plans: result.plans,
              pagination: result.pagination,
              stats: stats
            }
          } else {
            set((state) => ({ ...state, isLoadingPlansList: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve plans',
              errors: result.errors
            }
          }
        } catch (error) {
          console.error('Get plans list error:', error)
          set((state) => ({ ...state, isLoadingPlansList: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving plans list'
          }
        }
      },

      // Get specific plan by ID
      getPlanById: async (planId: string, forceRefresh: boolean = false) => {
        const { selectedPlan, isLoadingSelectedPlan } = get()

        // Check if we already have this plan cached
        if (!forceRefresh && selectedPlan && selectedPlan.id === planId) {
          console.log('Returning cached plan data for ID:', planId)
          return {
            success: true,
            message: 'Plan data retrieved from cache',
            plan: selectedPlan
          }
        }

        // Prevent multiple simultaneous requests
        if (isLoadingSelectedPlan && !forceRefresh) {
          console.log('Plan request already in progress for ID:', planId)
          return {
            success: false,
            message: 'Request already in progress'
          }
        }

        set((state) => ({ ...state, isLoadingSelectedPlan: true }))

        try {
          console.log('Fetching plan by ID:', planId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans/${planId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()
          console.log('Plan by ID API response:', result)

          if (result.success && result.plan) {
            // Cache the plan data
            set((state) => ({
              ...state,
              selectedPlan: result.plan,
              isLoadingSelectedPlan: false
            }))

            return {
              success: true,
              message: result.message || 'Plan retrieved successfully',
              plan: result.plan
            }
          } else {
            set((state) => ({ ...state, isLoadingSelectedPlan: false }))
            return {
              success: false,
              message: result.message || 'Failed to retrieve plan'
            }
          }
        } catch (error) {
          console.error('Get plan by ID error:', error)
          set((state) => ({ ...state, isLoadingSelectedPlan: false }))
          return {
            success: false,
            message: 'Network error occurred while retrieving plan'
          }
        }
      },

      // Create new plan
      createPlan: async (planData: CreatePlanData) => {
        try {
          console.log('Creating new plan:', planData)

          // Convert Date to string for API
          const apiData = {
            ...planData,
            promotion: planData.promotion ? {
              ...planData.promotion,
              valid_until: planData.promotion.valid_until?.toISOString()
            } : undefined
          }

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch('/api/admin/plans', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify(apiData)
          })

          const result = await response.json()
          console.log('Create plan API response:', result)

          if (result.success && result.plan) {
            // Clear cache to force refresh on next list request
            get().clearPlansListCache()

            return {
              success: true,
              message: result.message || 'Plan created successfully',
              plan: result.plan
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to create plan'
            }
          }
        } catch (error) {
          console.error('Create plan error:', error)
          return {
            success: false,
            message: 'Network error occurred while creating plan'
          }
        }
      },

      // Update existing plan
      updatePlan: async (planId: string, updateData: UpdatePlanData) => {
        try {
          console.log('Updating plan:', planId, updateData)

          // Convert Date to string for API
          const apiData = {
            ...updateData,
            promotion: updateData.promotion ? {
              ...updateData.promotion,
              valid_until: updateData.promotion.valid_until?.toISOString()
            } : undefined
          }

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans/${planId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify(apiData)
          })

          const result = await response.json()
          console.log('Update plan API response:', result)

          if (result.success && result.plan) {
            // Update cached data
            const { selectedPlan } = get()
            if (selectedPlan && selectedPlan.id === planId) {
              set((state) => ({
                ...state,
                selectedPlan: result.plan
              }))
            }

            // Clear list cache to force refresh
            get().clearPlansListCache()

            return {
              success: true,
              message: result.message || 'Plan updated successfully',
              plan: result.plan
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to update plan'
            }
          }
        } catch (error) {
          console.error('Update plan error:', error)
          return {
            success: false,
            message: 'Network error occurred while updating plan'
          }
        }
      },

      // Delete plan
      deletePlan: async (planId: string) => {
        try {
          console.log('Deleting plan:', planId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans/${planId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()
          console.log('Delete plan API response:', result)

          if (result.success) {
            // Clear cached data
            const { selectedPlan } = get()
            if (selectedPlan && selectedPlan.id === planId) {
              get().clearSelectedPlan()
            }

            // Clear list cache to force refresh
            get().clearPlansListCache()

            return {
              success: true,
              message: result.message || 'Plan deleted successfully'
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to delete plan'
            }
          }
        } catch (error) {
          console.error('Delete plan error:', error)
          return {
            success: false,
            message: 'Network error occurred while deleting plan'
          }
        }
      },

      // Validate plan for location
      validatePlan: async (planId: string, locationId: string, forceRefresh: boolean = false) => {
        const { planValidations, isLoadingPlanValidation } = get()
        const validationKey = `${planId}-${locationId}`

        // Check if we already have this validation cached
        if (!forceRefresh && planValidations[validationKey]) {
          console.log('Returning cached validation data for plan:', planId, 'location:', locationId)
          return planValidations[validationKey]
        }

        // Prevent multiple simultaneous requests
        if (isLoadingPlanValidation[validationKey] && !forceRefresh) {
          console.log('Validation request already in progress for plan:', planId, 'location:', locationId)
          return {
            success: false,
            plan_id: planId,
            location_id: locationId,
            validation_result: {
              valid: false,
              errors: ['Request in progress'],
              warnings: []
            }
          }
        }

        set((state) => ({
          ...state,
          isLoadingPlanValidation: {
            ...state.isLoadingPlanValidation,
            [validationKey]: true
          }
        }))

        try {
          console.log('Validating plan:', planId, 'for location:', locationId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans/${planId}/validate?location_id=${locationId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
          })

          const result = await response.json()
          console.log('Plan validation API response:', result)

          // Cache the validation data
          set((state) => ({
            ...state,
            planValidations: {
              ...state.planValidations,
              [validationKey]: result
            },
            isLoadingPlanValidation: {
              ...state.isLoadingPlanValidation,
              [validationKey]: false
            }
          }))

          return result
        } catch (error) {
          console.error('Validate plan error:', error)
          set((state) => ({
            ...state,
            isLoadingPlanValidation: {
              ...state.isLoadingPlanValidation,
              [validationKey]: false
            }
          }))
          return {
            success: false,
            plan_id: planId,
            location_id: locationId,
            validation_result: {
              valid: false,
              errors: ['Network error occurred'],
              warnings: []
            }
          }
        }
      },

      // Add location to plan
      addLocationToPlan: async (planId: string, locationId: string) => {
        try {
          console.log('Adding location to plan:', planId, locationId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans/${planId}/locations`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify({ location_id: locationId })
          })

          const result = await response.json()
          console.log('Add location to plan API response:', result)

          if (result.success) {
            // Clear caches to force refresh
            get().clearPlansListCache()
            get().clearPlanValidations(planId)

            // Update selected plan if it's the same
            const { selectedPlan } = get()
            if (selectedPlan && selectedPlan.id === planId && result.plan) {
              set((state) => ({
                ...state,
                selectedPlan: result.plan
              }))
            }

            return {
              success: true,
              message: result.message || 'Location added to plan successfully',
              plan: result.plan
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to add location to plan'
            }
          }
        } catch (error) {
          console.error('Add location to plan error:', error)
          return {
            success: false,
            message: 'Network error occurred while adding location to plan'
          }
        }
      },

      // Remove location from plan
      removeLocationFromPlan: async (planId: string, locationId: string) => {
        try {
          console.log('Removing location from plan:', planId, locationId)

          // Get current user for authentication
          const currentUser = useAuthStore.getState().currentUser
          if (!currentUser) {
            throw new Error('User not authenticated')
          }

          const response = await fetch(`/api/admin/plans/${planId}/locations`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
            },
            body: JSON.stringify({ location_id: locationId })
          })

          const result = await response.json()
          console.log('Remove location from plan API response:', result)

          if (result.success) {
            // Clear caches to force refresh
            get().clearPlansListCache()
            get().clearPlanValidations(planId)

            // Update selected plan if it's the same
            const { selectedPlan } = get()
            if (selectedPlan && selectedPlan.id === planId && result.plan) {
              set((state) => ({
                ...state,
                selectedPlan: result.plan
              }))
            }

            return {
              success: true,
              message: result.message || 'Location removed from plan successfully',
              plan: result.plan
            }
          } else {
            return {
              success: false,
              message: result.message || 'Failed to remove location from plan'
            }
          }
        } catch (error) {
          console.error('Remove location from plan error:', error)
          return {
            success: false,
            message: 'Network error occurred while removing location from plan'
          }
        }
      },

      // Clear plans list cache
      clearPlansListCache: () => {
        set((state) => ({
          ...state,
          plansList: [],
          plansListPagination: null,
          plansListStats: null,
          plansListLastFetch: null,
          plansListLastFilters: null
        }))
      },

      // Clear selected plan
      clearSelectedPlan: () => {
        set((state) => ({
          ...state,
          selectedPlan: null,
          isLoadingSelectedPlan: false
        }))
      },

      // Clear plan validation data
      clearPlanValidations: (planId?: string) => {
        if (planId) {
          set((state) => {
            const newValidations = { ...state.planValidations }
            const newLoading = { ...state.isLoadingPlanValidation }

            // Remove all validations for this plan
            Object.keys(newValidations).forEach(key => {
              if (key.startsWith(`${planId}-`)) {
                delete newValidations[key]
                delete newLoading[key]
              }
            })

            return {
              ...state,
              planValidations: newValidations,
              isLoadingPlanValidation: newLoading
            }
          })
        } else {
          set((state) => ({
            ...state,
            planValidations: {},
            isLoadingPlanValidation: {}
          }))
        }
      },

      // Check if plans cache is still valid
      isPlansCacheValid: () => {
        const { plansListLastFetch, plansCacheValidDuration } = get()

        if (!plansListLastFetch) return false

        const now = new Date()
        const timeDiff = now.getTime() - plansListLastFetch.getTime()
        return timeDiff < plansCacheValidDuration
      },

      // Check if we should refresh data based on filter changes
      shouldRefreshPlansData: (newFilters?: GetPlansFilters) => {
        const { plansListLastFilters } = get()

        if (!plansListLastFilters || !newFilters) return false

        // Compare filters to see if they've changed
        const filtersChanged = JSON.stringify(plansListLastFilters) !== JSON.stringify(newFilters)
        return filtersChanged
      }
    }),
    {
      name: "admin-plans-store",
      // Only persist non-sensitive data
      partialize: (state) => ({
        plansCacheValidDuration: state.plansCacheValidDuration
      }),
    }
  )
)

// Helper function to calculate statistics from plans data
function calculatePlansStats(plans: AdminPlanSummary[]): AdminPlansStats {
  const stats: AdminPlansStats = {
    total_plans: plans.length,
    active_plans: plans.filter(p => p.status === PlanStatus.ACTIVE).length,
    disabled_plans: plans.filter(p => p.status === PlanStatus.DISABLED).length,
    deprecated_plans: plans.filter(p => p.status === PlanStatus.DEPRECATED).length,
    popular_plans: plans.filter(p => p.popular === true).length,
    featured_plans: plans.filter(p => p.featured === true).length,
    premium_plans: plans.filter(p => p.premium === true).length,
    total_revenue: plans.reduce((acc, p) => acc + (p.stats?.revenue_generated || 0), 0),
    average_price: plans.length > 0 ? plans.reduce((acc, p) => acc + p.price, 0) / plans.length : 0,
    plans_by_billing_cycle: {
      monthly: plans.filter(p => p.billing_cycle === BillingCycle.MONTHLY).length,
      weekly: plans.filter(p => p.billing_cycle === BillingCycle.WEEKLY).length,
      daily: plans.filter(p => p.billing_cycle === BillingCycle.DAILY).length,
      hourly: plans.filter(p => p.billing_cycle === BillingCycle.HOURLY).length,
    }
  }

  return stats
}
