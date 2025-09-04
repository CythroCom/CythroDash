/**
 * CythroDash - Server Types Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Server type status enumeration
export enum ServerTypeStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  MAINTENANCE = 'maintenance'
}

// Server type category enumeration
export enum ServerTypeCategory {
  GAMING = 'gaming',
  BOTS = 'bots',
  WEB = 'web',
  DATABASE = 'database',
  VOICE = 'voice',
  PROXY = 'proxy',
  OTHER = 'other'
}

// Display configuration interface
export interface DisplayConfig {
  icon?: string; // Icon identifier or URL
  color?: string; // Hex color code for theming
  banner_image?: string; // Banner image URL
  thumbnail?: string; // Thumbnail image URL
}

// Resource requirements interface
export interface ResourceRequirements {
  min_memory: number; // Minimum MB required
  min_disk: number; // Minimum MB required
  min_cpu: number; // Minimum CPU cores required
  recommended_memory?: number; // Recommended MB
  recommended_disk?: number; // Recommended MB
  recommended_cpu?: number; // Recommended CPU cores
}

// Server type interface definition
export interface CythroDashServerType {
  _id?: ObjectId;
  
  // Basic identification
  id: string; // Unique identifier (e.g., "minecraft", "discord-bot")
  name: string; // Display name (e.g., "Minecraft", "Discord Bot")
  description?: string; // Detailed description
  short_description?: string; // Brief description for cards
  
  // Pterodactyl integration
  pterodactyl_nest_id: number; // Maps to Pterodactyl nest ID
  
  // Categorization and display
  category: ServerTypeCategory;
  display_config: DisplayConfig;
  display_order: number; // Sort order in UI (lower = higher priority)
  
  // Status and availability
  status: ServerTypeStatus;
  featured?: boolean; // Feature prominently on homepage
  popular?: boolean; // Show "Popular" badge
  new?: boolean; // Show "New" badge
  
  // Resource specifications
  resource_requirements: ResourceRequirements;
  
  // Location and plan restrictions
  allowed_locations?: string[]; // Restrict to certain locations (empty = all)
  blocked_locations?: string[]; // Block from certain locations
  allowed_plans?: string[]; // Restrict to certain plans (empty = all)
  blocked_plans?: string[]; // Block from certain plans
  
  // User access restrictions
  access_restrictions: {
    min_user_role?: number; // Minimum user role required
    requires_verification?: boolean; // Require email verification
    max_servers_per_user?: number; // Limit servers per user for this type
    whitelist_users?: number[]; // Specific user IDs allowed (for beta features)
  };
  
  // Configuration options
  configuration: {
    supports_custom_jar?: boolean; // Allow custom JAR uploads
    supports_plugins?: boolean; // Support plugin installation
    supports_mods?: boolean; // Support mod installation
    supports_custom_startup?: boolean; // Allow custom startup commands
    auto_start?: boolean; // Auto-start servers by default
    crash_detection?: boolean; // Enable crash detection
  };
  
  // Documentation and help
  documentation: {
    setup_guide_url?: string; // Link to setup guide
    wiki_url?: string; // Link to wiki/documentation
    support_forum_url?: string; // Link to support forum
    video_tutorial_url?: string; // Link to video tutorial
  };
  
  // Statistics and analytics
  stats?: {
    total_servers: number; // Total servers created
    active_servers: number; // Currently active servers
    total_users: number; // Unique users who created this type
    average_uptime?: number; // Average uptime percentage
  };
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: number; // Admin user ID who created this type
  last_modified_by?: number; // Admin user ID who last modified
  
  // Version and compatibility
  version?: string; // Server type version
  compatibility_notes?: string; // Notes about compatibility
  changelog?: Array<{
    version: string;
    date: Date;
    changes: string[];
  }>;
}

// Server type summary interface (for listings)
export interface ServerTypeSummary {
  id: string;
  name: string;
  short_description?: string;
  category: ServerTypeCategory;
  icon?: string;
  popular?: boolean;
  featured?: boolean;
  new?: boolean;
  min_resources: {
    memory: number;
    disk: number;
    cpu: number;
  };
}

// Server type helper functions
export const ServerTypeHelpers = {
  // Generate a unique server type ID
  generateServerTypeId: (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  },

  // Check if server type is available for user
  isAvailableForUser: (serverType: CythroDashServerType, userRole: number, isVerified: boolean, userId?: number): boolean => {
    // Check status
    if (serverType.status !== ServerTypeStatus.ACTIVE) {
      return false;
    }

    // Check role requirement
    if (serverType.access_restrictions.min_user_role !== undefined && userRole > serverType.access_restrictions.min_user_role) {
      return false;
    }

    // Check verification requirement
    if (serverType.access_restrictions.requires_verification && !isVerified) {
      return false;
    }

    // Check whitelist (if specified)
    if (serverType.access_restrictions.whitelist_users && serverType.access_restrictions.whitelist_users.length > 0) {
      if (!userId || !serverType.access_restrictions.whitelist_users.includes(userId)) {
        return false;
      }
    }

    return true;
  },

  // Check if server type is available in location
  isAvailableInLocation: (serverType: CythroDashServerType, locationId: string): boolean => {
    // Check if blocked in this location
    if (serverType.blocked_locations && serverType.blocked_locations.includes(locationId)) {
      return false;
    }

    // Check if restricted to certain locations
    if (serverType.allowed_locations && serverType.allowed_locations.length > 0) {
      return serverType.allowed_locations.includes(locationId);
    }

    return true;
  },

  // Check if server type is compatible with plan
  isCompatibleWithPlan: (serverType: CythroDashServerType, planId: string): boolean => {
    // Check if blocked for this plan
    if (serverType.blocked_plans && serverType.blocked_plans.includes(planId)) {
      return false;
    }

    // Check if restricted to certain plans
    if (serverType.allowed_plans && serverType.allowed_plans.length > 0) {
      return serverType.allowed_plans.includes(planId);
    }

    return true;
  },

  // Get server type summary
  getSummary: (serverType: CythroDashServerType): ServerTypeSummary => {
    return {
      id: serverType.id,
      name: serverType.name,
      short_description: serverType.short_description,
      category: serverType.category,
      icon: serverType.display_config.icon,
      popular: serverType.popular,
      featured: serverType.featured,
      new: serverType.new,
      min_resources: {
        memory: serverType.resource_requirements.min_memory,
        disk: serverType.resource_requirements.min_disk,
        cpu: serverType.resource_requirements.min_cpu,
      },
    };
  },

  // Get default server type values
  getDefaultServerTypeValues: (): Partial<CythroDashServerType> => ({
    status: ServerTypeStatus.ACTIVE,
    category: ServerTypeCategory.OTHER,
    display_config: {},
    display_order: 100,
    resource_requirements: {
      min_memory: 512,
      min_disk: 1024,
      min_cpu: 0.5,
    },
    access_restrictions: {},
    configuration: {
      supports_custom_jar: false,
      supports_plugins: false,
      supports_mods: false,
      supports_custom_startup: false,
      auto_start: true,
      crash_detection: true,
    },
    documentation: {},
    created_at: new Date(),
    updated_at: new Date(),
  }),

  // Validate server type data
  validateServerTypeData: (serverType: Partial<CythroDashServerType>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!serverType.id || serverType.id.trim().length === 0) {
      errors.push('Server type ID is required');
    }

    if (!serverType.name || serverType.name.trim().length === 0) {
      errors.push('Server type name is required');
    }

    if (serverType.pterodactyl_nest_id === undefined || serverType.pterodactyl_nest_id < 1) {
      errors.push('Valid Pterodactyl nest ID is required');
    }

    if (!serverType.resource_requirements) {
      errors.push('Resource requirements are required');
    } else {
      if (serverType.resource_requirements.min_memory <= 0) {
        errors.push('Minimum memory must be greater than 0');
      }
      if (serverType.resource_requirements.min_disk <= 0) {
        errors.push('Minimum disk must be greater than 0');
      }
      if (serverType.resource_requirements.min_cpu <= 0) {
        errors.push('Minimum CPU must be greater than 0');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Sort server types by category, featured status, and display order
  sortServerTypes: (serverTypes: CythroDashServerType[]): CythroDashServerType[] => {
    return serverTypes.sort((a, b) => {
      // Featured items first
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }

      // Then by display order
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }

      // Then by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }

      // Finally by name
      return a.name.localeCompare(b.name);
    });
  },

  // Filter server types by category
  filterByCategory: (serverTypes: CythroDashServerType[], category: ServerTypeCategory): CythroDashServerType[] => {
    return serverTypes.filter(serverType => serverType.category === category);
  },

  // Get server types available for user in location
  getAvailableForUser: (
    serverTypes: CythroDashServerType[],
    userRole: number,
    isVerified: boolean,
    locationId?: string,
    userId?: number
  ): CythroDashServerType[] => {
    return serverTypes.filter(serverType => {
      if (!ServerTypeHelpers.isAvailableForUser(serverType, userRole, isVerified, userId)) {
        return false;
      }

      if (locationId && !ServerTypeHelpers.isAvailableInLocation(serverType, locationId)) {
        return false;
      }

      return true;
    });
  },
};

// Export collection name constant
export const SERVER_TYPES_COLLECTION = 'cythro_dash_server_types';

// Export default
export default {
  ServerTypeStatus,
  ServerTypeCategory,
  ServerTypeHelpers,
  SERVER_TYPES_COLLECTION,
};
