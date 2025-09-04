/**
 * CythroDash - Plan Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter, UpdateFilter } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import {
  CythroDashPlan,
  PlanStatus,
  BillingCycle,
  ResourceLimits,
  PlanFeatures,
  PlanRestrictions,
  PlanHelpers,
  PLANS_COLLECTION
} from '../../../database/tables/cythro_dash_plans';

// Create plan data interface
export interface CreatePlanData {
  id: string;
  name: string;
  description?: string;
  tagline?: string;
  resources: ResourceLimits;
  price: number;
  billing_cycle: BillingCycle;
  billing_cycle_value?: string; // Flexible string format like "1month", "30d"
  setup_fee?: number;
  available_locations: string[];
  status: PlanStatus;
  popular?: boolean;
  premium?: boolean;
  featured?: boolean;
  display_order?: number;
  color_scheme?: string;
  features: PlanFeatures;
  restrictions: PlanRestrictions;
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
  created_by: number;
}

// Update plan data interface
export interface UpdatePlanData {
  name?: string;
  description?: string;
  tagline?: string;
  resources?: Partial<ResourceLimits>;
  price?: number;
  billing_cycle?: BillingCycle;
  billing_cycle_value?: string; // Flexible string format like "1month", "30d"
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
  last_modified_by?: number;
}

// Plan collection class
class CythroDashPlansCollection {
  private collection: Collection<CythroDashPlan> | null = null;

  async getCollection(): Promise<Collection<CythroDashPlan>> {
    if (!this.collection) {
      const db = await connectToDatabase();
      this.collection = db.collection<CythroDashPlan>(PLANS_COLLECTION);
      await this.createIndexes();
    }
    return this.collection;
  }

  private async createIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection();
      
      // Unique indexes
      await collection.createIndex({ id: 1 }, { unique: true });
      
      // Performance indexes
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ display_order: 1 });
      await collection.createIndex({ price: 1 });
      await collection.createIndex({ billing_cycle: 1 });
      await collection.createIndex({ created_at: -1 });
      await collection.createIndex({ available_locations: 1 });
      
      // Compound indexes
      await collection.createIndex({ status: 1, display_order: 1 });
      await collection.createIndex({ status: 1, price: 1 });
      await collection.createIndex({ available_locations: 1, status: 1 });
      await collection.createIndex({ popular: 1, status: 1 });
      await collection.createIndex({ featured: 1, status: 1 });
      
      // Text search index
      await collection.createIndex({ 
        name: "text", 
        description: "text", 
        tagline: "text" 
      });
      
      console.log('Plan database indexes created successfully');
    } catch (error) {
      console.error('Error creating plan database indexes:', error);
    }
  }
}

// Singleton instance
const plansCollection = new CythroDashPlansCollection();

// Plan operations class
class PlanOperations {
  // Create a new plan
  async createPlan(planData: CreatePlanData): Promise<CythroDashPlan> {
    const collection = await plansCollection.getCollection();
    
    // Check if plan already exists
    const existingPlan = await collection.findOne({ id: planData.id });
    if (existingPlan) {
      throw new Error('Plan already exists with this ID');
    }

    // Create plan object with defaults
    const newPlan: CythroDashPlan = {
      ...PlanHelpers.getDefaultPlanValues(),
      ...planData,
      created_at: new Date(),
      updated_at: new Date()
    } as CythroDashPlan;

    // Insert plan into database
    const result = await collection.insertOne(newPlan);
    
    // Return the created plan
    const createdPlan = await collection.findOne({ _id: result.insertedId });
    if (!createdPlan) {
      throw new Error('Failed to retrieve created plan');
    }

    return createdPlan;
  }

  // Get plan by ID
  async getPlanById(id: string): Promise<CythroDashPlan | null> {
    const collection = await plansCollection.getCollection();
    return await collection.findOne({ id });
  }

  // Get all plans
  async getAllPlans(): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({}).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Get active plans
  async getActivePlans(): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({
      status: PlanStatus.ACTIVE
    }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Get plans available for a specific location
  async getPlansForLocation(locationId: string): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({
      status: PlanStatus.ACTIVE,
      available_locations: { $in: [locationId] }
    }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Get featured plans
  async getFeaturedPlans(): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({
      status: PlanStatus.ACTIVE,
      featured: true
    }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Get popular plans
  async getPopularPlans(): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({
      status: PlanStatus.ACTIVE,
      popular: true
    }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Update plan
  async updatePlan(id: string, updateData: UpdatePlanData): Promise<CythroDashPlan | null> {
    const collection = await plansCollection.getCollection();

    // Build update document with only defined fields
    const setFields: any = {
      updated_at: new Date()
    };

    // Add only defined fields to the update
    Object.keys(updateData).forEach(key => {
      const value = (updateData as any)[key];
      if (value !== undefined) {
        setFields[key] = value;
      }
    });

    const updateDoc: UpdateFilter<CythroDashPlan> = {
      $set: setFields
    };

    await collection.updateOne({ id }, updateDoc);
    return await this.getPlanById(id);
  }

  // Delete plan (soft delete by setting status to disabled)
  async deletePlan(id: string): Promise<boolean> {
    const collection = await plansCollection.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          status: PlanStatus.DISABLED,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get plans with pagination and sorting (for admin)
  async getPlansWithPagination(options: {
    filter?: Filter<CythroDashPlan>;
    skip?: number;
    limit?: number;
    sort?: any;
  }): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    const {
      filter = {},
      skip = 0,
      limit = 25,
      sort = { display_order: 1, price: 1 }
    } = options;

    return await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  // Get total count of plans matching filter
  async getPlansCount(filter: Filter<CythroDashPlan> = {}): Promise<number> {
    const collection = await plansCollection.getCollection();
    return await collection.countDocuments(filter);
  }

  // Search plans by name, description, or tagline
  async searchPlans(searchTerm: string, limit: number = 20): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    
    return await collection
      .find({
        $text: { $search: searchTerm }
      })
      .limit(limit)
      .sort({ display_order: 1, price: 1 })
      .toArray();
  }

  // Get plans by status
  async getPlansByStatus(status: PlanStatus): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({ status }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Get plans by billing cycle
  async getPlansByBillingCycle(billingCycle: BillingCycle): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({ 
      billing_cycle: billingCycle,
      status: PlanStatus.ACTIVE 
    }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Get plans within price range
  async getPlansByPriceRange(minPrice: number, maxPrice: number): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    return await collection.find({
      status: PlanStatus.ACTIVE,
      price: { $gte: minPrice, $lte: maxPrice }
    }).sort({ price: 1 }).toArray();
  }

  // Add location to plan
  async addLocationToPlan(planId: string, locationId: string): Promise<boolean> {
    const collection = await plansCollection.getCollection();
    
    const result = await collection.updateOne(
      { id: planId },
      {
        $addToSet: { available_locations: locationId },
        $set: { updated_at: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  // Remove location from plan
  async removeLocationFromPlan(planId: string, locationId: string): Promise<boolean> {
    const collection = await plansCollection.getCollection();
    
    const result = await collection.updateOne(
      { id: planId },
      {
        $pull: { available_locations: locationId },
        $set: { updated_at: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  // Update plan statistics
  async updatePlanStats(planId: string, stats: {
    total_subscriptions?: number;
    active_subscriptions?: number;
    revenue_generated?: number;
  }): Promise<boolean> {
    const collection = await plansCollection.getCollection();

    // Build stats object with only defined values
    const statsUpdate: any = {};
    if (stats.total_subscriptions !== undefined) {
      statsUpdate['stats.total_subscriptions'] = stats.total_subscriptions;
    }
    if (stats.active_subscriptions !== undefined) {
      statsUpdate['stats.active_subscriptions'] = stats.active_subscriptions;
    }
    if (stats.revenue_generated !== undefined) {
      statsUpdate['stats.revenue_generated'] = stats.revenue_generated;
    }

    const result = await collection.updateOne(
      { id: planId },
      {
        $set: {
          ...statsUpdate,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get plans with active promotions
  async getPlansWithActivePromotions(): Promise<CythroDashPlan[]> {
    const collection = await plansCollection.getCollection();
    const now = new Date();
    
    return await collection.find({
      status: PlanStatus.ACTIVE,
      $or: [
        { "promotion.valid_until": { $gte: now } },
        { "promotion.valid_until": { $exists: false } }
      ],
      $and: [
        {
          $or: [
            { "promotion.discount_percentage": { $gt: 0 } },
            { "promotion.discount_amount": { $gt: 0 } }
          ]
        }
      ]
    }).sort({ display_order: 1, price: 1 }).toArray();
  }

  // Validate plan resource requirements against location capacity
  async validatePlanResources(planId: string, locationId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const plan = await this.getPlanById(planId);
    if (!plan) {
      return {
        valid: false,
        errors: ['Plan not found'],
        warnings: []
      };
    }

    // Check if plan is available in the specified location
    if (!plan.available_locations.includes(locationId)) {
      return {
        valid: false,
        errors: ['Plan is not available in the specified location'],
        warnings: []
      };
    }

    // Additional validation logic can be added here
    // For example, checking against location capacity, node availability, etc.
    
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
}

// Export singleton instance
export const planOperations = new PlanOperations();
