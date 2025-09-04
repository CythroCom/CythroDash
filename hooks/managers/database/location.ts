/**
 * CythroDash - Location Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter, UpdateFilter } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import {
  CythroDashLocation,
  LocationStatus,
  LocationVisibility,
  ResourceCapacity,
  ResourceUsage,
  LocationHelpers,
  LOCATIONS_COLLECTION
} from '../../../database/tables/cythro_dash_locations';

// Create location data interface
export interface CreateLocationData {
  id: string;
  name: string;
  description?: string;
  short_code: string;
  country?: string;
  region?: string;
  city?: string;
  pterodactyl_location_id: number;
  associated_nodes: number[];
  status: LocationStatus;
  visibility: LocationVisibility;
  total_capacity: ResourceCapacity;
  priority?: number;
  max_servers_per_user?: number;
  allowed_server_types?: string[];
  features?: {
    ddos_protection: boolean;
    backup_storage: boolean;
    high_availability: boolean;
    ssd_storage: boolean;
  };
  network?: {
    ipv4_available: boolean;
    ipv6_available: boolean;
    port_range_start?: number;
    port_range_end?: number;
  };
  created_by: number;
}

// Update location data interface
export interface UpdateLocationData {
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
  total_capacity?: ResourceCapacity;
  current_usage?: ResourceUsage;
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
  last_capacity_check?: Date;
}

// Location collection class
class CythroDashLocationsCollection {
  private collection: Collection<CythroDashLocation> | null = null;

  async getCollection(): Promise<Collection<CythroDashLocation>> {
    if (!this.collection) {
      const db = await connectToDatabase();
      this.collection = db.collection<CythroDashLocation>(LOCATIONS_COLLECTION);
      await this.createIndexes();
    }
    return this.collection;
  }

  private async createIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection();
      
      // Unique indexes
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ pterodactyl_location_id: 1 }, { unique: true });
      await collection.createIndex({ short_code: 1 }, { unique: true });
      
      // Performance indexes
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ visibility: 1 });
      await collection.createIndex({ priority: 1 });
      await collection.createIndex({ created_at: -1 });
      
      // Compound indexes
      await collection.createIndex({ status: 1, visibility: 1 });
      await collection.createIndex({ visibility: 1, priority: 1 });
      
      console.log('Location database indexes created successfully');
    } catch (error) {
      console.error('Error creating location database indexes:', error);
    }
  }
}

// Singleton instance
const locationsCollection = new CythroDashLocationsCollection();

// Location operations class
class LocationOperations {
  // Create a new location
  async createLocation(locationData: CreateLocationData): Promise<CythroDashLocation> {
    const collection = await locationsCollection.getCollection();
    
    // Check if location already exists
    const existingLocation = await collection.findOne({
      $or: [
        { id: locationData.id },
        { pterodactyl_location_id: locationData.pterodactyl_location_id },
        { short_code: locationData.short_code }
      ]
    });

    if (existingLocation) {
      throw new Error('Location already exists with this ID, Pterodactyl location ID, or short code');
    }

    // Create location object with defaults
    const newLocation: CythroDashLocation = {
      ...LocationHelpers.getDefaultLocationValues(),
      ...locationData,
      current_usage: { memory: 0, disk: 0, cpu: 0 },
      created_at: new Date(),
      updated_at: new Date()
    } as CythroDashLocation;

    // Insert location into database
    const result = await collection.insertOne(newLocation);
    
    // Return the created location
    const createdLocation = await collection.findOne({ _id: result.insertedId });
    if (!createdLocation) {
      throw new Error('Failed to retrieve created location');
    }

    return createdLocation;
  }

  // Get location by ID
  async getLocationById(id: string): Promise<CythroDashLocation | null> {
    const collection = await locationsCollection.getCollection();
    return await collection.findOne({ id });
  }

  // Get location by Pterodactyl location ID
  async getLocationByPterodactylId(pterodactylLocationId: number): Promise<CythroDashLocation | null> {
    const collection = await locationsCollection.getCollection();
    return await collection.findOne({ pterodactyl_location_id: pterodactylLocationId });
  }

  // Get location by short code
  async getLocationByShortCode(shortCode: string): Promise<CythroDashLocation | null> {
    const collection = await locationsCollection.getCollection();
    return await collection.findOne({ short_code: shortCode });
  }

  // Get all locations
  async getAllLocations(): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    return await collection.find({}).sort({ priority: 1, name: 1 }).toArray();
  }

  // Get public locations (for users)
  async getPublicLocations(): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    return await collection.find({
      status: LocationStatus.ACTIVE,
      visibility: LocationVisibility.PUBLIC
    }).sort({ priority: 1, name: 1 }).toArray();
  }

  // Get locations with available capacity
  async getAvailableLocations(): Promise<CythroDashLocation[]> {
    const locations = await this.getPublicLocations();
    return locations.filter(location => LocationHelpers.isAvailableForUsers(location));
  }

  // Update location
  async updateLocation(id: string, updateData: UpdateLocationData): Promise<CythroDashLocation | null> {
    const collection = await locationsCollection.getCollection();

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

    const updateDoc: UpdateFilter<CythroDashLocation> = {
      $set: setFields
    };

    await collection.updateOne({ id }, updateDoc);
    return await this.getLocationById(id);
  }

  // Update location capacity
  async updateLocationCapacity(id: string, usage: ResourceUsage): Promise<boolean> {
    const collection = await locationsCollection.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          current_usage: usage,
          last_capacity_check: new Date(),
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Delete location (soft delete by setting status to disabled)
  async deleteLocation(id: string): Promise<boolean> {
    const collection = await locationsCollection.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          status: LocationStatus.DISABLED,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get locations with pagination and sorting (for admin)
  async getLocationsWithPagination(options: {
    filter?: Filter<CythroDashLocation>;
    skip?: number;
    limit?: number;
    sort?: any;
  }): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    const {
      filter = {},
      skip = 0,
      limit = 25,
      sort = { priority: 1, name: 1 }
    } = options;

    return await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  // Get total count of locations matching filter
  async getLocationsCount(filter: Filter<CythroDashLocation> = {}): Promise<number> {
    const collection = await locationsCollection.getCollection();
    return await collection.countDocuments(filter);
  }

  // Search locations by name or short code
  async searchLocations(searchTerm: string, limit: number = 20): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    const searchRegex = { $regex: searchTerm, $options: 'i' };

    return await collection
      .find({
        $or: [
          { name: searchRegex },
          { short_code: searchRegex },
          { description: searchRegex },
          { country: searchRegex },
          { region: searchRegex },
          { city: searchRegex }
        ]
      })
      .limit(limit)
      .sort({ priority: 1, name: 1 })
      .toArray();
  }

  // Get locations by status
  async getLocationsByStatus(status: LocationStatus): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    return await collection.find({ status }).sort({ priority: 1, name: 1 }).toArray();
  }

  // Get locations by visibility
  async getLocationsByVisibility(visibility: LocationVisibility): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    return await collection.find({ visibility }).sort({ priority: 1, name: 1 }).toArray();
  }

  // Get locations by associated node
  async getLocationsByNode(nodeId: number): Promise<CythroDashLocation[]> {
    const collection = await locationsCollection.getCollection();
    return await collection.find({ 
      associated_nodes: { $in: [nodeId] } 
    }).sort({ priority: 1, name: 1 }).toArray();
  }

  // Add node to location
  async addNodeToLocation(locationId: string, nodeId: number): Promise<boolean> {
    const collection = await locationsCollection.getCollection();
    
    const result = await collection.updateOne(
      { id: locationId },
      {
        $addToSet: { associated_nodes: nodeId },
        $set: { updated_at: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }

  // Remove node from location
  async removeNodeFromLocation(locationId: string, nodeId: number): Promise<boolean> {
    const collection = await locationsCollection.getCollection();
    
    const result = await collection.updateOne(
      { id: locationId },
      {
        $pull: { associated_nodes: nodeId },
        $set: { updated_at: new Date() }
      }
    );

    return result.modifiedCount > 0;
  }
}

// Export singleton instance
export const locationOperations = new LocationOperations();
