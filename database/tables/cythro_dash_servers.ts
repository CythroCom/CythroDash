/**
 * CythroDash - Server Instances Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Server status enumeration
export enum ServerStatus {
  CREATING = 'creating',     // Server is being created
  ACTIVE = 'active',         // Server is active and running
  SUSPENDED = 'suspended',   // Server is suspended (billing issues, violations, etc.)
  TERMINATED = 'terminated', // Server has been terminated
  ERROR = 'error',          // Server creation or operation failed
  MAINTENANCE = 'maintenance' // Server is under maintenance
}

// Billing status enumeration
export enum BillingStatus {
  ACTIVE = 'active',         // Billing is current
  OVERDUE = 'overdue',       // Payment is overdue
  SUSPENDED = 'suspended',   // Suspended due to billing issues
  CANCELLED = 'cancelled',   // Billing cancelled by user
  TERMINATED = 'terminated'  // Terminated due to non-payment
}

// Server power state enumeration
export enum PowerState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  STARTING = 'starting',
  STOPPING = 'stopping',
  CRASHED = 'crashed',
  UNKNOWN = 'unknown'
}

// Resource usage interface
export interface ResourceUsage {
  memory: number; // Used MB
  disk: number;   // Used MB
  cpu: number;    // Used CPU percentage
  network_rx?: number; // Network received in bytes
  network_tx?: number; // Network transmitted in bytes
}

// Billing information interface
export interface BillingInfo {
  plan_id: string; // Current plan ID
  next_billing_date: Date; // Next billing date
  last_billing_date?: Date; // Last successful billing
  total_cost: number; // Total coins spent on this server
  monthly_cost: number; // Current monthly cost in coins
  setup_fee_paid?: number; // Setup fee paid in coins
  overdue_amount?: number; // Amount overdue in coins
  billing_cycle: string; // Billing cycle (monthly, weekly, etc.)
}

// Server configuration interface
export interface ServerConfiguration {
  startup_command?: string; // Custom startup command
  environment_variables: Record<string, string>; // Environment variables
  auto_start: boolean; // Auto-start on boot
  crash_detection: boolean; // Enable crash detection
  backup_enabled: boolean; // Enable automatic backups
  backup_frequency?: string; // Backup frequency (daily, weekly, etc.)
}

// Server limits interface
export interface ServerLimits {
  memory: number; // Memory limit in MB
  disk: number; // Disk limit in MB
  cpu: number; // CPU limit (cores)
  swap: number; // Swap limit in MB
  io: number; // IO weight
  databases: number; // Database limit
  allocations: number; // Port allocation limit
  backups: number; // Backup limit
}

// Server instance interface definition
export interface CythroDashServer {
  _id?: ObjectId;
  
  // Basic identification
  id: string; // CythroDash server ID (unique)
  name: string; // Server name
  description?: string; // Server description
  
  // User and ownership
  user_id: number; // Owner user ID
  
  // Configuration references
  server_type_id: string; // Reference to CythroDashServerType
  software_id: string; // Reference to CythroDashServerSoftware
  location_id: string; // Reference to CythroDashLocation
  
  // Pterodactyl integration
  pterodactyl_server_id?: number; // Pterodactyl server ID (set after creation)
  pterodactyl_uuid?: string; // Pterodactyl server UUID
  pterodactyl_identifier?: string; // Pterodactyl short identifier
  
  // Status and state
  status: ServerStatus;
  power_state: PowerState;
  billing_status: BillingStatus;
  
  // Resource specifications and usage
  limits: ServerLimits;
  current_usage: ResourceUsage;
  
  // Configuration
  configuration: ServerConfiguration;
  
  // Billing information
  billing: BillingInfo;
  
  // Network and connectivity
  network: {
    primary_allocation?: {
      ip: string;
      port: number;
    };
    additional_allocations?: Array<{
      ip: string;
      port: number;
      alias?: string;
    }>;
    domain?: string; // Custom domain if assigned
  };
  
  // Performance and monitoring
  performance: {
    uptime_percentage?: number; // Uptime percentage (last 30 days)
    average_cpu_usage?: number; // Average CPU usage percentage
    average_memory_usage?: number; // Average memory usage percentage
    last_crash?: Date; // Last crash timestamp
    crash_count?: number; // Total crash count
    restart_count?: number; // Total restart count
  };
  
  // Backup information
  backups: {
    last_backup?: Date; // Last successful backup
    backup_count: number; // Total backup count
    backup_size?: number; // Total backup size in MB
    auto_backup_enabled: boolean; // Auto backup status
  };
  
  // Security and access
  security: {
    sftp_enabled: boolean; // SFTP access enabled
    console_access: boolean; // Console access enabled
    file_manager_access: boolean; // File manager access
    database_access: boolean; // Database access enabled
  };
  
  // Metadata and tracking
  created_at: Date;
  updated_at: Date;
  last_activity?: Date; // Last user activity
  last_online?: Date; // Last time server was online

  // Automated lifecycle tracking
  expiry_date?: Date; // When the current billing cycle expires
  auto_delete_at?: Date; // When the server will be auto-deleted after suspension

  // Error tracking and debugging
  creation_error?: string; // Error message if creation failed
  last_error?: string; // Last error message
  error_count: number; // Total error count

  // Suspension and termination
  suspension_info?: {
    suspended_at: Date;
    suspended_by: number; // Admin user ID
    suspension_reason: string;
    auto_unsuspend_date?: Date; // Automatic unsuspension date
  };

  termination_info?: {
    terminated_at: Date;
    terminated_by?: number; // Admin user ID (if manual)
    termination_reason: string;
    data_retention_until?: Date; // When data will be permanently deleted
  };

  // Tags and categorization
  tags?: string[]; // User-defined tags
  notes?: string; // User notes about the server

  // Statistics (for analytics)
  stats?: {
    total_starts: number; // Total times server was started
    total_stops: number; // Total times server was stopped
    total_crashes: number; // Total crashes
    total_uptime_hours: number; // Total uptime in hours
    peak_memory_usage: number; // Peak memory usage in MB
    peak_cpu_usage: number; // Peak CPU usage percentage
  };
}

// Server summary interface (for listings)
export interface ServerSummary {
  id: string;
  name: string;
  status: ServerStatus;
  power_state: PowerState;
  server_type: string;
  location: string;
  uptime_percentage?: number;
  primary_allocation?: {
    ip: string;
    port: number;
  };
  created_at: Date;
}

// Server helper functions
export const ServerHelpers = {
  // Generate a unique server ID
  generateServerId: (): string => {
    return `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Check if server is operational
  isOperational: (server: CythroDashServer): boolean => {
    return (
      server.status === ServerStatus.ACTIVE &&
      server.billing_status === BillingStatus.ACTIVE &&
      server.power_state !== PowerState.CRASHED
    );
  },

  // Check if server can be started
  canBeStarted: (server: CythroDashServer): boolean => {
    return (
      server.status === ServerStatus.ACTIVE &&
      server.billing_status === BillingStatus.ACTIVE &&
      (server.power_state === PowerState.OFFLINE || server.power_state === PowerState.CRASHED)
    );
  },

  // Check if server can be stopped
  canBeStopped: (server: CythroDashServer): boolean => {
    return (
      server.status === ServerStatus.ACTIVE &&
      (server.power_state === PowerState.ONLINE || server.power_state === PowerState.STARTING)
    );
  },

  // Get server display status
  getDisplayStatus: (server: CythroDashServer): string => {
    if (server.status !== ServerStatus.ACTIVE) {
      return server.status.charAt(0).toUpperCase() + server.status.slice(1);
    }
    
    if (server.billing_status !== BillingStatus.ACTIVE) {
      return server.billing_status.charAt(0).toUpperCase() + server.billing_status.slice(1);
    }
    
    return server.power_state.charAt(0).toUpperCase() + server.power_state.slice(1);
  },

  // Calculate resource usage percentage
  getResourceUsagePercentage: (server: CythroDashServer): { memory: number; disk: number; cpu: number } => {
    return {
      memory: server.limits.memory > 0 ? Math.round((server.current_usage.memory / server.limits.memory) * 100) : 0,
      disk: server.limits.disk > 0 ? Math.round((server.current_usage.disk / server.limits.disk) * 100) : 0,
      cpu: Math.round(server.current_usage.cpu),
    };
  },

  // Get server summary
  getSummary: (server: CythroDashServer): ServerSummary => {
    return {
      id: server.id,
      name: server.name,
      status: server.status,
      power_state: server.power_state,
      server_type: server.server_type_id,
      location: server.location_id,
      uptime_percentage: server.performance.uptime_percentage,
      primary_allocation: server.network.primary_allocation,
      created_at: server.created_at,
    };
  },

  // Get default server values
  getDefaultServerValues: (userId: number): Partial<CythroDashServer> => ({
    user_id: userId,
    status: ServerStatus.CREATING,
    power_state: PowerState.OFFLINE,
    billing_status: BillingStatus.ACTIVE,
    current_usage: { memory: 0, disk: 0, cpu: 0 },
    configuration: {
      environment_variables: {},
      auto_start: true,
      crash_detection: true,
      backup_enabled: true,
    },
    network: {},
    performance: {},
    backups: {
      backup_count: 0,
      auto_backup_enabled: true,
    },
    security: {
      sftp_enabled: true,
      console_access: true,
      file_manager_access: true,
      database_access: true,
    },
    error_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  }),

  // Validate server data
  validateServerData: (server: Partial<CythroDashServer>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!server.id || server.id.trim().length === 0) {
      errors.push('Server ID is required');
    }

    if (!server.name || server.name.trim().length === 0) {
      errors.push('Server name is required');
    }

    if (!server.user_id || server.user_id < 1) {
      errors.push('Valid user ID is required');
    }

    if (!server.server_type_id || server.server_type_id.trim().length === 0) {
      errors.push('Server type ID is required');
    }

    if (!server.software_id || server.software_id.trim().length === 0) {
      errors.push('Software ID is required');
    }

    if (!server.location_id || server.location_id.trim().length === 0) {
      errors.push('Location ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Sort servers by creation date (newest first)
  sortServers: (servers: CythroDashServer[]): CythroDashServer[] => {
    return servers.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  },

  // Filter servers by status
  filterByStatus: (servers: CythroDashServer[], status: ServerStatus): CythroDashServer[] => {
    return servers.filter(server => server.status === status);
  },

  // Filter servers by user
  filterByUser: (servers: CythroDashServer[], userId: number): CythroDashServer[] => {
    return servers.filter(server => server.user_id === userId);
  },

  // Get servers requiring attention (errors, overdue billing, etc.)
  getServersRequiringAttention: (servers: CythroDashServer[]): CythroDashServer[] => {
    return servers.filter(server => 
      server.status === ServerStatus.ERROR ||
      server.billing_status === BillingStatus.OVERDUE ||
      server.power_state === PowerState.CRASHED ||
      (server.suspension_info && !server.suspension_info.auto_unsuspend_date)
    );
  },
};

// Export collection name constant
export const SERVERS_COLLECTION = 'cythro_dash_servers';

// Export default
export default {
  ServerStatus,
  BillingStatus,
  PowerState,
  ServerHelpers,
  SERVERS_COLLECTION,
};
