/**
 * CythroDash - Node Monitoring Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Node status enumeration
export enum NodeStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  OVERLOADED = 'overloaded',
  ERROR = 'error'
}

// Resource status enumeration
export enum ResourceStatus {
  HEALTHY = 'healthy',     // < 70% usage
  WARNING = 'warning',     // 70-85% usage
  CRITICAL = 'critical',   // 85-95% usage
  FULL = 'full'           // > 95% usage
}

// Resource metrics interface
export interface ResourceMetrics {
  total: number;      // Total available
  used: number;       // Currently used
  available: number;  // Available for use
  percentage: number; // Usage percentage
  status: ResourceStatus; // Status based on usage
}

// Network metrics interface
export interface NetworkMetrics {
  rx_bytes: number;    // Bytes received
  tx_bytes: number;    // Bytes transmitted
  rx_packets: number;  // Packets received
  tx_packets: number;  // Packets transmitted
  errors: number;      // Network errors
  dropped: number;     // Dropped packets
}

// Server count metrics interface
export interface ServerCountMetrics {
  total: number;       // Total servers on node
  running: number;     // Currently running servers
  stopped: number;     // Stopped servers
  suspended: number;   // Suspended servers
  installing: number;  // Servers being installed
}

// Performance metrics interface
export interface PerformanceMetrics {
  load_average: {
    one_minute: number;
    five_minutes: number;
    fifteen_minutes: number;
  };
  uptime_seconds: number;
  boot_time: Date;
  processes_running: number;
  processes_total: number;
}

// Node statistics interface definition
export interface CythroDashNodeStats {
  _id?: ObjectId;
  
  // Node identification
  pterodactyl_node_id: number; // Pterodactyl node ID
  location_id: string; // Reference to CythroDashLocation
  node_name: string; // Node display name
  node_fqdn: string; // Node FQDN
  
  // Status and availability
  status: NodeStatus;
  last_ping: Date; // Last successful ping
  response_time_ms?: number; // Response time in milliseconds
  
  // Resource statistics
  resources: {
    memory: ResourceMetrics; // Memory usage in MB
    disk: ResourceMetrics;   // Disk usage in MB
    cpu: ResourceMetrics;    // CPU usage (cores and percentage)
    swap?: ResourceMetrics;  // Swap usage in MB (optional)
  };
  
  // Network statistics
  network: NetworkMetrics;
  
  // Server statistics
  servers: ServerCountMetrics;
  
  // Performance metrics
  performance: PerformanceMetrics;
  
  // Capacity planning
  capacity: {
    max_servers: number;           // Maximum servers this node can handle
    recommended_max_servers: number; // Recommended maximum for optimal performance
    current_allocation_percentage: number; // Current allocation percentage
    projected_full_date?: Date;    // When node is projected to be full
  };
  
  // Health indicators
  health: {
    overall_score: number;         // Overall health score (0-100)
    memory_health: number;         // Memory health score (0-100)
    disk_health: number;          // Disk health score (0-100)
    cpu_health: number;           // CPU health score (0-100)
    network_health: number;       // Network health score (0-100)
    last_health_check: Date;      // Last health check timestamp
  };
  
  // Alerts and warnings
  alerts: Array<{
    id: string;
    type: 'warning' | 'critical' | 'info';
    message: string;
    created_at: Date;
    resolved_at?: Date;
    auto_resolve: boolean;
  }>;
  
  // Historical data (for trending)
  history: {
    cpu_usage_24h: number[];      // CPU usage samples (hourly for 24h)
    memory_usage_24h: number[];   // Memory usage samples (hourly for 24h)
    disk_usage_24h: number[];     // Disk usage samples (hourly for 24h)
    server_count_24h: number[];   // Server count samples (hourly for 24h)
  };
  
  // Configuration and limits
  configuration: {
    monitoring_enabled: boolean;   // Whether monitoring is enabled
    alert_thresholds: {
      cpu_warning: number;         // CPU warning threshold (percentage)
      cpu_critical: number;        // CPU critical threshold (percentage)
      memory_warning: number;      // Memory warning threshold (percentage)
      memory_critical: number;     // Memory critical threshold (percentage)
      disk_warning: number;        // Disk warning threshold (percentage)
      disk_critical: number;       // Disk critical threshold (percentage)
    };
    maintenance_mode: boolean;     // Whether node is in maintenance mode
    auto_suspend_on_overload: boolean; // Auto-suspend new servers on overload
  };
  
  // Metadata
  recorded_at: Date;    // When this data was recorded
  updated_at: Date;     // When this record was last updated
  created_at: Date;     // When monitoring for this node started
  
  // Data retention
  retention_policy: {
    keep_hourly_for_days: number;  // Keep hourly data for X days
    keep_daily_for_months: number; // Keep daily summaries for X months
    last_cleanup: Date;            // Last cleanup timestamp
  };
}

// Node summary interface (for dashboards)
export interface NodeSummary {
  pterodactyl_node_id: number;
  node_name: string;
  location_id: string;
  status: NodeStatus;
  overall_health: number;
  cpu_percentage: number;
  memory_percentage: number;
  disk_percentage: number;
  server_count: number;
  last_ping: Date;
}

// Aggregated location stats interface
export interface LocationAggregateStats {
  location_id: string;
  total_nodes: number;
  online_nodes: number;
  total_capacity: {
    memory: number;
    disk: number;
    cpu: number;
  };
  used_capacity: {
    memory: number;
    disk: number;
    cpu: number;
  };
  total_servers: number;
  average_health_score: number;
}

// Node statistics helper functions
export const NodeStatsHelpers = {
  // Calculate resource status based on usage percentage
  getResourceStatus: (percentage: number): ResourceStatus => {
    if (percentage >= 95) return ResourceStatus.FULL;
    if (percentage >= 85) return ResourceStatus.CRITICAL;
    if (percentage >= 70) return ResourceStatus.WARNING;
    return ResourceStatus.HEALTHY;
  },

  // Calculate overall health score
  calculateHealthScore: (stats: CythroDashNodeStats): number => {
    const weights = {
      cpu: 0.3,
      memory: 0.3,
      disk: 0.2,
      network: 0.1,
      uptime: 0.1,
    };

    const cpuScore = Math.max(0, 100 - stats.resources.cpu.percentage);
    const memoryScore = Math.max(0, 100 - stats.resources.memory.percentage);
    const diskScore = Math.max(0, 100 - stats.resources.disk.percentage);
    const networkScore = stats.network.errors > 0 ? 80 : 100; // Simple network health
    const uptimeScore = stats.status === NodeStatus.ONLINE ? 100 : 0;

    return Math.round(
      cpuScore * weights.cpu +
      memoryScore * weights.memory +
      diskScore * weights.disk +
      networkScore * weights.network +
      uptimeScore * weights.uptime
    );
  },

  // Check if node can accept new servers
  canAcceptNewServers: (stats: CythroDashNodeStats, requiredResources: { memory: number; disk: number; cpu: number }): boolean => {
    if (stats.status !== NodeStatus.ONLINE) return false;
    if (stats.configuration.maintenance_mode) return false;
    
    const hasMemory = stats.resources.memory.available >= requiredResources.memory;
    const hasDisk = stats.resources.disk.available >= requiredResources.disk;
    const hasCpu = stats.resources.cpu.available >= requiredResources.cpu;
    
    return hasMemory && hasDisk && hasCpu;
  },

  // Get node capacity status
  getCapacityStatus: (stats: CythroDashNodeStats): 'available' | 'limited' | 'full' => {
    const maxUsage = Math.max(
      stats.resources.cpu.percentage,
      stats.resources.memory.percentage,
      stats.resources.disk.percentage
    );

    if (maxUsage >= 95) return 'full';
    if (maxUsage >= 80) return 'limited';
    return 'available';
  },

  // Get node summary
  getSummary: (stats: CythroDashNodeStats): NodeSummary => {
    return {
      pterodactyl_node_id: stats.pterodactyl_node_id,
      node_name: stats.node_name,
      location_id: stats.location_id,
      status: stats.status,
      overall_health: stats.health.overall_score,
      cpu_percentage: stats.resources.cpu.percentage,
      memory_percentage: stats.resources.memory.percentage,
      disk_percentage: stats.resources.disk.percentage,
      server_count: stats.servers.total,
      last_ping: stats.last_ping,
    };
  },

  // Create resource metrics
  createResourceMetrics: (total: number, used: number): ResourceMetrics => {
    const available = Math.max(0, total - used);
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
    const status = NodeStatsHelpers.getResourceStatus(percentage);

    return {
      total,
      used,
      available,
      percentage,
      status,
    };
  },

  // Get default node stats values
  getDefaultNodeStatsValues: (nodeId: number, locationId: string, nodeName: string, nodeFqdn: string): Partial<CythroDashNodeStats> => {
    const now = new Date();
    
    return {
      pterodactyl_node_id: nodeId,
      location_id: locationId,
      node_name: nodeName,
      node_fqdn: nodeFqdn,
      status: NodeStatus.OFFLINE,
      last_ping: now,
      resources: {
        memory: NodeStatsHelpers.createResourceMetrics(0, 0),
        disk: NodeStatsHelpers.createResourceMetrics(0, 0),
        cpu: NodeStatsHelpers.createResourceMetrics(0, 0),
      },
      network: {
        rx_bytes: 0,
        tx_bytes: 0,
        rx_packets: 0,
        tx_packets: 0,
        errors: 0,
        dropped: 0,
      },
      servers: {
        total: 0,
        running: 0,
        stopped: 0,
        suspended: 0,
        installing: 0,
      },
      performance: {
        load_average: {
          one_minute: 0,
          five_minutes: 0,
          fifteen_minutes: 0,
        },
        uptime_seconds: 0,
        boot_time: now,
        processes_running: 0,
        processes_total: 0,
      },
      capacity: {
        max_servers: 0,
        recommended_max_servers: 0,
        current_allocation_percentage: 0,
      },
      health: {
        overall_score: 0,
        memory_health: 0,
        disk_health: 0,
        cpu_health: 0,
        network_health: 0,
        last_health_check: now,
      },
      alerts: [],
      history: {
        cpu_usage_24h: new Array(24).fill(0),
        memory_usage_24h: new Array(24).fill(0),
        disk_usage_24h: new Array(24).fill(0),
        server_count_24h: new Array(24).fill(0),
      },
      configuration: {
        monitoring_enabled: true,
        alert_thresholds: {
          cpu_warning: 70,
          cpu_critical: 85,
          memory_warning: 70,
          memory_critical: 85,
          disk_warning: 80,
          disk_critical: 90,
        },
        maintenance_mode: false,
        auto_suspend_on_overload: true,
      },
      recorded_at: now,
      updated_at: now,
      created_at: now,
      retention_policy: {
        keep_hourly_for_days: 7,
        keep_daily_for_months: 6,
        last_cleanup: now,
      },
    };
  },

  // Validate node stats data
  validateNodeStatsData: (stats: Partial<CythroDashNodeStats>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (stats.pterodactyl_node_id === undefined || stats.pterodactyl_node_id < 1) {
      errors.push('Valid Pterodactyl node ID is required');
    }

    if (!stats.location_id || stats.location_id.trim().length === 0) {
      errors.push('Location ID is required');
    }

    if (!stats.node_name || stats.node_name.trim().length === 0) {
      errors.push('Node name is required');
    }

    if (!stats.node_fqdn || stats.node_fqdn.trim().length === 0) {
      errors.push('Node FQDN is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Sort nodes by health score (best first)
  sortNodesByHealth: (nodes: CythroDashNodeStats[]): CythroDashNodeStats[] => {
    return nodes.sort((a, b) => b.health.overall_score - a.health.overall_score);
  },

  // Filter nodes by status
  filterByStatus: (nodes: CythroDashNodeStats[], status: NodeStatus): CythroDashNodeStats[] => {
    return nodes.filter(node => node.status === status);
  },

  // Get nodes with available capacity
  getAvailableNodes: (nodes: CythroDashNodeStats[]): CythroDashNodeStats[] => {
    return nodes.filter(node => 
      node.status === NodeStatus.ONLINE &&
      !node.configuration.maintenance_mode &&
      NodeStatsHelpers.getCapacityStatus(node) !== 'full'
    );
  },

  // Calculate location aggregate stats
  calculateLocationStats: (nodes: CythroDashNodeStats[]): LocationAggregateStats[] => {
    const locationMap = new Map<string, CythroDashNodeStats[]>();
    
    // Group nodes by location
    nodes.forEach(node => {
      if (!locationMap.has(node.location_id)) {
        locationMap.set(node.location_id, []);
      }
      locationMap.get(node.location_id)!.push(node);
    });

    // Calculate stats for each location
    return Array.from(locationMap.entries()).map(([locationId, locationNodes]) => {
      const onlineNodes = locationNodes.filter(n => n.status === NodeStatus.ONLINE);
      
      const totalCapacity = locationNodes.reduce((acc, node) => ({
        memory: acc.memory + node.resources.memory.total,
        disk: acc.disk + node.resources.disk.total,
        cpu: acc.cpu + node.resources.cpu.total,
      }), { memory: 0, disk: 0, cpu: 0 });

      const usedCapacity = locationNodes.reduce((acc, node) => ({
        memory: acc.memory + node.resources.memory.used,
        disk: acc.disk + node.resources.disk.used,
        cpu: acc.cpu + node.resources.cpu.used,
      }), { memory: 0, disk: 0, cpu: 0 });

      const totalServers = locationNodes.reduce((acc, node) => acc + node.servers.total, 0);
      const averageHealth = locationNodes.reduce((acc, node) => acc + node.health.overall_score, 0) / locationNodes.length;

      return {
        location_id: locationId,
        total_nodes: locationNodes.length,
        online_nodes: onlineNodes.length,
        total_capacity: totalCapacity,
        used_capacity: usedCapacity,
        total_servers: totalServers,
        average_health_score: Math.round(averageHealth),
      };
    });
  },
};

// Export collection name constant
export const NODE_STATS_COLLECTION = 'cythro_dash_node_stats';

// Export default
export default {
  NodeStatus,
  ResourceStatus,
  NodeStatsHelpers,
  NODE_STATS_COLLECTION,
};
