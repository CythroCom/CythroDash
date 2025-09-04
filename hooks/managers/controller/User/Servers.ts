/**
 * CythroDash - User Server Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { serverOperations, CreateServerData, UpdateServerData, ServerFilters } from '../../database/servers';
import { userOperations } from '../../database/user';
import { planOperations } from '../../database/plan';
import { locationOperations } from '../../database/location';
import { serverTypeOperations } from '../../database/server-type';
import { serverSoftwareOperations } from '../../database/server-software';
import {
  panelServerCreate,
  panelServerGetDetails,
  panelServerUpdateDetails,
  panelServerDelete,
  panelServerStart,
  panelServerStop,
  panelServerRestart,
  panelServerKill,
  PterodactylServer
} from '../../pterodactyl/servers';
import { parseBillingCycle } from '@/lib/billing-cycle';
import {
  CythroDashServer,
  ServerStatus,
  BillingStatus,
  PowerState,
  ServerHelpers,
  ServerSummary
} from '../../../../database/tables/cythro_dash_servers';

// Server creation request interface
export interface ServerCreationRequest {
  name: string;
  description?: string;
  server_type_id: string;
  software_id: string;
  location_id: string;
  plan_id: string;
  environment_variables?: Record<string, string>;
  startup_command?: string;
  docker_image?: string;
}

// Server management response interface
export interface ServerManagementResponse {
  success: boolean;
  message: string;
  server?: CythroDashServer;
  pterodactyl_data?: any;
}

// Frontend server interface (transformed from database)
export interface FrontendServer {
  id: string;
  pterodactyl_id?: number;
  pterodactyl_identifier?: string;
  name: string;
  description?: string;
  status: string;
  resources?: {
    memory: { used: number; limit: number; percentage: number };
    disk: { used: number; limit: number; percentage: number };
    cpu: { used: number; limit: number; percentage: number };
  };
  players: string;
  cpu: string;
  memory: string;
  uptime: string;
  type: string;
  created_at?: string;
  updated_at?: string;
}

// Server list response interface
export interface ServerListResponse {
  success: boolean;
  message: string;
  servers: FrontendServer[];
  total_count: number;
  user_limits?: {
    max_servers: number;
    current_count: number;
    can_create_more: boolean;
  };
}

export const ServersController = {
  /**
   * Create a new server (combines database and Pterodactyl operations)
   */
  async createServer(userId: number, request: ServerCreationRequest): Promise<ServerManagementResponse> {
    try {
      console.log('ServersController.createServer called with:', { userId, request });

      // Validate user exists and has permissions
      const user = await userOperations.getUserById(userId);
      console.log('User lookup result:', user ? { id: user.id, coins: user.coins, banned: user.banned, deleted: user.deleted } : 'null');

      if (!user) {
        console.log('User not found, returning error');
        return { success: false, message: 'User not found' };
      }

      if (user.banned || user.deleted) {
        console.log('User banned or deleted, returning error');
        return { success: false, message: 'Account is suspended or deleted' };
      }

      // Validate plan and get pricing
      console.log('Looking up plan:', request.plan_id);
      const plan = await planOperations.getPlanById(request.plan_id);
      console.log('Plan lookup result:', plan ? { id: plan.id, name: plan.name, price: plan.price, setup_fee: plan.setup_fee } : 'null');

      if (!plan) {
        console.log('Plan not found, returning error');
        return { success: false, message: 'Invalid plan selected' };
      }

      // Calculate total cost
      const planPrice = plan.price || 0;
      const setupFee = plan.setup_fee || 0;
      const totalCost = planPrice + setupFee;
      console.log('Cost calculation:', { planPrice, setupFee, totalCost, userCoins: user.coins });

      // Check user balance
      if (user.coins < totalCost) {
        console.log('Insufficient coins, returning error');
        return {
          success: false,
          message: `Insufficient coins. You need ${totalCost} coins but only have ${user.coins} coins.`
        };
      }

      // Validate other references
      console.log('Validating references:', {
        server_type_id: request.server_type_id,
        software_id: request.software_id,
        location_id: request.location_id
      });

      const [serverType, serverSoftware, location] = await Promise.all([
        serverTypeOperations.getServerTypeById(request.server_type_id),
        serverSoftwareOperations.getServerSoftwareById(request.software_id),
        locationOperations.getLocationById(request.location_id)
      ]);

      console.log('Reference validation results:', {
        serverType: serverType ? { id: serverType.id, name: serverType.name } : 'null',
        serverSoftware: serverSoftware ? { id: serverSoftware.id, name: serverSoftware.name } : 'null',
        location: location ? { id: location.id, name: location.name } : 'null'
      });

      if (!serverType || !serverSoftware || !location) {
        console.log('Invalid references, returning error');
        return { success: false, message: 'Invalid server configuration references' };
      }

      console.log('All references validated successfully, proceeding to server creation...');

      // Generate unique server ID
      console.log('About to generate server ID...');
      let serverId: string;
      try {
        console.log('Calling ServerHelpers.generateServerId()...');
        serverId = ServerHelpers.generateServerId();
        console.log('Generated server ID successfully:', serverId);
      } catch (error) {
        console.error('Error generating server ID:', error);
        return { success: false, message: 'Failed to generate server ID' };
      }

      // Prepare server data for database
      console.log('Preparing server data for database...');
      const serverData: CreateServerData = {
        id: serverId,
        name: request.name,
        description: request.description,
        user_id: userId,
        server_type_id: request.server_type_id,
        software_id: request.software_id,
        location_id: request.location_id,
        status: ServerStatus.CREATING,
        power_state: PowerState.OFFLINE,
        billing_status: BillingStatus.ACTIVE,
        limits: {
          memory: plan.resources?.memory || 1024,
          disk: plan.resources?.disk || 10240,
          cpu: plan.resources?.cpu || 1,
          swap: plan.resources?.swap || 0,
          io: plan.resources?.io || 500,
          databases: plan.resources?.databases || 0,
          allocations: 1,
          backups: plan.resources?.backups || 0
        },
        configuration: {
          environment_variables: request.environment_variables || {},
          auto_start: true,
          crash_detection: true,
          backup_enabled: true,
          startup_command: request.startup_command
        },
        billing: {
          plan_id: request.plan_id,
          next_billing_date: (() => {
            const cycle = (plan as any).billing_cycle_value
              ? String((plan as any).billing_cycle_value)
              : (plan.billing_cycle === 'hourly' ? '1h' : plan.billing_cycle === 'daily' ? '1d' : plan.billing_cycle === 'weekly' ? '7d' : '1month');
            const now = new Date();
            return new Date(now.getTime() + parseBillingCycle(cycle).ms);
          })(),
          total_cost: 0,
          monthly_cost: planPrice,
          setup_fee_paid: setupFee,
          billing_cycle: (plan as any).billing_cycle_value || plan.billing_cycle || 'monthly'
        }
      } as any;

      // Also set expiry_date on the server document
      const cycleStr = (plan as any).billing_cycle_value
        ? String((plan as any).billing_cycle_value)
        : (plan.billing_cycle === 'hourly' ? '1h' : plan.billing_cycle === 'daily' ? '1d' : plan.billing_cycle === 'weekly' ? '7d' : '1month');
      const nowForExpiry = new Date();
      (serverData as any).expiry_date = new Date(nowForExpiry.getTime() + parseBillingCycle(cycleStr).ms);

      console.log('Server data prepared:', {
        id: serverData.id,
        name: serverData.name,
        user_id: serverData.user_id,
        limits: serverData.limits,
        billing: serverData.billing
      });

      // Create server in database first
      console.log('Creating server in database...');
      let dbResult;
      try {
        dbResult = await serverOperations.createServer(serverData);
        console.log('Database creation result:', {
          success: dbResult.success,
          message: dbResult.message,
          server: dbResult.server ? { id: dbResult.server.id, name: dbResult.server.name } : null
        });
      } catch (dbError) {
        console.error('Database creation threw an exception:', dbError);
        console.error('Database error stack:', dbError instanceof Error ? dbError.stack : 'No stack trace');
        return { success: false, message: `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}` };
      }

      if (!dbResult.success || !dbResult.server) {
        console.log('Database creation failed, returning error');
        console.log('Full database result:', dbResult);
        return { success: false, message: dbResult.message || 'Database operation failed' };
      }

      console.log('Server created in database successfully, proceeding to Pterodactyl...');

      try {
        // Create server in Pterodactyl
        console.log('Preparing Pterodactyl server creation data...');

        // Prepare environment variables with defaults from server software
        const environmentVariables: Record<string, any> = {};

        // Add default values from server software configuration
        if (serverSoftware.environment_variables && serverSoftware.environment_variables.length > 0) {
          for (const envVar of serverSoftware.environment_variables) {
            environmentVariables[envVar.name] = envVar.default_value;
          }
        } else {
          // Fallback: Add common Minecraft server environment variables if none are configured
          console.log('No environment variables found in server software, using fallback defaults');
          environmentVariables['SERVER_JARFILE'] = 'server.jar';
          environmentVariables['BUILD_NUMBER'] = 'latest';
          environmentVariables['MINECRAFT_VERSION'] = serverSoftware.version_info?.minecraft_version || '1.21.2';
          environmentVariables['VANILLA_VERSION'] = serverSoftware.version_info?.minecraft_version || '1.21.2';
        }

        // Override with user-provided values
        if (request.environment_variables) {
          Object.assign(environmentVariables, request.environment_variables);
        }

        console.log('Environment variables prepared:', environmentVariables);

        const pterodactylData = {
          name: request.name,
          user: userId,
          egg: serverSoftware.pterodactyl_egg_id,
          docker_image: request.docker_image || serverSoftware.docker_config?.image,
          startup: request.startup_command || serverSoftware.docker_config?.startup_command,
          environment: environmentVariables,
          limits: {
            memory: serverData.limits.memory,
            swap: serverData.limits.swap,
            disk: serverData.limits.disk,
            io: serverData.limits.io,
            cpu: serverData.limits.cpu * 100,
            threads: undefined,
            oom_disabled: false
          },
          feature_limits: {
            databases: serverData.limits.databases,
            allocations: 1,
            backups: serverData.limits.backups
          },
          deploy: {
            locations: [location.pterodactyl_location_id],
            dedicated_ip: false,
            port_range: []
          }
        };

        console.log('Pterodactyl data prepared:', {
          name: pterodactylData.name,
          user: pterodactylData.user,
          egg: pterodactylData.egg,
          limits: pterodactylData.limits,
          locations: pterodactylData.deploy.locations
        });

        console.log('Calling Pterodactyl API to create server...');
        let pterodactylResult;
        try {
          pterodactylResult = await panelServerCreate(pterodactylData);
          console.log('Pterodactyl API call completed');
          try {
            const { serverLogsOperations } = await import('@/hooks/managers/database/server-logs')
            const { ServerLogAction } = await import('@/database/tables/cythro_dash_server_logs')
            await serverLogsOperations.log({
              server_id: serverId,
              user_id: userId,
              action: ServerLogAction.CREATE,
              message: 'Server created',
            })
          } catch {}
          console.log('Pterodactyl result:', {
            success: !!pterodactylResult,
            hasAttributes: !!pterodactylResult?.attributes,
            attributes: pterodactylResult?.attributes ? {
              id: pterodactylResult.attributes.id,
              uuid: pterodactylResult.attributes.uuid,
              identifier: pterodactylResult.attributes.identifier
            } : null
          });
        } catch (pterodactylError) {
          console.error('Pterodactyl API call threw an exception:', pterodactylError);
          console.error('Pterodactyl error stack:', pterodactylError instanceof Error ? pterodactylError.stack : 'No stack trace');
          console.error('Pterodactyl error details:', {
            message: pterodactylError instanceof Error ? pterodactylError.message : String(pterodactylError),
            name: pterodactylError instanceof Error ? pterodactylError.name : 'Unknown',
            cause: pterodactylError instanceof Error ? pterodactylError.cause : undefined
          });

          // Clean up database entry since Pterodactyl creation failed
          try {
            await serverOperations.deleteServer(serverId, 'Pterodactyl creation failed', userId);
            console.log('Cleaned up database entry after Pterodactyl failure');
          } catch (cleanupError) {
            console.error('Failed to cleanup database entry:', cleanupError);
          }

          return {
            success: false,
            message: `Failed to create server in game panel: ${pterodactylError instanceof Error ? pterodactylError.message : String(pterodactylError)}`
          };
        }

        if (pterodactylResult && pterodactylResult.attributes) {
          // Update database with Pterodactyl server info
          await serverOperations.updateServer(serverId, {
            pterodactyl_server_id: pterodactylResult.attributes.id,
            pterodactyl_uuid: pterodactylResult.attributes.uuid,
            pterodactyl_identifier: pterodactylResult.attributes.identifier,
            status: ServerStatus.ACTIVE
          });

          // Deduct coins from user
          const deductionNote = `Server creation: ${request.name} (Plan: ${plan.name}, Cost: ${totalCost} coins)`;
          await userOperations.updateCoins(userId, -totalCost, deductionNote);

          // Get updated server data
          const updatedServer = await serverOperations.getServerById(serverId);

          return {
            success: true,
            message: 'Server created successfully',
            server: updatedServer || dbResult.server,
            pterodactyl_data: pterodactylResult.attributes
          };
        } else {
          // Pterodactyl creation failed, update database status
          console.log('Pterodactyl result missing attributes, marking as failed');
          console.log('Full Pterodactyl result:', pterodactylResult);

          await serverOperations.updateServer(serverId, {
            status: ServerStatus.ERROR,
            creation_error: 'Failed to create server in game panel - no attributes returned'
          });

          return {
            success: false,
            message: 'Failed to create server in game panel - invalid response from panel'
          };
        }
      } catch (pterodactylError) {
        console.error('Outer catch block - Pterodactyl creation failed:', pterodactylError);
        console.error('Outer catch error stack:', pterodactylError instanceof Error ? pterodactylError.stack : 'No stack trace');

        // Pterodactyl creation failed, update database status
        await serverOperations.updateServer(serverId, {
          status: ServerStatus.ERROR,
          creation_error: `Pterodactyl error: ${pterodactylError instanceof Error ? pterodactylError.message : String(pterodactylError)}`
        });

        return {
          success: false,
          message: `Failed to create server in game panel: ${pterodactylError instanceof Error ? pterodactylError.message : String(pterodactylError)}`
        };
      }
    } catch (error) {
      console.error('Top-level error in createServer:', error);
      console.error('Top-level error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Top-level error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        cause: error instanceof Error ? error.cause : undefined
      });

      return {
        success: false,
        message: `An unexpected error occurred while creating the server: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  /**
   * Get user's servers
   */
  async getUserServers(userId: number, filters: Partial<ServerFilters> = {}): Promise<ServerListResponse> {
    try {
      const user = await userOperations.getUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found', servers: [], total_count: 0 };
      }

      // Add user filter
      const serverFilters: ServerFilters = { ...filters, user_id: userId };
      
      // Get servers from database
      const dbServers = await serverOperations.getServers(serverFilters);
      const totalCount = await serverOperations.getServerCountByUser(userId);

      // Transform database servers to frontend format
      const servers = dbServers.map(dbServer => ({
        id: dbServer.id,
        pterodactyl_id: dbServer.pterodactyl_server_id,
        pterodactyl_identifier: dbServer.pterodactyl_identifier,
        name: dbServer.name,
        description: dbServer.description,
        status: dbServer.status.toLowerCase() as any, // Convert to frontend status format

        // Resource information (placeholder for now)
        resources: {
          memory: {
            used: 0,
            limit: dbServer.limits?.memory || 0,
            percentage: 0
          },
          disk: {
            used: 0,
            limit: dbServer.limits?.disk || 0,
            percentage: 0
          },
          cpu: {
            used: 0,
            limit: dbServer.limits?.cpu || 0,
            percentage: 0
          }
        },

        // Legacy compatibility properties
        players: "0/0", // Placeholder
        cpu: "0%", // Placeholder
        memory: "0%", // Placeholder
        uptime: "0m", // Placeholder
        type: "Minecraft" as any, // Default type

        // Timestamps
        created_at: dbServer.created_at?.toISOString(),
        updated_at: dbServer.updated_at?.toISOString()
      }));

      return {
        success: true,
        message: 'Servers retrieved successfully',
        servers,
        total_count: totalCount,
        user_limits: {
          max_servers: user.max_servers || 10,
          current_count: totalCount,
          can_create_more: totalCount < (user.max_servers || 10)
        }
      };
    } catch (error) {
      console.error('Error getting user servers:', error);
      return {
        success: false,
        message: 'Failed to retrieve servers',
        servers: [],
        total_count: 0
      };
    }
  },

  /**
   * Get server details (combines database and Pterodactyl data)
   */
  async getServerDetails(userId: number, serverId: string): Promise<ServerManagementResponse> {
    try {
      // Get server from database
      const server = await serverOperations.getServerById(serverId);
      if (!server) {
        return { success: false, message: 'Server not found' };
      }

      // Check ownership
      if (server.user_id !== userId) {
        return { success: false, message: 'Access denied' };
      }

      // Get Pterodactyl data if available
      let pterodactylData = null;
      if (server.pterodactyl_server_id) {
        try {
          pterodactylData = await panelServerGetDetails(server.pterodactyl_server_id);
        } catch (error) {
          console.warn('Failed to get Pterodactyl data for server:', serverId, error);
        }
      }

      return {
        success: true,
        message: 'Server details retrieved successfully',
        server,
        pterodactyl_data: pterodactylData
      };
    } catch (error) {
      console.error('Error getting server details:', error);
      return {
        success: false,
        message: 'Failed to retrieve server details'
      };
    }
  },

  /**
   * Start server (Pterodactyl + database update)
   */
  async startServer(userId: number, serverId: string): Promise<ServerManagementResponse> {
    try {
      const server = await serverOperations.getServerById(serverId);
      if (!server || server.user_id !== userId) {
        return { success: false, message: 'Server not found or access denied' };
      }

      if (!server.pterodactyl_server_id) {
        return { success: false, message: 'Server not linked to game panel' };
      }

      if (!ServerHelpers.canBeStarted(server)) {
        return { success: false, message: 'Server cannot be started in current state' };
      }

      // Start server in Pterodactyl
      await panelServerStart(server.pterodactyl_server_id);

      // Update database
      await serverOperations.updateServer(serverId, {
        power_state: PowerState.STARTING,
        last_activity: new Date()
      });

      return {
        success: true,
        message: 'Server start command sent successfully',
        server: await serverOperations.getServerById(serverId) || server
      };
    } catch (error) {
      console.error('Error starting server:', error);
      return { success: false, message: 'Failed to start server' };
    }
  },

  /**
   * Stop server (Pterodactyl + database update)
   */
  async stopServer(userId: number, serverId: string): Promise<ServerManagementResponse> {
    try {
      const server = await serverOperations.getServerById(serverId);
      if (!server || server.user_id !== userId) {
        return { success: false, message: 'Server not found or access denied' };
      }

      if (!server.pterodactyl_server_id) {
        return { success: false, message: 'Server not linked to game panel' };
      }

      if (!ServerHelpers.canBeStopped(server)) {
        return { success: false, message: 'Server cannot be stopped in current state' };
      }

      // Stop server in Pterodactyl
      await panelServerStop(server.pterodactyl_server_id);

      // Update database
      await serverOperations.updateServer(serverId, {
        power_state: PowerState.STOPPING,
        last_activity: new Date()
      });

      return {
        success: true,
        message: 'Server stop command sent successfully',
        server: await serverOperations.getServerById(serverId) || server
      };
    } catch (error) {
      console.error('Error stopping server:', error);
      return { success: false, message: 'Failed to stop server' };
    }
  },

  /**
   * Restart server (Pterodactyl + database update)
   */
  async restartServer(userId: number, serverId: string): Promise<ServerManagementResponse> {
    try {
      const server = await serverOperations.getServerById(serverId);
      if (!server || server.user_id !== userId) {
        return { success: false, message: 'Server not found or access denied' };
      }

      if (!server.pterodactyl_server_id) {
        return { success: false, message: 'Server not linked to game panel' };
      }

      // Restart server in Pterodactyl
      await panelServerRestart(server.pterodactyl_server_id);

      // Update database
      await serverOperations.updateServer(serverId, {
        power_state: PowerState.STARTING,
        last_activity: new Date()
      });

      return {
        success: true,
        message: 'Server restart command sent successfully',
        server: await serverOperations.getServerById(serverId) || server
      };
    } catch (error) {
      console.error('Error restarting server:', error);
      return { success: false, message: 'Failed to restart server' };
    }
  },

  /**
   * Delete server (Pterodactyl + database soft delete)
   */
  async deleteServer(userId: number, serverId: string): Promise<ServerManagementResponse> {
    try {
      const server = await serverOperations.getServerById(serverId);
      if (!server || server.user_id !== userId) {
        return { success: false, message: 'Server not found or access denied' };
      }

      // Delete from Pterodactyl if linked
      if (server.pterodactyl_server_id) {
        try {
          await panelServerDelete(server.pterodactyl_server_id);
        } catch (error) {
          console.warn('Failed to delete server from Pterodactyl:', error);
          // Continue with database deletion even if Pterodactyl fails
        }
      }

      // Soft delete in database
      const deleteResult = await serverOperations.deleteServer(
        serverId,
        'Deleted by user',
        userId
      );
      try {
        const { serverLogsOperations } = await import('@/hooks/managers/database/server-logs')
        const { ServerLogAction } = await import('@/database/tables/cythro_dash_server_logs')
        await serverLogsOperations.log({ server_id: serverId, user_id: userId, action: ServerLogAction.DELETE, message: 'Server deleted' })
      } catch {}

      if (deleteResult) {
        return {
          success: true,
          message: 'Server deleted successfully',
          server: await serverOperations.getServerById(serverId) || server
        };
      } else {
        return { success: false, message: 'Failed to delete server from database' };
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      return { success: false, message: 'Failed to delete server' };
    }
  },

  /**
   * Update server settings (database only)
   */
  async updateServerSettings(userId: number, serverId: string, updateData: UpdateServerData): Promise<ServerManagementResponse> {
    try {
      const server = await serverOperations.getServerById(serverId);
      if (!server || server.user_id !== userId) {
        return { success: false, message: 'Server not found or access denied' };
      }

      // Update server in database
      const updateResult = await serverOperations.updateServer(serverId, updateData);

      if (updateResult) {
        return {
          success: true,
          message: 'Server settings updated successfully',
          server: await serverOperations.getServerById(serverId) || server
        };
      } else {
        return { success: false, message: 'Failed to update server settings' };
      }
    } catch (error) {
      console.error('Error updating server settings:', error);
      return { success: false, message: 'Failed to update server settings' };
    }
  }
};

export default ServersController;
