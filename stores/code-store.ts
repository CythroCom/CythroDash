"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { CythroDashCode, CythroDashCodeRedemption, CodeStatus } from "@/database/tables/cythro_dash_codes"

// User redemption response
export interface RedeemCodeResponse {
  success: boolean
  message: string
  coins_awarded?: number
  error?: string
}

// Admin code management response
export interface AdminCodeResponse {
  success: boolean
  message: string
  code?: CythroDashCode
  codes?: CythroDashCode[]
  total?: number
  error?: string
}

// Code statistics
export interface CodeStatistics {
  total_redemptions: number
  unique_users: number
  total_coins_awarded: number
  first_redemption?: Date
  last_redemption?: Date
  redemptions_by_day: Array<{ date: string; count: number }>
}

// User redemption store
type UserCodeStore = {
  // User redemption state
  redemptions: CythroDashCodeRedemption[]
  redemptionsTotal: number
  isRedeeming: boolean
  isLoadingRedemptions: boolean
  lastRedemptionsFetch: Date | null

  // Cache settings
  redemptionsCacheValidDuration: number // 5 minutes in milliseconds

  // User actions
  redeemCode: (code: string) => Promise<RedeemCodeResponse>
  getRedemptions: (limit?: number, offset?: number, forceRefresh?: boolean) => Promise<{ success: boolean; redemptions: CythroDashCodeRedemption[]; total: number; message: string }>
  clearRedemptionsCache: () => void
}

// Admin code management store
type AdminCodeStore = {
  // Admin codes state
  codes: CythroDashCode[]
  codesTotal: number
  selectedCode: CythroDashCode | null
  codeStatistics: CodeStatistics | null
  isLoadingCodes: boolean
  isLoadingCodeDetails: boolean
  isCreatingCode: boolean
  isUpdatingCode: boolean
  isDeletingCode: boolean
  lastCodesFetch: Date | null
  lastCodesFilters: any | null

  // Cache settings
  codesCacheValidDuration: number // 2 minutes in milliseconds

  // Admin actions
  getCodes: (filters?: { status?: CodeStatus; created_by?: number; search?: string; limit?: number; offset?: number }, forceRefresh?: boolean) => Promise<AdminCodeResponse>
  getCodeById: (id: number, forceRefresh?: boolean) => Promise<AdminCodeResponse>
  createCode: (codeData: {
    code?: string
    coins_value: number
    max_uses: number
    expiry_date?: Date
    description?: string
    internal_notes?: string
    allowed_user_ids?: number[]
    restricted_to_new_users?: boolean
  }) => Promise<AdminCodeResponse>
  updateCode: (id: number, updateData: {
    coins_value?: number
    max_uses?: number
    expiry_date?: Date
    is_active?: boolean
    description?: string
    internal_notes?: string
    allowed_user_ids?: number[]
    restricted_to_new_users?: boolean
  }) => Promise<AdminCodeResponse>
  deleteCode: (id: number) => Promise<AdminCodeResponse>
  clearCodesCache: () => void
  clearSelectedCode: () => void
}

// Get auth headers helper - this will be overridden by components
let getAuthHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json'
  }
}

// Function to set auth headers from components
export const setAuthHeaders = (headersFn: () => Record<string, string>) => {
  getAuthHeaders = headersFn
}

// User redemption store
export const useUserCodeStore = create<UserCodeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      redemptions: [],
      redemptionsTotal: 0,
      isRedeeming: false,
      isLoadingRedemptions: false,
      lastRedemptionsFetch: null,

      // Cache settings
      redemptionsCacheValidDuration: 5 * 60 * 1000, // 5 minutes

      // Check if redemptions cache is valid
      isRedemptionsCacheValid: () => {
        const { lastRedemptionsFetch, redemptionsCacheValidDuration } = get()
        if (!lastRedemptionsFetch) return false
        return new Date().getTime() - lastRedemptionsFetch.getTime() < redemptionsCacheValidDuration
      },

      // Redeem a code
      redeemCode: async (code: string): Promise<RedeemCodeResponse> => {
        set({ isRedeeming: true })

        try {
          const response = await fetch('/api/codes/redeem', {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({ code: code.trim().toUpperCase() })
          })

          const result = await response.json()

          if (result.success) {
            // Invalidate redemptions cache to force refresh
            set({ lastRedemptionsFetch: null })

            console.log('Code redeemed successfully:', {
              code,
              coins_awarded: result.coins_awarded
            })
          }

          return result

        } catch (error) {
          console.error('Redeem code error:', error)
          return {
            success: false,
            message: 'Network error occurred while redeeming code',
            error: 'NETWORK_ERROR'
          }
        } finally {
          set({ isRedeeming: false })
        }
      },

      // Get user redemptions
      getRedemptions: async (limit = 20, offset = 0, forceRefresh = false) => {
        const state = get()

        // Check cache if not forcing refresh
        if (!forceRefresh && (state as any).isRedemptionsCacheValid() && state.redemptions.length > 0) {
          return {
            success: true,
            redemptions: state.redemptions,
            total: state.redemptionsTotal,
            message: 'Redemptions retrieved from cache'
          }
        }

        set({ isLoadingRedemptions: true })

        try {
          const response = await fetch(`/api/codes/redeem?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success) {
            set({
              redemptions: result.redemptions || [],
              redemptionsTotal: result.total || 0,
              lastRedemptionsFetch: new Date()
            })

            console.log('Redemptions retrieved:', {
              count: result.redemptions?.length || 0,
              total: result.total || 0
            })
          }

          return result

        } catch (error) {
          console.error('Get redemptions error:', error)
          return {
            success: false,
            redemptions: [],
            total: 0,
            message: 'Network error occurred while retrieving redemptions'
          }
        } finally {
          set({ isLoadingRedemptions: false })
        }
      },

      // Clear redemptions cache
      clearRedemptionsCache: () => {
        set({
          redemptions: [],
          redemptionsTotal: 0,
          lastRedemptionsFetch: null
        })
      }
    }),
    {
      name: "user-code-store",
      partialize: (state) => ({
        redemptions: state.redemptions,
        redemptionsTotal: state.redemptionsTotal,
        lastRedemptionsFetch: state.lastRedemptionsFetch
      })
    }
  )
)

// Admin code management store
export const useAdminCodeStore = create<AdminCodeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      codes: [],
      codesTotal: 0,
      selectedCode: null,
      codeStatistics: null,
      isLoadingCodes: false,
      isLoadingCodeDetails: false,
      isCreatingCode: false,
      isUpdatingCode: false,
      isDeletingCode: false,
      lastCodesFetch: null,
      lastCodesFilters: null,

      // Cache settings
      codesCacheValidDuration: 2 * 60 * 1000, // 2 minutes

      // Check if codes cache is valid
      isCodesCacheValid: () => {
        const { lastCodesFetch, codesCacheValidDuration } = get()
        if (!lastCodesFetch) return false
        return new Date().getTime() - lastCodesFetch.getTime() < codesCacheValidDuration
      },

      // Get all codes with filtering
      getCodes: async (filters = {}, forceRefresh = false): Promise<AdminCodeResponse> => {
        const state = get()

        // Check cache if not forcing refresh and filters haven't changed
        if (!forceRefresh &&
            (state as any).isCodesCacheValid() &&
            state.codes.length > 0 &&
            JSON.stringify(filters) === JSON.stringify(state.lastCodesFilters)) {
          return {
            success: true,
            codes: state.codes,
            total: state.codesTotal,
            message: 'Codes retrieved from cache'
          }
        }

        set({ isLoadingCodes: true })

        try {
          const queryParams = new URLSearchParams()
          if (filters.limit) queryParams.append('limit', filters.limit.toString())
          if (filters.offset) queryParams.append('offset', filters.offset.toString())
          if (filters.status) queryParams.append('status', filters.status)
          if (filters.created_by) queryParams.append('created_by', filters.created_by.toString())
          if (filters.search) queryParams.append('search', filters.search)

          const response = await fetch(`/api/admin/codes?${queryParams.toString()}`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success) {
            set({
              codes: result.codes || [],
              codesTotal: result.total || 0,
              lastCodesFetch: new Date(),
              lastCodesFilters: filters
            })

            console.log('Admin codes retrieved:', {
              count: result.codes?.length || 0,
              total: result.total || 0,
              filters
            })
          }

          return result

        } catch (error) {
          console.error('Get admin codes error:', error)
          return {
            success: false,
            codes: [],
            total: 0,
            message: 'Network error occurred while retrieving codes'
          }
        } finally {
          set({ isLoadingCodes: false })
        }
      },

      // Get code by ID with statistics
      getCodeById: async (id: number, forceRefresh = false): Promise<AdminCodeResponse> => {
        const state = get()

        // Check if we already have this code and it's not stale
        if (!forceRefresh &&
            state.selectedCode &&
            state.selectedCode.id === id &&
            (state as any).isCodesCacheValid()) {
          return {
            success: true,
            code: state.selectedCode,
            message: 'Code retrieved from cache'
          }
        }

        set({ isLoadingCodeDetails: true })

        try {
          const response = await fetch(`/api/admin/codes/${id}`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success) {
            set({
              selectedCode: result.code,
              codeStatistics: result.statistics || null
            })

            console.log('Code details retrieved:', {
              code_id: id,
              code: result.code?.code
            })
          }

          return result

        } catch (error) {
          console.error('Get code details error:', error)
          return {
            success: false,
            message: 'Network error occurred while retrieving code details'
          }
        } finally {
          set({ isLoadingCodeDetails: false })
        }
      },

      // Create new code
      createCode: async (codeData): Promise<AdminCodeResponse> => {
        set({ isCreatingCode: true })

        try {
          const response = await fetch('/api/admin/codes', {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(codeData)
          })

          const result = await response.json()

          if (result.success) {
            // Invalidate cache to force refresh
            set({ lastCodesFetch: null })

            console.log('Code created successfully:', {
              code: result.code?.code,
              coins_value: result.code?.coins_value
            })
          }

          return result

        } catch (error) {
          console.error('Create code error:', error)
          return {
            success: false,
            message: 'Network error occurred while creating code'
          }
        } finally {
          set({ isCreatingCode: false })
        }
      },

      // Update code
      updateCode: async (id: number, updateData): Promise<AdminCodeResponse> => {
        set({ isUpdatingCode: true })

        try {
          const response = await fetch(`/api/admin/codes/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(updateData)
          })

          const result = await response.json()

          if (result.success) {
            // Update the selected code if it's the one being updated
            const state = get()
            if (state.selectedCode && state.selectedCode.id === id) {
              set({ selectedCode: result.code })
            }

            // Invalidate cache to force refresh
            set({ lastCodesFetch: null })

            console.log('Code updated successfully:', {
              code_id: id,
              updates: Object.keys(updateData)
            })
          }

          return result

        } catch (error) {
          console.error('Update code error:', error)
          return {
            success: false,
            message: 'Network error occurred while updating code'
          }
        } finally {
          set({ isUpdatingCode: false })
        }
      },

      // Delete code
      deleteCode: async (id: number): Promise<AdminCodeResponse> => {
        set({ isDeletingCode: true })

        try {
          const response = await fetch(`/api/admin/codes/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
          })

          const result = await response.json()

          if (result.success) {
            // Clear selected code if it's the one being deleted
            const state = get()
            if (state.selectedCode && state.selectedCode.id === id) {
              set({ selectedCode: null, codeStatistics: null })
            }

            // Invalidate cache to force refresh
            set({ lastCodesFetch: null })

            console.log('Code deleted successfully:', { code_id: id })
          }

          return result

        } catch (error) {
          console.error('Delete code error:', error)
          return {
            success: false,
            message: 'Network error occurred while deleting code'
          }
        } finally {
          set({ isDeletingCode: false })
        }
      },

      // Clear codes cache
      clearCodesCache: () => {
        set({
          codes: [],
          codesTotal: 0,
          lastCodesFetch: null,
          lastCodesFilters: null
        })
      },

      // Clear selected code
      clearSelectedCode: () => {
        set({
          selectedCode: null,
          codeStatistics: null
        })
      }
    }),
    {
      name: "admin-code-store",
      partialize: (state) => ({
        codes: state.codes,
        codesTotal: state.codesTotal,
        lastCodesFetch: state.lastCodesFetch,
        lastCodesFilters: state.lastCodesFilters
      })
    }
  )
)
