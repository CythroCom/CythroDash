/**
 * CythroDash - Server Type Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import {
  CythroDashServerType,
  ServerTypeStatus,
  ServerTypeCategory,
  ServerTypeSummary,
  ServerTypeHelpers,
  SERVER_TYPES_COLLECTION
} from '../../../database/tables/cythro_dash_server_types';

// Server type collection class
class CythroDashServerTypesCollection {
  private collection: Collection<CythroDashServerType> | null = null;

  async getCollection(): Promise<Collection<CythroDashServerType>> {
    if (!this.collection) {
      const db = await connectToDatabase();
      this.collection = db.collection<CythroDashServerType>(SERVER_TYPES_COLLECTION);
      await this.createIndexes();
    }
    return this.collection;
  }

  private async createIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection();
      
      // Unique indexes
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ pterodactyl_nest_id: 1 }, { unique: true });
      
      // Performance indexes
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ category: 1 });
      await collection.createIndex({ display_order: 1 });
      await collection.createIndex({ featured: 1 });
      await collection.createIndex({ popular: 1 });
      await collection.createIndex({ created_at: -1 });
      
      // Compound indexes
      await collection.createIndex({ status: 1, display_order: 1 });
      await collection.createIndex({ category: 1, status: 1 });
      await collection.createIndex({ featured: 1, status: 1 });
      await collection.createIndex({ popular: 1, status: 1 });
      
      // Text search index
      await collection.createIndex({ 
        name: "text", 
        description: "text", 
        short_description: "text" 
      });
      
      console.log('Server type database indexes created successfully');
    } catch (error) {
      console.error('Error creating server type database indexes:', error);
    }
  }
}

// Singleton instance
const serverTypesCollection = new CythroDashServerTypesCollection();

// Server type operations class
class ServerTypeOperations {
  // Get all active server types for users
  async getActiveServerTypes(): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.find({
      status: ServerTypeStatus.ACTIVE
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server types by category
  async getServerTypesByCategory(category: ServerTypeCategory): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.find({
      status: ServerTypeStatus.ACTIVE,
      category: category
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get featured server types
  async getFeaturedServerTypes(): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.find({
      status: ServerTypeStatus.ACTIVE,
      featured: true
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get popular server types
  async getPopularServerTypes(): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.find({
      status: ServerTypeStatus.ACTIVE,
      popular: true
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server type by ID
  async getServerTypeById(id: string): Promise<CythroDashServerType | null> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.findOne({ 
      id,
      status: ServerTypeStatus.ACTIVE 
    });
  }

  // Get server type by Pterodactyl nest ID
  async getServerTypeByNestId(nestId: number): Promise<CythroDashServerType | null> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.findOne({ 
      pterodactyl_nest_id: nestId,
      status: ServerTypeStatus.ACTIVE 
    });
  }

  // Get server types available for a specific location
  async getServerTypesForLocation(locationId: string): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.find({
      status: ServerTypeStatus.ACTIVE,
      $and: [
        {
          $or: [
            { allowed_locations: { $exists: false } },
            { allowed_locations: { $size: 0 } },
            { allowed_locations: { $in: [locationId] } }
          ]
        },
        {
          $or: [
            { blocked_locations: { $exists: false } },
            { blocked_locations: { $size: 0 } },
            { blocked_locations: { $nin: [locationId] } }
          ]
        }
      ]
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server types available for a specific plan
  async getServerTypesForPlan(planId: string): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    return await collection.find({
      status: ServerTypeStatus.ACTIVE,
      $and: [
        {
          $or: [
            { allowed_plans: { $exists: false } },
            { allowed_plans: { $size: 0 } },
            { allowed_plans: { $in: [planId] } }
          ]
        },
        {
          $or: [
            { blocked_plans: { $exists: false } },
            { blocked_plans: { $size: 0 } },
            { blocked_plans: { $nin: [planId] } }
          ]
        }
      ]
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server types available for a specific user
  async getServerTypesForUser(userId: number, userRole: number, isVerified: boolean): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    
    const query: Filter<CythroDashServerType> = {
      status: ServerTypeStatus.ACTIVE,
      $and: [
        // Check minimum user role
        {
          $or: [
            { "access_restrictions.min_user_role": { $exists: false } },
            { "access_restrictions.min_user_role": { $gte: userRole } }
          ]
        },
        // Check verification requirement
        {
          $or: [
            { "access_restrictions.requires_verification": { $ne: true } },
            { "access_restrictions.requires_verification": true, $expr: { $eq: [isVerified, true] } }
          ]
        },
        // Check whitelist (if exists, user must be in it)
        {
          $or: [
            { "access_restrictions.whitelist_users": { $exists: false } },
            { "access_restrictions.whitelist_users": { $size: 0 } },
            { "access_restrictions.whitelist_users": { $in: [userId] } }
          ]
        }
      ]
    };

    return await collection.find(query).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Search server types
  async searchServerTypes(searchTerm: string, limit: number = 20): Promise<CythroDashServerType[]> {
    const collection = await serverTypesCollection.getCollection();
    
    return await collection
      .find({
        status: ServerTypeStatus.ACTIVE,
        $text: { $search: searchTerm }
      })
      .limit(limit)
      .sort({ display_order: 1, name: 1 })
      .toArray();
  }

  // Get server type summaries (for API responses)
  async getServerTypeSummaries(
    filters?: {
      category?: ServerTypeCategory;
      featured?: boolean;
      popular?: boolean;
      locationId?: string;
      planId?: string;
      userId?: number;
      userRole?: number;
      isVerified?: boolean;
    }
  ): Promise<ServerTypeSummary[]> {
    // Start from active types to avoid subtle DB query mismatches and do deterministic filtering in code
    let serverTypes: CythroDashServerType[] = await this.getActiveServerTypes();

    // Basic property filters
    if (filters?.category) {
      serverTypes = serverTypes.filter(st => st.category === filters.category);
    }
    if (filters?.featured !== undefined) {
      serverTypes = serverTypes.filter(st => !!st.featured === !!filters.featured);
    }
    if (filters?.popular !== undefined) {
      serverTypes = serverTypes.filter(st => !!st.popular === !!filters.popular);
    }

    // Availability filters
    if (filters?.userId !== undefined && filters.userRole !== undefined && filters.isVerified !== undefined) {
      // Use helper that applies min_user_role, verification, whitelist and optional location in a single place
      serverTypes = ServerTypeHelpers.getAvailableForUser(
        serverTypes,
        filters.userRole,
        filters.isVerified,
        filters.locationId,
        filters.userId
      );
    } else {
      if (filters?.locationId) {
        serverTypes = serverTypes.filter(st => this.isServerTypeAvailableForLocation(st, filters.locationId!));
      }
      if (filters?.planId) {
        serverTypes = serverTypes.filter(st => this.isServerTypeAvailableForPlan(st, filters.planId!));
      }
    }

    // Convert to summaries and sort
    return ServerTypeHelpers.sortServerTypes(serverTypes).map(st => ServerTypeHelpers.getSummary(st));
  }

  // Check if server type is available for location
  private isServerTypeAvailableForLocation(serverType: CythroDashServerType, locationId: string): boolean {
    // Check allowed locations
    if (serverType.allowed_locations && serverType.allowed_locations.length > 0) {
      if (!serverType.allowed_locations.includes(locationId)) {
        return false;
      }
    }

    // Check blocked locations
    if (serverType.blocked_locations && serverType.blocked_locations.length > 0) {
      if (serverType.blocked_locations.includes(locationId)) {
        return false;
      }
    }

    return true;
  }

  // Check if server type is available for plan
  private isServerTypeAvailableForPlan(serverType: CythroDashServerType, planId: string): boolean {
    // Check allowed plans
    if (serverType.allowed_plans && serverType.allowed_plans.length > 0) {
      if (!serverType.allowed_plans.includes(planId)) {
        return false;
      }
    }

    // Check blocked plans
    if (serverType.blocked_plans && serverType.blocked_plans.length > 0) {
      if (serverType.blocked_plans.includes(planId)) {
        return false;
      }
    }

    return true;
  }

  // Get server type statistics
  async getServerTypeStats(): Promise<{
    total_types: number;
    active_types: number;
    categories: Record<ServerTypeCategory, number>;
    featured_count: number;
    popular_count: number;
  }> {
    const collection = await serverTypesCollection.getCollection();
    
    const [totalTypes, activeTypes, featuredTypes, popularTypes] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ status: ServerTypeStatus.ACTIVE }),
      collection.countDocuments({ status: ServerTypeStatus.ACTIVE, featured: true }),
      collection.countDocuments({ status: ServerTypeStatus.ACTIVE, popular: true })
    ]);

    // Get category counts
    const categoryPipeline = [
      { $match: { status: ServerTypeStatus.ACTIVE } },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ];
    
    const categoryResults = await collection.aggregate(categoryPipeline).toArray();
    const categories: Record<ServerTypeCategory, number> = {} as any;
    
    // Initialize all categories with 0
    Object.values(ServerTypeCategory).forEach(category => {
      categories[category] = 0;
    });
    
    // Fill in actual counts
    categoryResults.forEach(result => {
      categories[result._id as ServerTypeCategory] = result.count;
    });

    return {
      total_types: totalTypes,
      active_types: activeTypes,
      categories,
      featured_count: featuredTypes,
      popular_count: popularTypes
    };
  }
}

// Admin server type operations class
class AdminServerTypeOperations {
  // Get all server types with pagination and filtering (admin only)
  async getAllServerTypes(options: {
    filters?: any;
    sort?: any;
    page?: number;
    limit?: number;
    include_stats?: boolean;
  } = {}): Promise<{
    success: boolean;
    message?: string;
    data?: {
      server_types: CythroDashServerType[];
      pagination: {
        current_page: number;
        total_pages: number;
        total_items: number;
        items_per_page: number;
      };
      stats?: any;
    };
  }> {
    try {
      const collection = await serverTypesCollection.getCollection();
      const { filters = {}, sort = { display_order: 1 }, page = 1, limit = 25, include_stats = false } = options;

      // Get total count
      const totalItems = await collection.countDocuments(filters);
      const totalPages = Math.ceil(totalItems / limit);
      const skip = (page - 1) * limit;

      // Get server types
      const serverTypes = await collection
        .find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      // Get stats if requested
      let stats;
      if (include_stats) {
        const [
          totalTypes,
          activeTypes,
          disabledTypes,
          maintenanceTypes,
          featuredTypes,
          gamingTypes,
          botsTypes,
          webTypes,
          databaseTypes,
          otherTypes
        ] = await Promise.all([
          collection.countDocuments({}),
          collection.countDocuments({ status: ServerTypeStatus.ACTIVE }),
          collection.countDocuments({ status: ServerTypeStatus.DISABLED }),
          collection.countDocuments({ status: ServerTypeStatus.MAINTENANCE }),
          collection.countDocuments({ featured: true }),
          collection.countDocuments({ category: ServerTypeCategory.GAMING }),
          collection.countDocuments({ category: ServerTypeCategory.BOTS }),
          collection.countDocuments({ category: ServerTypeCategory.WEB }),
          collection.countDocuments({ category: ServerTypeCategory.DATABASE }),
          collection.countDocuments({ category: ServerTypeCategory.OTHER })
        ]);

        stats = {
          total_types: totalTypes,
          active_types: activeTypes,
          disabled_types: disabledTypes,
          maintenance_types: maintenanceTypes,
          featured_types: featuredTypes,
          gaming_types: gamingTypes,
          bots_types: botsTypes,
          web_types: webTypes,
          database_types: databaseTypes,
          other_types: otherTypes
        };
      }

      return {
        success: true,
        data: {
          server_types: serverTypes,
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_items: totalItems,
            items_per_page: limit
          },
          stats
        }
      };
    } catch (error) {
      console.error('Error getting all server types:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get server types'
      };
    }
  }

  // Get server type by ID (admin - includes all statuses)
  async getServerTypeByIdAdmin(id: string): Promise<{
    success: boolean;
    message?: string;
    data?: CythroDashServerType;
  }> {
    try {
      const collection = await serverTypesCollection.getCollection();
      const serverType = await collection.findOne({ id });

      if (!serverType) {
        return {
          success: false,
          message: 'Server type not found'
        };
      }

      return {
        success: true,
        data: serverType
      };
    } catch (error) {
      console.error('Error getting server type by ID:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get server type'
      };
    }
  }

  // Create server type
  async createServerType(serverTypeData: CythroDashServerType): Promise<{
    success: boolean;
    message?: string;
    data?: CythroDashServerType;
  }> {
    try {
      const collection = await serverTypesCollection.getCollection();

      // Check if server type with same ID already exists
      const existingServerType = await collection.findOne({ id: serverTypeData.id });
      if (existingServerType) {
        return {
          success: false,
          message: 'Server type with this ID already exists'
        };
      }

      // Check if Pterodactyl nest ID is already used
      const existingNest = await collection.findOne({ pterodactyl_nest_id: serverTypeData.pterodactyl_nest_id });
      if (existingNest) {
        return {
          success: false,
          message: 'Pterodactyl nest ID is already in use'
        };
      }

      // Insert server type
      const result = await collection.insertOne(serverTypeData);

      if (!result.acknowledged) {
        return {
          success: false,
          message: 'Failed to create server type'
        };
      }

      // Get the created server type
      const createdServerType = await collection.findOne({ _id: result.insertedId });

      return {
        success: true,
        message: 'Server type created successfully',
        data: createdServerType!
      };
    } catch (error) {
      console.error('Error creating server type:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create server type'
      };
    }
  }

  // Update server type
  async updateServerType(id: string, updateData: Partial<CythroDashServerType>): Promise<{
    success: boolean;
    message?: string;
    data?: CythroDashServerType;
  }> {
    try {
      const collection = await serverTypesCollection.getCollection();

      // Check if server type exists
      const existingServerType = await collection.findOne({ id });
      if (!existingServerType) {
        return {
          success: false,
          message: 'Server type not found'
        };
      }

      // If updating Pterodactyl nest ID, check if it's already used by another server type
      if (updateData.pterodactyl_nest_id) {
        const existingNest = await collection.findOne({
          pterodactyl_nest_id: updateData.pterodactyl_nest_id,
          id: { $ne: id }
        });
        if (existingNest) {
          return {
            success: false,
            message: 'Pterodactyl nest ID is already in use by another server type'
          };
        }
      }

      // Update server type
      const result = await collection.updateOne(
        { id },
        { $set: { ...updateData, updated_at: new Date() } }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          message: 'Server type not found'
        };
      }

      // Get the updated server type
      const updatedServerType = await collection.findOne({ id });

      return {
        success: true,
        message: 'Server type updated successfully',
        data: updatedServerType!
      };
    } catch (error) {
      console.error('Error updating server type:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update server type'
      };
    }
  }

  // Delete server type
  async deleteServerType(id: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const collection = await serverTypesCollection.getCollection();

      // Check if server type exists
      const existingServerType = await collection.findOne({ id });
      if (!existingServerType) {
        return {
          success: false,
          message: 'Server type not found'
        };
      }

      // TODO: Check if server type is being used by any servers
      // This should prevent deletion if there are active servers using this type

      // Delete server type
      const result = await collection.deleteOne({ id });

      if (result.deletedCount === 0) {
        return {
          success: false,
          message: 'Failed to delete server type'
        };
      }

      return {
        success: true,
        message: 'Server type deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting server type:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete server type'
      };
    }
  }
}

// Export singleton instances
export const serverTypeOperations = new ServerTypeOperations();
export const adminServerTypeOperations = new AdminServerTypeOperations();

// Export functions for API routes
export const serverTypesGetAll = adminServerTypeOperations.getAllServerTypes.bind(adminServerTypeOperations);
export const serverTypesGetById = adminServerTypeOperations.getServerTypeByIdAdmin.bind(adminServerTypeOperations);
export const serverTypesCreate = adminServerTypeOperations.createServerType.bind(adminServerTypeOperations);
export const serverTypesUpdate = adminServerTypeOperations.updateServerType.bind(adminServerTypeOperations);
export const serverTypesDelete = adminServerTypeOperations.deleteServerType.bind(adminServerTypeOperations);
