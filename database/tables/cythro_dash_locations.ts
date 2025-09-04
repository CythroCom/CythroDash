/**
 * CythroDash - Server Locations Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Location status enumeration
export enum LocationStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  DISABLED = 'disabled'
}

// Location visibility enumeration
export enum LocationVisibility {
  PUBLIC = 'public',   // Visible to all users
  PRIVATE = 'private'  // Admin only
}

// Resource capacity interface
export interface ResourceCapacity {
  memory: number; // Total MB
  disk: number;   // Total MB
  cpu: number;    // Total CPU cores
}

// Current resource usage interface
export interface ResourceUsage {
  memory: number; // Used MB
  disk: number;   // Used MB
  cpu: number;    // Used CPU cores
}

// Location interface definition
export interface CythroDashLocation {
  _id?: ObjectId;
  
  // Basic identification
  id: string; // Unique identifier (e.g., "us-east-1")
  name: string; // Display name (e.g., "US East")
  description?: string; // Optional description
  short_code: string; // Short identifier for display (e.g., "USE1")
  
  // Geographic information
  country?: string; // Country code (e.g., "US")
  region?: string; // Region name (e.g., "Virginia")
  city?: string; // City name (e.g., "Ashburn")
  
  // Pterodactyl integration
  pterodactyl_location_id: number; // Maps to Pterodactyl location ID
  associated_nodes: number[]; // Array of Pterodactyl node IDs in this location
  
  // Status and visibility
  status: LocationStatus;
  visibility: LocationVisibility;
  
  // Resource monitoring
  total_capacity: ResourceCapacity;
  current_usage: ResourceUsage;
  
  // Configuration and limits
  max_servers_per_user?: number; // Optional limit on servers per user in this location
  allowed_server_types?: string[]; // Optional restriction to certain server types
  priority: number; // Display priority (lower = higher priority)
  
  // Features and capabilities
  features: {
    ddos_protection: boolean;
    backup_storage: boolean;
    high_availability: boolean;
    ssd_storage: boolean;
  };
  
  // Network information
  network: {
    ipv4_available: boolean;
    ipv6_available: boolean;
    port_range_start?: number;
    port_range_end?: number;
  };
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: number; // Admin user ID who created this location
  last_capacity_check?: Date; // Last time capacity was updated
}

// Location statistics interface
export interface LocationStats {
  total_servers: number;
  active_servers: number;
  suspended_servers: number;
  total_users: number;
  capacity_percentage: {
    memory: number;
    disk: number;
    cpu: number;
  };
  average_load: number;
}

// Location helper functions
export const LocationHelpers = {
  // Generate a unique location ID
  generateLocationId: (shortCode: string): string => {
    return `${shortCode.toLowerCase()}-${Date.now()}`;
  },

  // Calculate capacity percentage
  calculateCapacityPercentage: (usage: ResourceUsage, capacity: ResourceCapacity): { memory: number; disk: number; cpu: number } => {
    return {
      memory: capacity.memory > 0 ? Math.round((usage.memory / capacity.memory) * 100) : 0,
      disk: capacity.disk > 0 ? Math.round((usage.disk / capacity.disk) * 100) : 0,
      cpu: capacity.cpu > 0 ? Math.round((usage.cpu / capacity.cpu) * 100) : 0,
    };
  },

  // Check if location has available capacity
  hasAvailableCapacity: (location: CythroDashLocation, requiredResources: ResourceCapacity): boolean => {
    const availableMemory = location.total_capacity.memory - location.current_usage.memory;
    const availableDisk = location.total_capacity.disk - location.current_usage.disk;
    const availableCpu = location.total_capacity.cpu - location.current_usage.cpu;

    return (
      availableMemory >= requiredResources.memory &&
      availableDisk >= requiredResources.disk &&
      availableCpu >= requiredResources.cpu
    );
  },

  // Get capacity status
  getCapacityStatus: (location: CythroDashLocation): 'available' | 'limited' | 'full' => {
    const percentages = LocationHelpers.calculateCapacityPercentage(location.current_usage, location.total_capacity);
    const maxPercentage = Math.max(percentages.memory, percentages.disk, percentages.cpu);

    if (maxPercentage >= 95) return 'full';
    if (maxPercentage >= 80) return 'limited';
    return 'available';
  },

  // Check if location is available for users
  isAvailableForUsers: (location: CythroDashLocation): boolean => {
    return (
      location.status === LocationStatus.ACTIVE &&
      location.visibility === LocationVisibility.PUBLIC &&
      LocationHelpers.getCapacityStatus(location) !== 'full'
    );
  },

  // Get default location values
  getDefaultLocationValues: (): Partial<CythroDashLocation> => ({
    status: LocationStatus.ACTIVE,
    visibility: LocationVisibility.PUBLIC,
    priority: 100,
    total_capacity: { memory: 0, disk: 0, cpu: 0 },
    current_usage: { memory: 0, disk: 0, cpu: 0 },
    associated_nodes: [],
    features: {
      ddos_protection: false,
      backup_storage: false,
      high_availability: false,
      ssd_storage: true,
    },
    network: {
      ipv4_available: true,
      ipv6_available: false,
    },
    created_at: new Date(),
    updated_at: new Date(),
  }),

  // Validate location data
  validateLocationData: (location: Partial<CythroDashLocation>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!location.id || location.id.trim().length === 0) {
      errors.push('Location ID is required');
    }

    if (!location.name || location.name.trim().length === 0) {
      errors.push('Location name is required');
    }

    if (!location.short_code || location.short_code.trim().length === 0) {
      errors.push('Short code is required');
    }

    if (location.pterodactyl_location_id === undefined || location.pterodactyl_location_id < 1) {
      errors.push('Valid Pterodactyl location ID is required');
    }

    if (location.priority !== undefined && location.priority < 0) {
      errors.push('Priority must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Sort locations by priority and name
  sortLocations: (locations: CythroDashLocation[]): CythroDashLocation[] => {
    return locations.sort((a, b) => {
      // First sort by priority (lower = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
  },

  // Filter locations for user visibility
  filterForUsers: (locations: CythroDashLocation[]): CythroDashLocation[] => {
    return locations.filter(location => LocationHelpers.isAvailableForUsers(location));
  },
};

// Export collection name constant
export const LOCATIONS_COLLECTION = 'cythro_dash_locations';

// Export default
export default {
  LocationStatus,
  LocationVisibility,
  LocationHelpers,
  LOCATIONS_COLLECTION,
};
