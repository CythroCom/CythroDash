/**
 * CythroDash - Server Software Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import {
  CythroDashServerSoftware,
  SoftwareStatus,
  SoftwareStability,
  SoftwareSummary,
  ServerSoftwareHelpers,
  SERVER_SOFTWARE_COLLECTION
} from '../../../database/tables/cythro_dash_server_software';

// Server software collection class
class CythroDashServerSoftwareCollection {
  private collection: Collection<CythroDashServerSoftware> | null = null;

  async getCollection(): Promise<Collection<CythroDashServerSoftware>> {
    if (!this.collection) {
      const db = await connectToDatabase();
      this.collection = db.collection<CythroDashServerSoftware>(SERVER_SOFTWARE_COLLECTION);
      await this.createIndexes();
    }
    return this.collection;
  }

  private async createIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection();
      
      // Unique indexes
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ pterodactyl_egg_id: 1 }, { unique: true });
      
      // Performance indexes
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ server_type_id: 1 });
      await collection.createIndex({ software_type: 1 });
      await collection.createIndex({ display_order: 1 });
      await collection.createIndex({ featured: 1 });
      await collection.createIndex({ recommended: 1 });
      await collection.createIndex({ created_at: -1 });
      
      // Compound indexes
      await collection.createIndex({ server_type_id: 1, status: 1 });
      await collection.createIndex({ status: 1, display_order: 1 });
      await collection.createIndex({ server_type_id: 1, software_type: 1 });
      await collection.createIndex({ featured: 1, status: 1 });
      await collection.createIndex({ recommended: 1, status: 1 });
      
      // Text search index
      await collection.createIndex({ 
        name: "text", 
        description: "text", 
        short_description: "text" 
      });
      
      console.log('Server software database indexes created successfully');
    } catch (error) {
      console.error('Error creating server software database indexes:', error);
    }
  }
}

// Singleton instance
const serverSoftwareCollection = new CythroDashServerSoftwareCollection();

// Server software operations class
class ServerSoftwareOperations {
  // Get all active server software
  async getActiveServerSoftware(): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.find({
      status: SoftwareStatus.ACTIVE
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server software by server type ID
  async getServerSoftwareByType(serverTypeId: string): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.find({
      server_type_id: serverTypeId,
      status: SoftwareStatus.ACTIVE
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server software by software stability
  async getServerSoftwareBySoftwareStability(stability: SoftwareStability): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.find({
      stability: stability,
      status: SoftwareStatus.ACTIVE
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get featured server software
  async getFeaturedServerSoftware(): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.find({
      status: SoftwareStatus.ACTIVE,
      featured: true
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get recommended server software
  async getRecommendedServerSoftware(): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.find({
      status: SoftwareStatus.ACTIVE,
      recommended: true
    }).sort({ display_order: 1, name: 1 }).toArray();
  }

  // Get server software by ID
  async getServerSoftwareById(id: string): Promise<CythroDashServerSoftware | null> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.findOne({ 
      id,
      status: SoftwareStatus.ACTIVE 
    });
  }

  // Get server software by Pterodactyl egg ID
  async getServerSoftwareByEggId(eggId: number): Promise<CythroDashServerSoftware | null> {
    const collection = await serverSoftwareCollection.getCollection();
    return await collection.findOne({ 
      pterodactyl_egg_id: eggId,
      status: SoftwareStatus.ACTIVE 
    });
  }



  // Get server software available for a specific user
  async getServerSoftwareForUser(userId: number, userRole: number, isVerified: boolean): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    
    const query: Filter<CythroDashServerSoftware> = {
      status: SoftwareStatus.ACTIVE,
      $and: [
        // Check minimum user role
        {
          $or: [
            { "access_restrictions.min_user_role": { $exists: false } },
            { "access_restrictions.min_user_role": { $lte: userRole } }
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

  // Search server software
  async searchServerSoftware(searchTerm: string, limit: number = 20): Promise<CythroDashServerSoftware[]> {
    const collection = await serverSoftwareCollection.getCollection();
    
    return await collection
      .find({
        status: SoftwareStatus.ACTIVE,
        $text: { $search: searchTerm }
      })
      .limit(limit)
      .sort({ display_order: 1, name: 1 })
      .toArray();
  }

  // Get server software summaries (for API responses)
  async getServerSoftwareSummaries(
    filters?: {
      serverTypeId?: string;
      stability?: SoftwareStability;
      featured?: boolean;
      recommended?: boolean;
      locationId?: string;
      planId?: string;
      userId?: number;
      userRole?: number;
      isVerified?: boolean;
    }
  ): Promise<SoftwareSummary[]> {
    let serverSoftware: CythroDashServerSoftware[];

    if (filters?.userId !== undefined && filters?.userRole !== undefined && filters?.isVerified !== undefined) {
      serverSoftware = await this.getServerSoftwareForUser(filters.userId, filters.userRole, filters.isVerified);
    } else if (filters?.serverTypeId) {
      serverSoftware = await this.getServerSoftwareByType(filters.serverTypeId);
    } else if (filters?.stability) {
      serverSoftware = await this.getServerSoftwareBySoftwareStability(filters.stability);
    } else if (filters?.featured) {
      serverSoftware = await this.getFeaturedServerSoftware();
    } else if (filters?.recommended) {
      serverSoftware = await this.getRecommendedServerSoftware();
    } else {
      serverSoftware = await this.getActiveServerSoftware();
    }

    // Apply additional filters
    if (filters?.serverTypeId && filters?.userId) {
      serverSoftware = serverSoftware.filter(ss => ss.server_type_id === filters.serverTypeId);
    }

    // Convert to summaries and sort
    return ServerSoftwareHelpers.sortSoftware(serverSoftware).map((ss: CythroDashServerSoftware) => ServerSoftwareHelpers.getSummary(ss));
  }

  // Get server software statistics
  async getServerSoftwareStats(): Promise<{
    total_software: number;
    active_software: number;
    stability_types: Record<SoftwareStability, number>;
    featured_count: number;
    recommended_count: number;
  }> {
    const collection = await serverSoftwareCollection.getCollection();

    const [totalSoftware, activeSoftware, featuredSoftware, recommendedSoftware] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ status: SoftwareStatus.ACTIVE }),
      collection.countDocuments({ status: SoftwareStatus.ACTIVE, featured: true }),
      collection.countDocuments({ status: SoftwareStatus.ACTIVE, recommended: true })
    ]);

    // Get stability type counts
    const stabilityPipeline = [
      { $match: { status: SoftwareStatus.ACTIVE } },
      { $group: { _id: "$stability", count: { $sum: 1 } } }
    ];

    const stabilityResults = await collection.aggregate(stabilityPipeline).toArray();
    const stabilityTypes: Record<SoftwareStability, number> = {} as any;

    // Initialize all stability types with 0
    Object.values(SoftwareStability).forEach(stability => {
      stabilityTypes[stability] = 0;
    });

    // Fill in actual counts
    stabilityResults.forEach(result => {
      if (result._id) {
        stabilityTypes[result._id as SoftwareStability] = result.count;
      }
    });

    return {
      total_software: totalSoftware,
      active_software: activeSoftware,
      stability_types: stabilityTypes,
      featured_count: featuredSoftware,
      recommended_count: recommendedSoftware
    };
  }
}

// Admin server software operations class
class AdminServerSoftwareOperations {
  // Get all server software with pagination and filtering (admin only)
  async getAllServerSoftware(options: {
    filters?: any;
    sort?: any;
    page?: number;
    limit?: number;
    include_stats?: boolean;
  } = {}): Promise<{
    success: boolean;
    message?: string;
    data?: {
      server_software: CythroDashServerSoftware[];
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
      const collection = await serverSoftwareCollection.getCollection();
      const { filters = {}, sort = { display_order: 1 }, page = 1, limit = 25, include_stats = false } = options;

      // Get total count
      const totalItems = await collection.countDocuments(filters);
      const totalPages = Math.ceil(totalItems / limit);
      const skip = (page - 1) * limit;

      // Get server software
      const serverSoftware = await collection
        .find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      // Get stats if requested
      let stats;
      if (include_stats) {
        const [
          totalSoftware,
          activeSoftware,
          disabledSoftware,
          deprecatedSoftware,
          betaSoftware,
          recommendedSoftware,
          latestSoftware
        ] = await Promise.all([
          collection.countDocuments({}),
          collection.countDocuments({ status: SoftwareStatus.ACTIVE }),
          collection.countDocuments({ status: SoftwareStatus.DISABLED }),
          collection.countDocuments({ status: SoftwareStatus.DEPRECATED }),
          collection.countDocuments({ status: SoftwareStatus.BETA }),
          collection.countDocuments({ recommended: true }),
          collection.countDocuments({ latest: true })
        ]);

        stats = {
          total_software: totalSoftware,
          active_software: activeSoftware,
          disabled_software: disabledSoftware,
          deprecated_software: deprecatedSoftware,
          beta_software: betaSoftware,
          recommended_software: recommendedSoftware,
          latest_software: latestSoftware
        };
      }

      return {
        success: true,
        data: {
          server_software: serverSoftware,
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
      console.error('Error getting all server software:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get server software'
      };
    }
  }

  // Get server software by ID (admin - includes all statuses)
  async getServerSoftwareByIdAdmin(id: string): Promise<{
    success: boolean;
    message?: string;
    data?: CythroDashServerSoftware;
  }> {
    try {
      const collection = await serverSoftwareCollection.getCollection();
      const serverSoftware = await collection.findOne({ id });

      if (!serverSoftware) {
        return {
          success: false,
          message: 'Server software not found'
        };
      }

      return {
        success: true,
        data: serverSoftware
      };
    } catch (error) {
      console.error('Error getting server software by ID:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get server software'
      };
    }
  }

  // Create server software
  async createServerSoftware(serverSoftwareData: CythroDashServerSoftware): Promise<{
    success: boolean;
    message?: string;
    data?: CythroDashServerSoftware;
  }> {
    try {
      const collection = await serverSoftwareCollection.getCollection();

      // Check if server software with same ID already exists
      const existingSoftware = await collection.findOne({ id: serverSoftwareData.id });
      if (existingSoftware) {
        return {
          success: false,
          message: 'Server software with this ID already exists'
        };
      }

      // Check if Pterodactyl egg ID is already used
      const existingEgg = await collection.findOne({ pterodactyl_egg_id: serverSoftwareData.pterodactyl_egg_id });
      if (existingEgg) {
        return {
          success: false,
          message: 'Pterodactyl egg ID is already in use'
        };
      }

      // Insert server software
      const result = await collection.insertOne(serverSoftwareData);

      if (!result.acknowledged) {
        return {
          success: false,
          message: 'Failed to create server software'
        };
      }

      // Get the created server software
      const createdSoftware = await collection.findOne({ _id: result.insertedId });

      return {
        success: true,
        message: 'Server software created successfully',
        data: createdSoftware!
      };
    } catch (error) {
      console.error('Error creating server software:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create server software'
      };
    }
  }

  // Update server software
  async updateServerSoftware(id: string, updateData: Partial<CythroDashServerSoftware>): Promise<{
    success: boolean;
    message?: string;
    data?: CythroDashServerSoftware;
  }> {
    try {
      const collection = await serverSoftwareCollection.getCollection();

      // Check if server software exists
      const existingSoftware = await collection.findOne({ id });
      if (!existingSoftware) {
        return {
          success: false,
          message: 'Server software not found'
        };
      }

      // If updating Pterodactyl egg ID, check if it's already used by another software
      if (updateData.pterodactyl_egg_id) {
        const existingEgg = await collection.findOne({
          pterodactyl_egg_id: updateData.pterodactyl_egg_id,
          id: { $ne: id }
        });
        if (existingEgg) {
          return {
            success: false,
            message: 'Pterodactyl egg ID is already in use by another server software'
          };
        }
      }

      // Update server software
      const result = await collection.updateOne(
        { id },
        { $set: { ...updateData, updated_at: new Date() } }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          message: 'Server software not found'
        };
      }

      // Get the updated server software
      const updatedSoftware = await collection.findOne({ id });

      return {
        success: true,
        message: 'Server software updated successfully',
        data: updatedSoftware!
      };
    } catch (error) {
      console.error('Error updating server software:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update server software'
      };
    }
  }

  // Delete server software
  async deleteServerSoftware(id: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const collection = await serverSoftwareCollection.getCollection();

      // Check if server software exists
      const existingSoftware = await collection.findOne({ id });
      if (!existingSoftware) {
        return {
          success: false,
          message: 'Server software not found'
        };
      }

      // TODO: Check if software is being used by any servers
      // This should prevent deletion if there are active servers using this software

      // Delete server software
      const result = await collection.deleteOne({ id });

      if (result.deletedCount === 0) {
        return {
          success: false,
          message: 'Failed to delete server software'
        };
      }

      return {
        success: true,
        message: 'Server software deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting server software:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete server software'
      };
    }
  }
}

// Export singleton instances
export const serverSoftwareOperations = new ServerSoftwareOperations();
export const adminServerSoftwareOperations = new AdminServerSoftwareOperations();

// Export functions for API routes
export const serverSoftwareGetAll = adminServerSoftwareOperations.getAllServerSoftware.bind(adminServerSoftwareOperations);
export const serverSoftwareGetById = adminServerSoftwareOperations.getServerSoftwareByIdAdmin.bind(adminServerSoftwareOperations);
export const serverSoftwareCreate = adminServerSoftwareOperations.createServerSoftware.bind(adminServerSoftwareOperations);
export const serverSoftwareUpdate = adminServerSoftwareOperations.updateServerSoftware.bind(adminServerSoftwareOperations);
export const serverSoftwareDelete = adminServerSoftwareOperations.deleteServerSoftware.bind(adminServerSoftwareOperations);
