/**
 * CythroDash - Hosting Plans Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Plan status enumeration
export enum PlanStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  DEPRECATED = 'deprecated'
}

// Billing cycle enumeration
export enum BillingCycle {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily',
  HOURLY = 'hourly'
}

// Resource limits interface
export interface ResourceLimits {
  memory: number; // MB
  disk: number; // MB
  cpu: number; // CPU cores (can be fractional, e.g., 0.5)
  swap: number; // MB
  io: number; // IO weight (100-1000)
  databases: number; // Max databases
  allocations: number; // Max port allocations
  backups: number; // Max backups
  threads?: string; // CPU thread specification (optional)
  oom_disabled?: boolean; // Disable OOM killer
}

// Plan features interface
export interface PlanFeatures {
  priority_support: boolean;
  ddos_protection: boolean;
  automatic_backups: boolean;
  custom_jar_upload: boolean;
  ftp_access: boolean;
  mysql_databases: boolean;
  subdomain_included: boolean;
  custom_startup: boolean;
}

// Plan restrictions interface
export interface PlanRestrictions {
  min_user_role?: number; // Minimum user role required (0 = admin, 1 = user)
  max_servers_per_user?: number; // Limit servers per user for this plan
  allowed_server_types?: string[]; // Restrict to certain server types
  blocked_server_types?: string[]; // Block certain server types
  requires_verification?: boolean; // Require email verification
}

// Hosting plan interface definition
export interface CythroDashPlan {
  _id?: ObjectId;
  
  // Basic identification
  id: string; // Unique identifier (e.g., "starter", "premium")
  name: string; // Display name (e.g., "Starter Plan")
  description?: string; // Plan description
  tagline?: string; // Short marketing tagline
  
  // Resource specifications
  resources: ResourceLimits;
  
  // Pricing information
  price: number; // Cost in coins
  billing_cycle: BillingCycle; // Legacy enum
  billing_cycle_value?: string; // New flexible format e.g. "1month", "30d", "24h"
  setup_fee?: number; // One-time setup cost in coins
  
  // Availability and location settings
  available_locations: string[]; // Location IDs where this plan is available
  status: PlanStatus;
  
  // Display and marketing options
  popular?: boolean; // Show "Popular" badge
  premium?: boolean; // Show "Premium" badge
  featured?: boolean; // Feature prominently
  display_order: number; // Sort order in UI (lower = higher priority)
  color_scheme?: string; // Custom color for plan card
  
  // Features and capabilities
  features: PlanFeatures;
  
  // Access restrictions
  restrictions: PlanRestrictions;
  
  // Limits and quotas
  quotas: {
    max_concurrent_servers?: number; // Max servers running simultaneously
    bandwidth_limit?: number; // Monthly bandwidth in GB
    storage_limit?: number; // Additional storage limit in GB
    api_requests_limit?: number; // API requests per hour
  };
  
  // Promotional settings
  promotion?: {
    discount_percentage?: number; // Percentage discount
    discount_amount?: number; // Fixed discount in coins
    valid_until?: Date; // Promotion expiry
    promo_code?: string; // Required promo code
  };
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: number; // Admin user ID who created this plan
  last_modified_by?: number; // Admin user ID who last modified
  
  // Statistics (optional, for analytics)
  stats?: {
    total_subscriptions: number;
    active_subscriptions: number;
    revenue_generated: number; // Total coins earned
  };
}

// Plan comparison interface
export interface PlanComparison {
  plan_id: string;
  name: string;
  price: number;
  resources: ResourceLimits;
  features: string[]; // List of key features
  popular?: boolean;
  premium?: boolean;
}

// Plan helper functions
export const PlanHelpers = {
  // Generate a unique plan ID
  generatePlanId: (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  },

  // Calculate monthly cost for different billing cycles
  calculateMonthlyCost: (plan: CythroDashPlan): number => {
    switch (plan.billing_cycle) {
      case BillingCycle.HOURLY:
        return plan.price * 24 * 30; // Approximate monthly cost
      case BillingCycle.DAILY:
        return plan.price * 30;
      case BillingCycle.WEEKLY:
        return plan.price * 4.33; // Average weeks per month
      case BillingCycle.MONTHLY:
      default:
        return plan.price;
    }
  },

  // Check if plan is available in location
  isAvailableInLocation: (plan: CythroDashPlan, locationId: string): boolean => {
    return plan.available_locations.includes(locationId) && plan.status === PlanStatus.ACTIVE;
  },

  // Check if user can access plan
  canUserAccessPlan: (plan: CythroDashPlan, userRole: number, isVerified: boolean): boolean => {
    // Check role requirement
    if (plan.restrictions.min_user_role !== undefined && userRole > plan.restrictions.min_user_role) {
      return false;
    }

    // Check verification requirement
    if (plan.restrictions.requires_verification && !isVerified) {
      return false;
    }

    return plan.status === PlanStatus.ACTIVE;
  },

  // Get effective price (with promotions)
  getEffectivePrice: (plan: CythroDashPlan): number => {
    if (!plan.promotion) return plan.price;

    const now = new Date();
    if (plan.promotion.valid_until && now > plan.promotion.valid_until) {
      return plan.price; // Promotion expired
    }

    let discountedPrice = plan.price;

    if (plan.promotion.discount_percentage) {
      discountedPrice = plan.price * (1 - plan.promotion.discount_percentage / 100);
    }

    if (plan.promotion.discount_amount) {
      discountedPrice = Math.max(0, plan.price - plan.promotion.discount_amount);
    }

    return Math.round(discountedPrice);
  },

  // Get plan features as array
  getPlanFeaturesList: (plan: CythroDashPlan): string[] => {
    const features: string[] = [];
    
    features.push(`${plan.resources.memory} MB RAM`);
    features.push(`${plan.resources.disk} MB Storage`);
    features.push(`${plan.resources.cpu} CPU Core${plan.resources.cpu !== 1 ? 's' : ''}`);
    
    if (plan.resources.databases > 0) {
      features.push(`${plan.resources.databases} Database${plan.resources.databases !== 1 ? 's' : ''}`);
    }
    
    if (plan.resources.backups > 0) {
      features.push(`${plan.resources.backups} Backup${plan.resources.backups !== 1 ? 's' : ''}`);
    }

    if (plan.features.ddos_protection) features.push('DDoS Protection');
    if (plan.features.priority_support) features.push('Priority Support');
    if (plan.features.automatic_backups) features.push('Automatic Backups');
    if (plan.features.mysql_databases) features.push('MySQL Databases');
    if (plan.features.ftp_access) features.push('FTP Access');

    return features;
  },

  // Get default plan values
  getDefaultPlanValues: (): Partial<CythroDashPlan> => ({
    status: PlanStatus.ACTIVE,
    billing_cycle: BillingCycle.MONTHLY,
    display_order: 100,
    available_locations: [],
    features: {
      priority_support: false,
      ddos_protection: false,
      automatic_backups: false,
      custom_jar_upload: false,
      ftp_access: true,
      mysql_databases: false,
      subdomain_included: false,
      custom_startup: false,
    },
    restrictions: {},
    quotas: {},
    created_at: new Date(),
    updated_at: new Date(),
  }),

  // Validate plan data
  validatePlanData: (plan: Partial<CythroDashPlan>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!plan.id || plan.id.trim().length === 0) {
      errors.push('Plan ID is required');
    }

    if (!plan.name || plan.name.trim().length === 0) {
      errors.push('Plan name is required');
    }

    if (plan.price === undefined || plan.price < 0) {
      errors.push('Valid price is required');
    }

    if (!plan.resources) {
      errors.push('Resource limits are required');
    } else {
      if (plan.resources.memory <= 0) errors.push('Memory must be greater than 0');
      if (plan.resources.disk <= 0) errors.push('Disk must be greater than 0');
      if (plan.resources.cpu <= 0) errors.push('CPU must be greater than 0');
    }

    if (!plan.available_locations || plan.available_locations.length === 0) {
      errors.push('At least one location must be specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Sort plans by display order and price
  sortPlans: (plans: CythroDashPlan[]): CythroDashPlan[] => {
    return plans.sort((a, b) => {
      // First sort by display order
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      // Then sort by price
      return a.price - b.price;
    });
  },

  // Filter plans for location
  filterForLocation: (plans: CythroDashPlan[], locationId: string): CythroDashPlan[] => {
    return plans.filter(plan => PlanHelpers.isAvailableInLocation(plan, locationId));
  },
};

// Export collection name constant
export const PLANS_COLLECTION = 'cythro_dash_plans';

// Export default
export default {
  PlanStatus,
  BillingCycle,
  PlanHelpers,
  PLANS_COLLECTION,
};
