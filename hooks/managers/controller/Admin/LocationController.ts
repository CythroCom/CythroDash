/**
 * CythroDash - Admin Location Management Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { locationOperations, CreateLocationData, UpdateLocationData } from '@/hooks/managers/database/location';
import { panelLocationGetAll, panelLocationGetDetails } from '@/hooks/managers/pterodactyl/locations';
import { panelNodeGetAll, panelNodeGetByLocation, type PterodactylNode } from '@/hooks/managers/pterodactyl/nodes';
import { userOperations } from '@/hooks/managers/database/user';
import { 
  CythroDashLocation, 
  LocationStatus, 
  LocationVisibility, 
  LocationHelpers,
  ResourceCapacity,
  ResourceUsage
} from '@/database/tables/cythro_dash_locations';
import { UserRole } from '@/database/tables/cythro_dash_users';

// Request interfaces
export interface CreateLocationRequest {
  name: string;
  description?: string;
  short_code: string;
  country?: string;
  region?: string;
  city?: string;
  pterodactyl_location_id: number;
  associated_nodes?: number[];
  status?: LocationStatus;
  visibility?: LocationVisibility;
  priority?: number;
  max_servers_per_user?: number;
  allowed_server_types?: string[];
  features?: {
    ddos_protection?: boolean;
    backup_storage?: boolean;
    high_availability?: boolean;
    ssd_storage?: boolean;
  };
  network?: {
    ipv4_available?: boolean;
    ipv6_available?: boolean;
    port_range_start?: number;
    port_range_end?: number;
  };
}

export interface UpdateLocationRequest {
  name?: string;
  description?: string;
  short_code?: string;
  country?: string;
  region?: string;
  city?: string;
  pterodactyl_location_id?: number;
  associated_nodes?: number[];
  status?: LocationStatus;
  visibility?: LocationVisibility;
  priority?: number;
  max_servers_per_user?: number;
  allowed_server_types?: string[];
  features?: {
    ddos_protection?: boolean;
    backup_storage?: boolean;
    high_availability?: boolean;
    ssd_storage?: boolean;
  };
  network?: {
    ipv4_available?: boolean;
    ipv6_available?: boolean;
    port_range_start?: number;
    port_range_end?: number;
  };
}

export interface GetLocationsRequest {
  // Pagination
  page?: number;
  limit?: number;
  
  // Filtering
  search?: string;
  status?: LocationStatus;
  visibility?: LocationVisibility;
  
  // Sorting
  sort_by?: 'name' | 'short_code' | 'priority' | 'created_at' | 'status';
  sort_order?: 'asc' | 'desc';
  
  // Include additional data
  include_capacity?: boolean;
  include_nodes?: boolean;
}

// Response interfaces
export interface LocationResponse {
  success: boolean;
  message: string;
  location?: CythroDashLocation;
  error?: string;
}

export interface LocationsListResponse {
  success: boolean;
  message?: string;
  locations?: CythroDashLocation[];
  pagination?: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
  };
  error?: string;
}

export interface LocationCapacityResponse {
  success: boolean;
  location_id: string;
  capacity_status: 'available' | 'limited' | 'full';
  capacity_percentage: {
    memory: number;
    disk: number;
    cpu: number;
  };
  available_resources: ResourceCapacity;
  total_capacity: ResourceCapacity;
  current_usage: ResourceUsage;
  associated_nodes: Array<{
    id: number;
    name: string;
    online: boolean;
    capacity_status: string;
  }>;
}

export class LocationController {
  /**
   * Create a new location
   */
  static async createLocation(
    locationData: CreateLocationRequest,
    adminUserId: number,
    adminIP?: string
  ): Promise<LocationResponse> {
    try {
      console.log(`🔨 Admin ${adminUserId} creating new location: ${locationData.name}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to create location',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Validate required fields
      if (!locationData.name || !locationData.short_code || !locationData.pterodactyl_location_id) {
        return {
          success: false,
          message: 'Name, short code, and Pterodactyl location ID are required',
          error: 'MISSING_REQUIRED_FIELDS'
        };
      }

      // Generate location ID
      const locationId = LocationHelpers.generateLocationId(locationData.short_code);

      // Verify Pterodactyl location exists
      try {
        await panelLocationGetDetails(locationData.pterodactyl_location_id);
      } catch (error) {
        return {
          success: false,
          message: 'Invalid Pterodactyl location ID',
          error: 'INVALID_PTERODACTYL_LOCATION'
        };
      }

      // Get associated nodes if specified
      let associatedNodes = locationData.associated_nodes || [];
      if (associatedNodes.length === 0) {
        // Auto-discover nodes for this location
        try {
          const nodes = await panelNodeGetByLocation(locationData.pterodactyl_location_id);
          associatedNodes = nodes.map(node => node.id);
        } catch (error) {
          console.warn('Could not auto-discover nodes for location:', error);
        }
      }

      // Calculate total capacity from nodes
      let totalCapacity: ResourceCapacity = { memory: 0, disk: 0, cpu: 0 };
      if (associatedNodes.length > 0) {
        try {
          const allNodes = await panelNodeGetAll();
          const locationNodes = allNodes.data
            .filter(nodeResponse => associatedNodes.includes(nodeResponse.attributes!.id))
            .map(nodeResponse => nodeResponse.attributes!);

          totalCapacity = locationNodes.reduce((acc, node: PterodactylNode) => ({
            memory: acc.memory + node.memory,
            disk: acc.disk + node.disk,
            cpu: acc.cpu + 1 // Simplified CPU calculation
          }), { memory: 0, disk: 0, cpu: 0 });
        } catch (error) {
          console.warn('Could not calculate capacity from nodes:', error);
        }
      }

      // Prepare create data
      const createData: CreateLocationData = {
        id: locationId,
        name: locationData.name,
        description: locationData.description,
        short_code: locationData.short_code,
        country: locationData.country,
        region: locationData.region,
        city: locationData.city,
        pterodactyl_location_id: locationData.pterodactyl_location_id,
        associated_nodes: associatedNodes,
        status: locationData.status || LocationStatus.ACTIVE,
        visibility: locationData.visibility || LocationVisibility.PUBLIC,
        total_capacity: totalCapacity,
        priority: locationData.priority || 100,
        max_servers_per_user: locationData.max_servers_per_user,
        allowed_server_types: locationData.allowed_server_types,
        features: {
          ddos_protection: locationData.features?.ddos_protection || false,
          backup_storage: locationData.features?.backup_storage || false,
          high_availability: locationData.features?.high_availability || false,
          ssd_storage: locationData.features?.ssd_storage || true,
        },
        network: {
          ipv4_available: locationData.network?.ipv4_available || true,
          ipv6_available: locationData.network?.ipv6_available || false,
          port_range_start: locationData.network?.port_range_start,
          port_range_end: locationData.network?.port_range_end,
        },
        created_by: adminUserId
      };

      // Validate location data
      const validation = LocationHelpers.validateLocationData(createData);
      if (!validation.valid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          error: 'VALIDATION_FAILED'
        };
      }

      // Create location in database
      const createdLocation = await locationOperations.createLocation(createData);

      console.log(`✅ Location created successfully: ${createdLocation.id}`);

      return {
        success: true,
        message: 'Location created successfully',
        location: createdLocation
      };

    } catch (error) {
      console.error('Error in LocationController.createLocation:', error);
      
      return {
        success: false,
        message: 'Failed to create location. Please try again.',
        error: 'CREATION_FAILED'
      };
    }
  }

  /**
   * Get all locations with filtering and pagination
   */
  static async getLocations(
    request: GetLocationsRequest,
    adminUserId: number
  ): Promise<LocationsListResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to access location data',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Set default values
      const page = Math.max(1, request.page || 1);
      const limit = Math.min(100, Math.max(1, request.limit || 25));
      const skip = (page - 1) * limit;
      const sortBy = request.sort_by || 'priority';
      const sortOrder = request.sort_order === 'desc' ? -1 : 1;

      // Build filter query
      const filter: any = {};
      
      if (request.status !== undefined) {
        filter.status = request.status;
      }
      
      if (request.visibility !== undefined) {
        filter.visibility = request.visibility;
      }

      // Search functionality
      if (request.search) {
        const searchRegex = { $regex: request.search, $options: 'i' };
        filter.$or = [
          { name: searchRegex },
          { short_code: searchRegex },
          { description: searchRegex },
          { country: searchRegex },
          { region: searchRegex },
          { city: searchRegex }
        ];
      }

      // Get locations with pagination
      const locations = await locationOperations.getLocationsWithPagination({
        filter,
        skip,
        limit,
        sort: { [sortBy]: sortOrder }
      });

      // Get total count for pagination
      const totalLocations = await locationOperations.getLocationsCount(filter);
      const totalPages = Math.ceil(totalLocations / limit);

      return {
        success: true,
        locations,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_items: totalLocations,
          items_per_page: limit
        }
      };

    } catch (error) {
      console.error('Error in LocationController.getLocations:', error);
      
      return {
        success: false,
        message: 'Failed to retrieve locations. Please try again.',
        error: 'RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Get a single location by ID
   */
  static async getLocationById(
    locationId: string,
    adminUserId: number
  ): Promise<LocationResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to access location data',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      const location = await locationOperations.getLocationById(locationId);
      if (!location) {
        return {
          success: false,
          message: 'Location not found',
          error: 'LOCATION_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Location retrieved successfully',
        location
      };

    } catch (error) {
      console.error('Error in LocationController.getLocationById:', error);

      return {
        success: false,
        message: 'Failed to retrieve location. Please try again.',
        error: 'RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Update an existing location
   */
  static async updateLocation(
    locationId: string,
    updateData: UpdateLocationRequest,
    adminUserId: number,
    _adminIP?: string
  ): Promise<LocationResponse> {
    try {
      console.log(`🔨 Admin ${adminUserId} updating location: ${locationId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to update location',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get current location data
      const currentLocation = await locationOperations.getLocationById(locationId);
      if (!currentLocation) {
        return {
          success: false,
          message: 'Location not found',
          error: 'LOCATION_NOT_FOUND'
        };
      }

      // Verify Pterodactyl location if being updated
      if (updateData.pterodactyl_location_id && updateData.pterodactyl_location_id !== currentLocation.pterodactyl_location_id) {
        try {
          await panelLocationGetDetails(updateData.pterodactyl_location_id);
        } catch (error) {
          return {
            success: false,
            message: 'Invalid Pterodactyl location ID',
            error: 'INVALID_PTERODACTYL_LOCATION'
          };
        }
      }

      // Recalculate capacity if nodes are being updated
      let totalCapacity = currentLocation.total_capacity;
      if (updateData.associated_nodes) {
        try {
          const allNodes = await panelNodeGetAll();
          const locationNodes = allNodes.data
            .filter(nodeResponse => updateData.associated_nodes!.includes(nodeResponse.attributes!.id))
            .map(nodeResponse => nodeResponse.attributes!);

          totalCapacity = locationNodes.reduce((acc, node: PterodactylNode) => ({
            memory: acc.memory + node.memory,
            disk: acc.disk + node.disk,
            cpu: acc.cpu + 1
          }), { memory: 0, disk: 0, cpu: 0 });
        } catch (error) {
          console.warn('Could not recalculate capacity from nodes:', error);
        }
      }

      // Prepare update data
      const updateLocationData: UpdateLocationData = {
        ...updateData,
        total_capacity: updateData.associated_nodes ? totalCapacity : undefined
      };

      // Update location in database
      const updatedLocation = await locationOperations.updateLocation(locationId, updateLocationData);

      if (!updatedLocation) {
        throw new Error('Failed to update location in database');
      }

      console.log(`✅ Location updated successfully: ${locationId}`);

      return {
        success: true,
        message: 'Location updated successfully',
        location: updatedLocation
      };

    } catch (error) {
      console.error('Error in LocationController.updateLocation:', error);

      return {
        success: false,
        message: 'Failed to update location. Please try again.',
        error: 'UPDATE_FAILED'
      };
    }
  }

  /**
   * Delete a location (soft delete by disabling)
   */
  static async deleteLocation(
    locationId: string,
    adminUserId: number,
    _adminIP?: string
  ): Promise<LocationResponse> {
    try {
      console.log(`🗑️ Admin ${adminUserId} deleting location: ${locationId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to delete location',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get current location data
      const currentLocation = await locationOperations.getLocationById(locationId);
      if (!currentLocation) {
        return {
          success: false,
          message: 'Location not found',
          error: 'LOCATION_NOT_FOUND'
        };
      }

      // TODO: Check if location has active servers before deletion
      // This would require server operations to be implemented

      // Soft delete location (disable it)
      const deleteSuccess = await locationOperations.deleteLocation(locationId);

      if (!deleteSuccess) {
        throw new Error('Failed to delete location');
      }

      console.log(`✅ Location deleted successfully: ${locationId}`);

      return {
        success: true,
        message: 'Location deleted successfully',
        location: { ...currentLocation, status: LocationStatus.DISABLED }
      };

    } catch (error) {
      console.error('Error in LocationController.deleteLocation:', error);

      return {
        success: false,
        message: 'Failed to delete location. Please try again.',
        error: 'DELETE_FAILED'
      };
    }
  }

  /**
   * Get location capacity and node status
   */
  static async getLocationCapacity(
    locationId: string,
    adminUserId: number
  ): Promise<LocationCapacityResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          location_id: locationId,
          capacity_status: 'full',
          capacity_percentage: { memory: 0, disk: 0, cpu: 0 },
          available_resources: { memory: 0, disk: 0, cpu: 0 },
          total_capacity: { memory: 0, disk: 0, cpu: 0 },
          current_usage: { memory: 0, disk: 0, cpu: 0 },
          associated_nodes: []
        };
      }

      const location = await locationOperations.getLocationById(locationId);
      if (!location) {
        return {
          success: false,
          location_id: locationId,
          capacity_status: 'full',
          capacity_percentage: { memory: 0, disk: 0, cpu: 0 },
          available_resources: { memory: 0, disk: 0, cpu: 0 },
          total_capacity: { memory: 0, disk: 0, cpu: 0 },
          current_usage: { memory: 0, disk: 0, cpu: 0 },
          associated_nodes: []
        };
      }

      // Calculate capacity percentages
      const capacityPercentage = LocationHelpers.calculateCapacityPercentage(
        location.current_usage,
        location.total_capacity
      );

      // Calculate available resources
      const availableResources: ResourceCapacity = {
        memory: Math.max(0, location.total_capacity.memory - location.current_usage.memory),
        disk: Math.max(0, location.total_capacity.disk - location.current_usage.disk),
        cpu: Math.max(0, location.total_capacity.cpu - location.current_usage.cpu)
      };

      // Get capacity status
      const capacityStatus = LocationHelpers.getCapacityStatus(location);

      // Get node information
      const associatedNodes = [];
      try {
        const allNodes = await panelNodeGetAll();
        for (const nodeId of location.associated_nodes) {
          const nodeResponse = allNodes.data.find(n => n.attributes?.id === nodeId);
          if (nodeResponse?.attributes) {
            const node = nodeResponse.attributes;
            associatedNodes.push({
              id: node.id,
              name: node.name,
              online: !node.maintenance_mode,
              capacity_status: 'available' // This would be calculated from node stats
            });
          }
        }
      } catch (error) {
        console.warn('Could not fetch node information:', error);
      }

      return {
        success: true,
        location_id: locationId,
        capacity_status: capacityStatus,
        capacity_percentage: capacityPercentage,
        available_resources: availableResources,
        total_capacity: location.total_capacity,
        current_usage: location.current_usage,
        associated_nodes: associatedNodes
      };

    } catch (error) {
      console.error('Error in LocationController.getLocationCapacity:', error);

      return {
        success: false,
        location_id: locationId,
        capacity_status: 'full',
        capacity_percentage: { memory: 0, disk: 0, cpu: 0 },
        available_resources: { memory: 0, disk: 0, cpu: 0 },
        total_capacity: { memory: 0, disk: 0, cpu: 0 },
        current_usage: { memory: 0, disk: 0, cpu: 0 },
        associated_nodes: []
      };
    }
  }

  /**
   * Add node to location
   */
  static async addNodeToLocation(
    locationId: string,
    nodeId: number,
    adminUserId: number
  ): Promise<LocationResponse> {
    try {
      console.log(`🔗 Admin ${adminUserId} adding node ${nodeId} to location ${locationId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to modify location',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Verify node exists
      try {
        const allNodes = await panelNodeGetAll();
        const nodeExists = allNodes.data.some(n => n.attributes?.id === nodeId);
        if (!nodeExists) {
          return {
            success: false,
            message: 'Node not found',
            error: 'NODE_NOT_FOUND'
          };
        }
      } catch (error) {
        return {
          success: false,
          message: 'Failed to verify node existence',
          error: 'NODE_VERIFICATION_FAILED'
        };
      }

      // Add node to location
      const success = await locationOperations.addNodeToLocation(locationId, nodeId);

      if (!success) {
        return {
          success: false,
          message: 'Failed to add node to location',
          error: 'ADD_NODE_FAILED'
        };
      }

      // Get updated location
      const updatedLocation = await locationOperations.getLocationById(locationId);

      console.log(`✅ Node ${nodeId} added to location ${locationId}`);

      return {
        success: true,
        message: 'Node added to location successfully',
        location: updatedLocation || undefined
      };

    } catch (error) {
      console.error('Error in LocationController.addNodeToLocation:', error);

      return {
        success: false,
        message: 'Failed to add node to location. Please try again.',
        error: 'ADD_NODE_FAILED'
      };
    }
  }

  /**
   * Remove node from location
   */
  static async removeNodeFromLocation(
    locationId: string,
    nodeId: number,
    adminUserId: number
  ): Promise<LocationResponse> {
    try {
      console.log(`🔗 Admin ${adminUserId} removing node ${nodeId} from location ${locationId}`);

      // Validate admin permissions
      const adminUser = await userOperations.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to modify location',
          error: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Remove node from location
      const success = await locationOperations.removeNodeFromLocation(locationId, nodeId);

      if (!success) {
        return {
          success: false,
          message: 'Failed to remove node from location',
          error: 'REMOVE_NODE_FAILED'
        };
      }

      // Get updated location
      const updatedLocation = await locationOperations.getLocationById(locationId);

      console.log(`✅ Node ${nodeId} removed from location ${locationId}`);

      return {
        success: true,
        message: 'Node removed from location successfully',
        location: updatedLocation || undefined
      };

    } catch (error) {
      console.error('Error in LocationController.removeNodeFromLocation:', error);

      return {
        success: false,
        message: 'Failed to remove node from location. Please try again.',
        error: 'REMOVE_NODE_FAILED'
      };
    }
  }
}
