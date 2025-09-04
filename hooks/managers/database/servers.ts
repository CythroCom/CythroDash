/**
 * CythroDash - Server Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter, UpdateFilter, ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import { 
  CythroDashServer, 
  ServerStatus,
  BillingStatus,
  PowerState,
  ServerSummary,
  ServerHelpers,
  SERVERS_COLLECTION,
  ResourceUsage,
  BillingInfo,
  ServerConfiguration,
  ServerLimits
} from '../../../database/tables/cythro_dash_servers';

// Server creation interface
export interface CreateServerData {
  // Required fields
  id: string; // CythroDash server ID
  name: string;
  user_id: number;
  server_type_id: string;
  software_id: string;
  location_id: string;

  // Pterodactyl integration
  pterodactyl_server_id?: number;
  pterodactyl_uuid?: string;
  pterodactyl_identifier?: string;

  // Configuration
  limits: ServerLimits;
  configuration: ServerConfiguration;
  billing: BillingInfo;

  // Optional fields
  description?: string;
  status?: ServerStatus;
  power_state?: PowerState;
  billing_status?: BillingStatus;
  // Lifecycle
  expiry_date?: Date;
  auto_delete_at?: Date;
}

// Server update interface
export interface UpdateServerData {
  name?: string;
  description?: string;
  status?: ServerStatus;
  power_state?: PowerState;
  billing_status?: BillingStatus;
  pterodactyl_server_id?: number;
  pterodactyl_uuid?: string;
  pterodactyl_identifier?: string;
  current_usage?: ResourceUsage;
  configuration?: Partial<ServerConfiguration>;
  billing?: Partial<BillingInfo>;
  last_activity?: Date;
  last_online?: Date;
  creation_error?: string;
  last_error?: string;
  error_count?: number;
}

// Server query filters
export interface ServerFilters {
  user_id?: number;
  status?: ServerStatus;
  billing_status?: BillingStatus;
  power_state?: PowerState;
  server_type_id?: string;
  location_id?: string;
  search?: string; // Search in name and description
}

// Database collection wrapper
class ServersCollection {
  private collection: Collection<CythroDashServer> | null = null;

  async getCollection(): Promise<Collection<CythroDashServer>> {
    if (!this.collection) {
      const db = await connectToDatabase();
      this.collection = db.collection<CythroDashServer>(SERVERS_COLLECTION);
      
      // Create indexes for better performance
      await this.createIndexes();
    }
    return this.collection;
  }

  private async createIndexes(): Promise<void> {
    if (!this.collection) return;

    try {
      // Create indexes for common queries
      await this.collection.createIndex({ user_id: 1 });
      await this.collection.createIndex({ status: 1 });
      await this.collection.createIndex({ billing_status: 1 });
      await this.collection.createIndex({ power_state: 1 });
      await this.collection.createIndex({ pterodactyl_server_id: 1 });
      await this.collection.createIndex({ created_at: -1 });
      await this.collection.createIndex({ user_id: 1, status: 1 });
      await this.collection.createIndex({ user_id: 1, created_at: -1 });
      // Lifecycle indexes
      await this.collection.createIndex({ expiry_date: 1 });
      await this.collection.createIndex({ auto_delete_at: 1 });

      console.log('Server database indexes created successfully');
    } catch (error) {
      console.error('Error creating server database indexes:', error);
    }
  }
}

// Singleton instance
const serversCollection = new ServersCollection();

// Server database operations
export const serverOperations = {
  // Create a new server
  async createServer(serverData: CreateServerData): Promise<{ success: boolean; message: string; server?: CythroDashServer }> {
    try {
      const collection = await serversCollection.getCollection();
      
      // Validate server data
      const validation = ServerHelpers.validateServerData(serverData);
      if (!validation.valid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Check if server ID already exists
      const existingServer = await collection.findOne({ id: serverData.id });
      if (existingServer) {
        return {
          success: false,
          message: 'Server ID already exists'
        };
      }

      // Prepare server document with all required fields
      const defaultValues = ServerHelpers.getDefaultServerValues(serverData.user_id);
      const serverDoc: CythroDashServer = {
        // Required fields from serverData
        id: serverData.id,
        name: serverData.name,
        user_id: serverData.user_id,
        server_type_id: serverData.server_type_id,
        software_id: serverData.software_id,
        location_id: serverData.location_id,
        limits: serverData.limits,
        configuration: serverData.configuration,
        billing: serverData.billing,

        // Optional fields with defaults
        description: serverData.description,
        pterodactyl_server_id: serverData.pterodactyl_server_id,
        pterodactyl_uuid: serverData.pterodactyl_uuid,
        pterodactyl_identifier: serverData.pterodactyl_identifier,
        status: serverData.status || defaultValues.status!,
        power_state: serverData.power_state || defaultValues.power_state!,
        billing_status: serverData.billing_status || defaultValues.billing_status!,

        // Lifecycle
        expiry_date: (serverData as any).expiry_date,
        auto_delete_at: (serverData as any).auto_delete_at,

        // Required fields from defaults
        current_usage: defaultValues.current_usage!,
        network: defaultValues.network!,
        performance: defaultValues.performance!,
        backups: defaultValues.backups!,
        security: defaultValues.security!,
        error_count: defaultValues.error_count!,

        // Timestamps
        created_at: new Date(),
        updated_at: new Date()
      };

      // Insert server
      const result = await collection.insertOne(serverDoc);
      
      if (result.insertedId) {
        const createdServer = await collection.findOne({ _id: result.insertedId });
        return {
          success: true,
          message: 'Server created successfully',
          server: createdServer || undefined
        };
      }

      return {
        success: false,
        message: 'Failed to create server'
      };
    } catch (error) {
      console.error('Error creating server:', error);
      return {
        success: false,
        message: 'Database error occurred while creating server'
      };
    }
  },

  // Get server by ID
  async getServerById(serverId: string): Promise<CythroDashServer | null> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.findOne({ id: serverId });
    } catch (error) {
      console.error('Error getting server by ID:', error);
      return null;
    }
  },

  // Get server by Pterodactyl ID
  async getServerByPterodactylId(pterodactylId: number): Promise<CythroDashServer | null> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.findOne({ pterodactyl_server_id: pterodactylId });
    } catch (error) {
      console.error('Error getting server by Pterodactyl ID:', error);
      return null;
    }
  },

  // Get servers by user ID
  async getServersByUserId(userId: number): Promise<CythroDashServer[]> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.find({ user_id: userId }).sort({ created_at: -1 }).toArray();
    } catch (error) {
      console.error('Error getting servers by user ID:', error);
      return [];
    }
  },

  // Get servers with filters
  async getServers(filters: ServerFilters = {}, limit?: number, skip?: number): Promise<CythroDashServer[]> {
    try {
      const collection = await serversCollection.getCollection();
      
      // Build MongoDB filter
      const mongoFilter: Filter<CythroDashServer> = {};
      
      if (filters.user_id) mongoFilter.user_id = filters.user_id;
      if (filters.status) mongoFilter.status = filters.status;
      if (filters.billing_status) mongoFilter.billing_status = filters.billing_status;
      if (filters.power_state) mongoFilter.power_state = filters.power_state;
      if (filters.server_type_id) mongoFilter.server_type_id = filters.server_type_id;
      if (filters.location_id) mongoFilter.location_id = filters.location_id;
      
      // Search in name and description
      if (filters.search) {
        mongoFilter.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      let query = collection.find(mongoFilter).sort({ created_at: -1 });
      
      if (skip) query = query.skip(skip);
      if (limit) query = query.limit(limit);
      
      return await query.toArray();
    } catch (error) {
      console.error('Error getting servers:', error);
      return [];
    }
  },

  // Update server
  async updateServer(serverId: string, updateData: UpdateServerData): Promise<boolean> {
    try {
      const collection = await serversCollection.getCollection();

      // Build update document with proper type handling
      const updateFields: any = {
        updated_at: new Date()
      };

      // Add fields that can be directly updated
      if (updateData.name !== undefined) updateFields.name = updateData.name;
      if (updateData.description !== undefined) updateFields.description = updateData.description;
      if (updateData.status !== undefined) updateFields.status = updateData.status;
      if (updateData.power_state !== undefined) updateFields.power_state = updateData.power_state;
      if (updateData.billing_status !== undefined) updateFields.billing_status = updateData.billing_status;
      if (updateData.pterodactyl_server_id !== undefined) updateFields.pterodactyl_server_id = updateData.pterodactyl_server_id;
      if (updateData.pterodactyl_uuid !== undefined) updateFields.pterodactyl_uuid = updateData.pterodactyl_uuid;
      if (updateData.pterodactyl_identifier !== undefined) updateFields.pterodactyl_identifier = updateData.pterodactyl_identifier;
      if (updateData.current_usage !== undefined) updateFields.current_usage = updateData.current_usage;
      if (updateData.last_activity !== undefined) updateFields.last_activity = updateData.last_activity;
      if (updateData.last_online !== undefined) updateFields.last_online = updateData.last_online;
      if (updateData.creation_error !== undefined) updateFields.creation_error = updateData.creation_error;
      if (updateData.last_error !== undefined) updateFields.last_error = updateData.last_error;
      if (updateData.error_count !== undefined) updateFields.error_count = updateData.error_count;
      // Lifecycle fields (top-level)
      const anyUpdate: any = updateData as any;
      if (anyUpdate.expiry_date !== undefined) updateFields.expiry_date = anyUpdate.expiry_date;
      if (anyUpdate.auto_delete_at !== undefined) updateFields.auto_delete_at = anyUpdate.auto_delete_at;

      // Handle nested objects with proper merging
      if (updateData.configuration !== undefined) {
        // Get current server to merge configuration
        const currentServer = await collection.findOne({ id: serverId });
        if (currentServer) {
          updateFields.configuration = {
            ...currentServer.configuration,
            ...updateData.configuration,
            environment_variables: {
              ...currentServer.configuration.environment_variables,
              ...(updateData.configuration.environment_variables || {})
            }
          };
        }
      }

      if (updateData.billing !== undefined) {
        // Get current server to merge billing
        const currentServer = await collection.findOne({ id: serverId });
        if (currentServer) {
          updateFields.billing = {
            ...currentServer.billing,
            ...updateData.billing
          };
        }
      }

      const updateDoc: UpdateFilter<CythroDashServer> = {
        $set: updateFields
      };

      const result = await collection.updateOne({ id: serverId }, updateDoc);
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating server:', error);
      return false;
    }
  },

  // Delete server (soft delete)
  async deleteServer(serverId: string, terminationReason: string, terminatedBy?: number): Promise<boolean> {
    try {
      const collection = await serversCollection.getCollection();
      
      const updateDoc: UpdateFilter<CythroDashServer> = {
        $set: {
          status: ServerStatus.TERMINATED,
          billing_status: BillingStatus.TERMINATED,
          termination_info: {
            terminated_at: new Date(),
            terminated_by: terminatedBy,
            termination_reason: terminationReason,
            data_retention_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          },
          updated_at: new Date()
        }
      };

      const result = await collection.updateOne({ id: serverId }, updateDoc);
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error deleting server:', error);
      return false;
    }
  },

  // Get server count by user
  async getServerCountByUser(userId: number): Promise<number> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.countDocuments({ 
        user_id: userId,
        status: { $ne: ServerStatus.TERMINATED }
      });
    } catch (error) {
      console.error('Error getting server count:', error);
      return 0;
    }
  },

  // Get server summaries
  async getServerSummaries(filters: ServerFilters = {}): Promise<ServerSummary[]> {
    try {
      const servers = await this.getServers(filters);
      return servers.map(server => ServerHelpers.getSummary(server));
    } catch (error) {
      console.error('Error getting server summaries:', error);
      return [];
    }
  },

  // Lifecycle helpers
  async findExpiredActiveServers(cutoff: Date): Promise<CythroDashServer[]> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.find({ status: ServerStatus.ACTIVE, expiry_date: { $lte: cutoff } }).toArray();
    } catch (error) {
      console.error('Error finding expired servers:', error);
      return [];
    }
  },

  async markServerSuspended(serverId: string, reason: string, suspendedBy: number, autoDeleteAt: Date): Promise<boolean> {
    try {
      const collection = await serversCollection.getCollection();
      const result = await collection.updateOne({ id: serverId }, {
        $set: {
          status: ServerStatus.SUSPENDED,
          billing_status: BillingStatus.SUSPENDED,
          auto_delete_at: autoDeleteAt,
          'suspension_info.suspended_at': new Date(),
          'suspension_info.suspended_by': suspendedBy,
          'suspension_info.suspension_reason': reason,
          updated_at: new Date()
        }
      });
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking server suspended:', error);
      return false;
    }
  },

  async findSuspendedDueDeletion(cutoff: Date): Promise<CythroDashServer[]> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.find({ status: ServerStatus.SUSPENDED, auto_delete_at: { $lte: cutoff } }).toArray();
    } catch (error) {
      console.error('Error finding servers due deletion:', error);
      return [];
    }
  },

  async findServersMissingExpiry(limit: number = 500): Promise<CythroDashServer[]> {
    try {
      const collection = await serversCollection.getCollection();
      return await collection.find({ expiry_date: { $exists: false }, status: { $in: [ServerStatus.ACTIVE, ServerStatus.SUSPENDED] } }).limit(limit).toArray();
    } catch (error) {
      console.error('Error finding servers missing expiry:', error);
      return [];
    }
  }
};

export default serverOperations;
