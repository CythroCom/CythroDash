/**
 * CythroDash - Admin Plan Management Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { planOperations, CreatePlanData, UpdatePlanData } from '@/hooks/managers/database/plan';
import { locationOperations } from '@/hooks/managers/database/location';
import { userOperations } from '@/hooks/managers/database/user';
import { 
  CythroDashPlan, 
  PlanStatus, 
  BillingCycle,
  ResourceLimits,
  PlanFeatures,
  PlanRestrictions,
  PlanHelpers
} from '@/database/tables/cythro_dash_plans';
import { UserRole } from '@/database/tables/cythro_dash_users';

// Request interfaces
export interface CreatePlanRequest {
  name: string;
  description?: string;
  tagline?: string;
  resources: ResourceLimits;
  price: number;
  billing_cycle: BillingCycle;
  billing_cycle_value?: string; // Flexible custom cycle string
  setup_fee?: number;
  available_locations: string[];
  status?: PlanStatus;
  popular?: boolean;
  premium?: boolean;
  featured?: boolean;
  display_order?: number;
  color_scheme?: string;
  features: PlanFeatures;
  restrictions?: PlanRestrictions;
  quotas?: {
    max_concurrent_servers?: number;
    bandwidth_limit?: number;
    storage_limit?: number;
    api_requests_limit?: number;
  };
  promotion?: {
    discount_percentage?: number;
    discount_amount?: number;
    valid_until?: Date;
    promo_code?: string;
  };
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  tagline?: string;
  resources?: Partial<ResourceLimits>;
  price?: number;
  billing_cycle?: BillingCycle;
  setup_fee?: number;
  available_locations?: string[];
  status?: PlanStatus;
  popular?: boolean;
  premium?: boolean;
  featured?: boolean;
  display_order?: number;
  color_scheme?: string;
  features?: Partial<PlanFeatures>;
  restrictions?: PlanRestrictions;
  quotas?: {
    max_concurrent_servers?: number;
    bandwidth_limit?: number;
    storage_limit?: number;
    api_requests_limit?: number;
  };
  promotion?: {
    discount_percentage?: number;
    discount_amount?: number;
    valid_until?: Date;
    promo_code?: string;
  };
}

export interface GetPlansRequest {
  // Pagination
  page?: number;
  limit?: number;
  
  // Filtering
  search?: string;
  status?: PlanStatus;
  billing_cycle?: BillingCycle;
  location_id?: string;
  min_price?: number;
  max_price?: number;
  popular?: boolean;
  featured?: boolean;
  premium?: boolean;
  
  // Sorting
  sort_by?: 'name' | 'price' | 'display_order' | 'created_at' | 'status';
  sort_order?: 'asc' | 'desc';
  
  // Include additional data
  include_stats?: boolean;
  include_promotions?: boolean;
}

// Response interfaces
export interface PlanResponse {
  success: boolean;
  message: string;
  plan?: CythroDashPlan;
  error?: string;
}

export interface PlansListResponse {
  success: boolean;
  message?: string;
  plans?: CythroDashPlan[];
  pagination?: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
  };
  error?: string;
}

export interface PlanValidationResponse {
  success: boolean;
  plan_id: string;
  location_id?: string;
  validation_result: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  effective_price?: number;
  monthly_cost?: number;
  features_list?: string[];
}

export class PlanController {
  /**
   * Create a new plan
   */
  static async createPlan(
    planData: CreatePlanRequest,
    adminUserId: number,
    adminIP?: string
  ): Promise<PlanResponse> {
    try {
      console.log(`🔨 Admin ${adminUserId} creating new plan: ${planData.name}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to create plan',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Validate required fields
      if (!planData.name || !planData.resources || planData.price === undefined) {
        return {
          success: false,
          message: 'Name, resources, and price are required',
          error: 'MISSING_REQUIRED_FIELDS'
        };
      }

      // Validate available locations exist
      if (planData.available_locations && planData.available_locations.length > 0) {
        for (const locationId of planData.available_locations) {
          const location = await locationOperations.getLocationById(locationId);
          if (!location) {
            return {
              success: false,
              message: `Invalid location ID: ${locationId}`,
              error: 'INVALID_LOCATION'
            };
          }
        }
      }

      // Generate plan ID
      const planId = PlanHelpers.generatePlanId(planData.name);

      // Prepare create data
      const createData: CreatePlanData = {
        id: planId,
        name: planData.name,
        description: planData.description,
        tagline: planData.tagline,
        resources: planData.resources,
        price: planData.price,
        billing_cycle: planData.billing_cycle || BillingCycle.MONTHLY,
        billing_cycle_value: planData.billing_cycle_value,
        setup_fee: planData.setup_fee,
        available_locations: planData.available_locations || [],
        status: planData.status || PlanStatus.ACTIVE,
        popular: planData.popular || false,
        premium: planData.premium || false,
        featured: planData.featured || false,
        display_order: planData.display_order || 100,
        color_scheme: planData.color_scheme,
        features: planData.features,
        restrictions: planData.restrictions || {},
        quotas: planData.quotas,
        promotion: planData.promotion,
        created_by: adminUserId
      };

      // Validate plan data
      const validation = PlanHelpers.validatePlanData(createData);
      if (!validation.valid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          error: 'VALIDATION_FAILED'
        };
      }

      // Create plan in database
      const createdPlan = await planOperations.createPlan(createData);

      console.log(`✅ Plan created successfully: ${createdPlan.id}`);

      return {
        success: true,
        message: 'Plan created successfully',
        plan: createdPlan
      };

    } catch (error) {
      console.error('Error in PlanController.createPlan:', error);
      
      return {
        success: false,
        message: 'Failed to create plan. Please try again.',
        error: 'CREATION_FAILED'
      };
    }
  }

  /**
   * Get all plans with filtering and pagination
   */
  static async getPlans(
    request: GetPlansRequest,
    adminUserId: number
  ): Promise<PlansListResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to access plan data',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Set default values
      const page = Math.max(1, request.page || 1);
      const limit = Math.min(100, Math.max(1, request.limit || 25));
      const skip = (page - 1) * limit;
      const sortBy = request.sort_by || 'display_order';
      const sortOrder = request.sort_order === 'desc' ? -1 : 1;

      // Build filter query
      const filter: any = {};
      
      if (request.status !== undefined) {
        filter.status = request.status;
      }
      
      if (request.billing_cycle !== undefined) {
        filter.billing_cycle = request.billing_cycle;
      }

      if (request.location_id) {
        filter.available_locations = { $in: [request.location_id] };
      }

      if (request.min_price !== undefined || request.max_price !== undefined) {
        filter.price = {};
        if (request.min_price !== undefined) filter.price.$gte = request.min_price;
        if (request.max_price !== undefined) filter.price.$lte = request.max_price;
      }

      if (request.popular !== undefined) {
        filter.popular = request.popular;
      }

      if (request.featured !== undefined) {
        filter.featured = request.featured;
      }

      if (request.premium !== undefined) {
        filter.premium = request.premium;
      }

      // Search functionality
      if (request.search) {
        const searchRegex = { $regex: request.search, $options: 'i' };
        filter.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { tagline: searchRegex }
        ];
      }

      // Get plans with pagination
      const plans = await planOperations.getPlansWithPagination({
        filter,
        skip,
        limit,
        sort: { [sortBy]: sortOrder }
      });

      // Get total count for pagination
      const totalPlans = await planOperations.getPlansCount(filter);
      const totalPages = Math.ceil(totalPlans / limit);

      return {
        success: true,
        plans,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalPlans,
          items_per_page: limit
        }
      };

    } catch (error) {
      console.error('Error in PlanController.getPlans:', error);
      
      return {
        success: false,
        message: 'Failed to retrieve plans. Please try again.',
        error: 'RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Get a single plan by ID
   */
  static async getPlanById(
    planId: string,
    adminUserId: number
  ): Promise<PlanResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to access plan data',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      const plan = await planOperations.getPlanById(planId);
      if (!plan) {
        return {
          success: false,
          message: 'Plan not found',
          error: 'PLAN_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Plan retrieved successfully',
        plan
      };

    } catch (error) {
      console.error('Error in PlanController.getPlanById:', error);

      return {
        success: false,
        message: 'Failed to retrieve plan. Please try again.',
        error: 'RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Update an existing plan
   */
  static async updatePlan(
    planId: string,
    updateData: UpdatePlanRequest,
    adminUserId: number,
    _adminIP?: string
  ): Promise<PlanResponse> {
    try {
      console.log(`🔨 Admin ${adminUserId} updating plan: ${planId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to update plan',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get current plan data
      const currentPlan = await planOperations.getPlanById(planId);
      if (!currentPlan) {
        return {
          success: false,
          message: 'Plan not found',
          error: 'PLAN_NOT_FOUND'
        };
      }

      // Validate available locations if being updated
      if (updateData.available_locations) {
        for (const locationId of updateData.available_locations) {
          const location = await locationOperations.getLocationById(locationId);
          if (!location) {
            return {
              success: false,
              message: `Invalid location ID: ${locationId}`,
              error: 'INVALID_LOCATION'
            };
          }
        }
      }

      // Prepare update data
      const updatePlanData: UpdatePlanData = {
        ...updateData,
        last_modified_by: adminUserId
      };

      // Update plan in database
      const updatedPlan = await planOperations.updatePlan(planId, updatePlanData);

      if (!updatedPlan) {
        throw new Error('Failed to update plan in database');
      }

      console.log(`✅ Plan updated successfully: ${planId}`);

      return {
        success: true,
        message: 'Plan updated successfully',
        plan: updatedPlan
      };

    } catch (error) {
      console.error('Error in PlanController.updatePlan:', error);

      return {
        success: false,
        message: 'Failed to update plan. Please try again.',
        error: 'UPDATE_FAILED'
      };
    }
  }

  /**
   * Delete a plan (soft delete by disabling)
   */
  static async deletePlan(
    planId: string,
    adminUserId: number,
    _adminIP?: string
  ): Promise<PlanResponse> {
    try {
      console.log(`🗑️ Admin ${adminUserId} deleting plan: ${planId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to delete plan',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get current plan data
      const currentPlan = await planOperations.getPlanById(planId);
      if (!currentPlan) {
        return {
          success: false,
          message: 'Plan not found',
          error: 'PLAN_NOT_FOUND'
        };
      }

      // TODO: Check if plan has active subscriptions before deletion
      // This would require server operations to be implemented

      // Soft delete plan (disable it)
      const deleteSuccess = await planOperations.deletePlan(planId);

      if (!deleteSuccess) {
        throw new Error('Failed to delete plan');
      }

      console.log(`✅ Plan deleted successfully: ${planId}`);

      return {
        success: true,
        message: 'Plan deleted successfully',
        plan: { ...currentPlan, status: PlanStatus.DISABLED }
      };

    } catch (error) {
      console.error('Error in PlanController.deletePlan:', error);

      return {
        success: false,
        message: 'Failed to delete plan. Please try again.',
        error: 'DELETE_FAILED'
      };
    }
  }

  /**
   * Validate plan for a specific location
   */
  static async validatePlan(
    planId: string,
    locationId: string,
    adminUserId: number
  ): Promise<PlanValidationResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          plan_id: planId,
          location_id: locationId,
          validation_result: {
            valid: false,
            errors: ['Insufficient permissions'],
            warnings: []
          }
        };
      }

      const plan = await planOperations.getPlanById(planId);
      if (!plan) {
        return {
          success: false,
          plan_id: planId,
          location_id: locationId,
          validation_result: {
            valid: false,
            errors: ['Plan not found'],
            warnings: []
          }
        };
      }

      // Validate plan resources against location
      const validationResult = await planOperations.validatePlanResources(planId, locationId);

      // Calculate effective price and monthly cost
      const effectivePrice = PlanHelpers.getEffectivePrice(plan);
      const monthlyCost = PlanHelpers.calculateMonthlyCost(plan);
      const featuresList = PlanHelpers.getPlanFeaturesList(plan);

      return {
        success: true,
        plan_id: planId,
        location_id: locationId,
        validation_result: validationResult,
        effective_price: effectivePrice,
        monthly_cost: monthlyCost,
        features_list: featuresList
      };

    } catch (error) {
      console.error('Error in PlanController.validatePlan:', error);

      return {
        success: false,
        plan_id: planId,
        location_id: locationId,
        validation_result: {
          valid: false,
          errors: ['Validation failed due to system error'],
          warnings: []
        }
      };
    }
  }

  /**
   * Add location to plan
   */
  static async addLocationToPlan(
    planId: string,
    locationId: string,
    adminUserId: number
  ): Promise<PlanResponse> {
    try {
      console.log(`🔗 Admin ${adminUserId} adding location ${locationId} to plan ${planId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to modify plan',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Verify location exists
      const location = await locationOperations.getLocationById(locationId);
      if (!location) {
        return {
          success: false,
          message: 'Location not found',
          error: 'LOCATION_NOT_FOUND'
        };
      }

      // Add location to plan
      const success = await planOperations.addLocationToPlan(planId, locationId);

      if (!success) {
        return {
          success: false,
          message: 'Failed to add location to plan',
          error: 'ADD_LOCATION_FAILED'
        };
      }

      // Get updated plan
      const updatedPlan = await planOperations.getPlanById(planId);

      console.log(`✅ Location ${locationId} added to plan ${planId}`);

      return {
        success: true,
        message: 'Location added to plan successfully',
        plan: updatedPlan || undefined
      };

    } catch (error) {
      console.error('Error in PlanController.addLocationToPlan:', error);

      return {
        success: false,
        message: 'Failed to add location to plan. Please try again.',
        error: 'ADD_LOCATION_FAILED'
      };
    }
  }

  /**
   * Remove location from plan
   */
  static async removeLocationFromPlan(
    planId: string,
    locationId: string,
    adminUserId: number
  ): Promise<PlanResponse> {
    try {
      console.log(`🔗 Admin ${adminUserId} removing location ${locationId} from plan ${planId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to modify plan',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Remove location from plan
      const success = await planOperations.removeLocationFromPlan(planId, locationId);

      if (!success) {
        return {
          success: false,
          message: 'Failed to remove location from plan',
          error: 'REMOVE_LOCATION_FAILED'
        };
      }

      // Get updated plan
      const updatedPlan = await planOperations.getPlanById(planId);

      console.log(`✅ Location ${locationId} removed from plan ${planId}`);

      return {
        success: true,
        message: 'Location removed from plan successfully',
        plan: updatedPlan || undefined
      };

    } catch (error) {
      console.error('Error in PlanController.removeLocationFromPlan:', error);

      return {
        success: false,
        message: 'Failed to remove location from plan. Please try again.',
        error: 'REMOVE_LOCATION_FAILED'
      };
    }
  }
}
