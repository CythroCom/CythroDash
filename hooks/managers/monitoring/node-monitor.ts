/**
 * CythroDash - Node Resource Monitoring Service
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { panelNodeGetAll, panelNodeGetDetails, panelServerGetByNode, type PterodactylNode } from '@/hooks/managers/pterodactyl/nodes';
import { panelServerGetAll, type PterodactylServer } from '@/hooks/managers/pterodactyl/servers';

// Node resource monitoring interfaces
export interface NodeResourceUsage {
  node_id: number;
  node_name: string;
  node_uuid: string;
  location_id: number;
  fqdn: string;
  maintenance_mode: boolean;
  
  // Resource capacity
  total_memory: number;
  total_disk: number;
  memory_overallocate: number;
  disk_overallocate: number;
  
  // Current allocation
  allocated_memory: number;
  allocated_disk: number;
  
  // Server count
  total_servers: number;
  active_servers: number;
  suspended_servers: number;
  
  // Calculated metrics
  memory_usage_percentage: number;
  disk_usage_percentage: number;
  effective_memory_limit: number;
  effective_disk_limit: number;
  available_memory: number;
  available_disk: number;
  
  // Status
  status: 'available' | 'limited' | 'full' | 'maintenance';
  last_updated: Date;
}

export interface LocationCapacitySummary {
  location_id: number;
  total_nodes: number;
  active_nodes: number;
  maintenance_nodes: number;
  
  // Aggregated capacity
  total_memory: number;
  total_disk: number;
  allocated_memory: number;
  allocated_disk: number;
  available_memory: number;
  available_disk: number;
  
  // Aggregated metrics
  memory_usage_percentage: number;
  disk_usage_percentage: number;
  total_servers: number;
  
  // Status
  status: 'available' | 'limited' | 'full' | 'maintenance';
  last_updated: Date;
}

export interface MonitoringStats {
  total_nodes: number;
  active_nodes: number;
  maintenance_nodes: number;
  total_servers: number;
  total_memory: number;
  total_disk: number;
  allocated_memory: number;
  allocated_disk: number;
  overall_memory_usage: number;
  overall_disk_usage: number;
  last_updated: Date;
}

// In-memory cache for monitoring data
class NodeMonitorCache {
  private nodeUsageCache: Map<number, NodeResourceUsage> = new Map();
  private locationSummaryCache: Map<number, LocationCapacitySummary> = new Map();
  private monitoringStatsCache: MonitoringStats | null = null;
  private lastFullUpdate: Date | null = null;
  
  // Cache settings
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  private readonly FULL_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Get node usage from cache
  getNodeUsage(nodeId: number): NodeResourceUsage | null {
    const cached = this.nodeUsageCache.get(nodeId);
    if (cached && this.isCacheValid(cached.last_updated)) {
      return cached;
    }
    return null;
  }

  // Set node usage in cache
  setNodeUsage(nodeId: number, usage: NodeResourceUsage): void {
    this.nodeUsageCache.set(nodeId, usage);
  }

  // Get location summary from cache
  getLocationSummary(locationId: number): LocationCapacitySummary | null {
    const cached = this.locationSummaryCache.get(locationId);
    if (cached && this.isCacheValid(cached.last_updated)) {
      return cached;
    }
    return null;
  }

  // Set location summary in cache
  setLocationSummary(locationId: number, summary: LocationCapacitySummary): void {
    this.locationSummaryCache.set(locationId, summary);
  }

  // Get monitoring stats from cache
  getMonitoringStats(): MonitoringStats | null {
    if (this.monitoringStatsCache && this.isCacheValid(this.monitoringStatsCache.last_updated)) {
      return this.monitoringStatsCache;
    }
    return null;
  }

  // Set monitoring stats in cache
  setMonitoringStats(stats: MonitoringStats): void {
    this.monitoringStatsCache = stats;
  }

  // Check if cache is valid
  private isCacheValid(lastUpdated: Date): boolean {
    const now = new Date();
    return (now.getTime() - lastUpdated.getTime()) < this.CACHE_DURATION;
  }

  // Check if full update is needed
  needsFullUpdate(): boolean {
    if (!this.lastFullUpdate) return true;
    const now = new Date();
    return (now.getTime() - this.lastFullUpdate.getTime()) > this.FULL_UPDATE_INTERVAL;
  }

  // Mark full update completed
  markFullUpdateCompleted(): void {
    this.lastFullUpdate = new Date();
  }

  // Clear cache
  clearCache(): void {
    this.nodeUsageCache.clear();
    this.locationSummaryCache.clear();
    this.monitoringStatsCache = null;
    this.lastFullUpdate = null;
  }

  // Get all cached node usage
  getAllNodeUsage(): NodeResourceUsage[] {
    return Array.from(this.nodeUsageCache.values());
  }

  // Get all cached location summaries
  getAllLocationSummaries(): LocationCapacitySummary[] {
    return Array.from(this.locationSummaryCache.values());
  }
}

// Singleton cache instance
const monitorCache = new NodeMonitorCache();

// Node monitoring service
export class NodeMonitorService {
  // Calculate node resource usage
  static async calculateNodeUsage(node: PterodactylNode, servers: PterodactylServer[]): Promise<NodeResourceUsage> {
    // Calculate effective limits with overallocation
    const effectiveMemoryLimit = node.memory + (node.memory * node.memory_overallocate / 100);
    const effectiveDiskLimit = node.disk + (node.disk * node.disk_overallocate / 100);

    // Calculate allocated resources from servers
    const allocatedMemory = servers.reduce((total, server) => total + (server.limits?.memory || 0), 0);
    const allocatedDisk = servers.reduce((total, server) => total + (server.limits?.disk || 0), 0);

    // Calculate usage percentages
    const memoryUsagePercentage = effectiveMemoryLimit > 0 ? (allocatedMemory / effectiveMemoryLimit) * 100 : 0;
    const diskUsagePercentage = effectiveDiskLimit > 0 ? (allocatedDisk / effectiveDiskLimit) * 100 : 0;

    // Calculate available resources
    const availableMemory = Math.max(0, effectiveMemoryLimit - allocatedMemory);
    const availableDisk = Math.max(0, effectiveDiskLimit - allocatedDisk);

    // Determine status
    let status: 'available' | 'limited' | 'full' | 'maintenance';
    if (node.maintenance_mode) {
      status = 'maintenance';
    } else {
      const maxUsage = Math.max(memoryUsagePercentage, diskUsagePercentage);
      if (maxUsage >= 95) {
        status = 'full';
      } else if (maxUsage >= 80) {
        status = 'limited';
      } else {
        status = 'available';
      }
    }

    // Count server statuses
    const activeServers = servers.filter(s => !s.suspended).length;
    const suspendedServers = servers.filter(s => s.suspended).length;

    return {
      node_id: node.id,
      node_name: node.name,
      node_uuid: node.uuid,
      location_id: node.location_id,
      fqdn: node.fqdn,
      maintenance_mode: node.maintenance_mode,
      
      total_memory: node.memory,
      total_disk: node.disk,
      memory_overallocate: node.memory_overallocate,
      disk_overallocate: node.disk_overallocate,
      
      allocated_memory: allocatedMemory,
      allocated_disk: allocatedDisk,
      
      total_servers: servers.length,
      active_servers: activeServers,
      suspended_servers: suspendedServers,
      
      memory_usage_percentage: Math.round(memoryUsagePercentage * 100) / 100,
      disk_usage_percentage: Math.round(diskUsagePercentage * 100) / 100,
      effective_memory_limit: effectiveMemoryLimit,
      effective_disk_limit: effectiveDiskLimit,
      available_memory: availableMemory,
      available_disk: availableDisk,
      
      status,
      last_updated: new Date()
    };
  }

  // Get node resource usage with caching
  static async getNodeUsage(nodeId: number, forceRefresh: boolean = false): Promise<NodeResourceUsage | null> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = monitorCache.getNodeUsage(nodeId);
        if (cached) {
          return cached;
        }
      }

      // Fetch fresh data
      const nodeResponse = await panelNodeGetDetails(nodeId);
      if (!nodeResponse.attributes) {
        return null;
      }

      const node = nodeResponse.attributes;
      const servers = await panelServerGetByNode(nodeId);

      const usage = await this.calculateNodeUsage(node, servers);
      
      // Cache the result
      monitorCache.setNodeUsage(nodeId, usage);
      
      return usage;
    } catch (error) {
      console.error(`Error getting node usage for node ${nodeId}:`, error);
      return null;
    }
  }

  // Get all nodes usage
  static async getAllNodesUsage(forceRefresh: boolean = false): Promise<NodeResourceUsage[]> {
    try {
      // Check if full update is needed
      if (!forceRefresh && !monitorCache.needsFullUpdate()) {
        const cached = monitorCache.getAllNodeUsage();
        if (cached.length > 0) {
          return cached;
        }
      }

      console.log('Performing full nodes monitoring update...');

      // Fetch all nodes and servers
      const [nodesResponse, serversResponse] = await Promise.all([
        panelNodeGetAll({ per_page: 100 }),
        panelServerGetAll({ per_page: 100, include: "node" })
      ]);

      const nodes = nodesResponse.data.map(n => n.attributes!).filter(Boolean);
      const allServers = serversResponse.data.map(s => s.attributes!).filter(Boolean);

      // Group servers by node
      const serversByNode = new Map<number, PterodactylServer[]>();
      allServers.forEach(server => {
        const nodeId = server.node;
        if (!serversByNode.has(nodeId)) {
          serversByNode.set(nodeId, []);
        }
        serversByNode.get(nodeId)!.push(server);
      });

      // Calculate usage for each node
      const usagePromises = nodes.map(async (node) => {
        const nodeServers = serversByNode.get(node.id) || [];
        return await this.calculateNodeUsage(node, nodeServers);
      });

      const allUsage = await Promise.all(usagePromises);

      // Cache all results
      allUsage.forEach(usage => {
        monitorCache.setNodeUsage(usage.node_id, usage);
      });

      // Mark full update completed
      monitorCache.markFullUpdateCompleted();

      console.log(`Updated monitoring data for ${allUsage.length} nodes`);
      return allUsage;
    } catch (error) {
      console.error('Error getting all nodes usage:', error);
      return [];
    }
  }

  // Calculate location capacity summary
  static async calculateLocationCapacity(locationId: number, nodeUsages: NodeResourceUsage[]): Promise<LocationCapacitySummary> {
    const locationNodes = nodeUsages.filter(usage => usage.location_id === locationId);

    // Aggregate totals
    const totalMemory = locationNodes.reduce((sum, node) => sum + node.total_memory, 0);
    const totalDisk = locationNodes.reduce((sum, node) => sum + node.total_disk, 0);
    const allocatedMemory = locationNodes.reduce((sum, node) => sum + node.allocated_memory, 0);
    const allocatedDisk = locationNodes.reduce((sum, node) => sum + node.allocated_disk, 0);
    const availableMemory = locationNodes.reduce((sum, node) => sum + node.available_memory, 0);
    const availableDisk = locationNodes.reduce((sum, node) => sum + node.available_disk, 0);
    const totalServers = locationNodes.reduce((sum, node) => sum + node.total_servers, 0);

    // Calculate usage percentages
    const memoryUsagePercentage = totalMemory > 0 ? (allocatedMemory / totalMemory) * 100 : 0;
    const diskUsagePercentage = totalDisk > 0 ? (allocatedDisk / totalDisk) * 100 : 0;

    // Count node statuses
    const activeNodes = locationNodes.filter(node => !node.maintenance_mode).length;
    const maintenanceNodes = locationNodes.filter(node => node.maintenance_mode).length;

    // Determine overall location status
    let status: 'available' | 'limited' | 'full' | 'maintenance';
    if (activeNodes === 0) {
      status = 'maintenance';
    } else {
      const maxUsage = Math.max(memoryUsagePercentage, diskUsagePercentage);
      if (maxUsage >= 95) {
        status = 'full';
      } else if (maxUsage >= 80) {
        status = 'limited';
      } else {
        status = 'available';
      }
    }

    return {
      location_id: locationId,
      total_nodes: locationNodes.length,
      active_nodes: activeNodes,
      maintenance_nodes: maintenanceNodes,

      total_memory: totalMemory,
      total_disk: totalDisk,
      allocated_memory: allocatedMemory,
      allocated_disk: allocatedDisk,
      available_memory: availableMemory,
      available_disk: availableDisk,

      memory_usage_percentage: Math.round(memoryUsagePercentage * 100) / 100,
      disk_usage_percentage: Math.round(diskUsagePercentage * 100) / 100,
      total_servers: totalServers,

      status,
      last_updated: new Date()
    };
  }

  // Get location capacity summary
  static async getLocationCapacity(locationId: number, forceRefresh: boolean = false): Promise<LocationCapacitySummary | null> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = monitorCache.getLocationSummary(locationId);
        if (cached) {
          return cached;
        }
      }

      // Get all node usages (this will use cache if available)
      const allNodeUsages = await this.getAllNodesUsage(forceRefresh);

      // Calculate location capacity
      const locationCapacity = await this.calculateLocationCapacity(locationId, allNodeUsages);

      // Cache the result
      monitorCache.setLocationSummary(locationId, locationCapacity);

      return locationCapacity;
    } catch (error) {
      console.error(`Error getting location capacity for location ${locationId}:`, error);
      return null;
    }
  }

  // Get all locations capacity
  static async getAllLocationsCapacity(forceRefresh: boolean = false): Promise<LocationCapacitySummary[]> {
    try {
      // Get all node usages first
      const allNodeUsages = await this.getAllNodesUsage(forceRefresh);

      // Get unique location IDs
      const locationIds = [...new Set(allNodeUsages.map(usage => usage.location_id))];

      // Calculate capacity for each location
      const capacityPromises = locationIds.map(async (locationId) => {
        return await this.calculateLocationCapacity(locationId, allNodeUsages);
      });

      const allCapacities = await Promise.all(capacityPromises);

      // Cache all results
      allCapacities.forEach(capacity => {
        monitorCache.setLocationSummary(capacity.location_id, capacity);
      });

      return allCapacities;
    } catch (error) {
      console.error('Error getting all locations capacity:', error);
      return [];
    }
  }

  // Get monitoring statistics
  static async getMonitoringStats(forceRefresh: boolean = false): Promise<MonitoringStats> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = monitorCache.getMonitoringStats();
        if (cached) {
          return cached;
        }
      }

      // Get all node usages
      const allNodeUsages = await this.getAllNodesUsage(forceRefresh);

      // Calculate overall statistics
      const totalMemory = allNodeUsages.reduce((sum, node) => sum + node.total_memory, 0);
      const totalDisk = allNodeUsages.reduce((sum, node) => sum + node.total_disk, 0);
      const allocatedMemory = allNodeUsages.reduce((sum, node) => sum + node.allocated_memory, 0);
      const allocatedDisk = allNodeUsages.reduce((sum, node) => sum + node.allocated_disk, 0);
      const totalServers = allNodeUsages.reduce((sum, node) => sum + node.total_servers, 0);

      const activeNodes = allNodeUsages.filter(node => !node.maintenance_mode).length;
      const maintenanceNodes = allNodeUsages.filter(node => node.maintenance_mode).length;

      const overallMemoryUsage = totalMemory > 0 ? (allocatedMemory / totalMemory) * 100 : 0;
      const overallDiskUsage = totalDisk > 0 ? (allocatedDisk / totalDisk) * 100 : 0;

      const stats: MonitoringStats = {
        total_nodes: allNodeUsages.length,
        active_nodes: activeNodes,
        maintenance_nodes: maintenanceNodes,
        total_servers: totalServers,
        total_memory: totalMemory,
        total_disk: totalDisk,
        allocated_memory: allocatedMemory,
        allocated_disk: allocatedDisk,
        overall_memory_usage: Math.round(overallMemoryUsage * 100) / 100,
        overall_disk_usage: Math.round(overallDiskUsage * 100) / 100,
        last_updated: new Date()
      };

      // Cache the result
      monitorCache.setMonitoringStats(stats);

      return stats;
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      // Return default stats on error
      return {
        total_nodes: 0,
        active_nodes: 0,
        maintenance_nodes: 0,
        total_servers: 0,
        total_memory: 0,
        total_disk: 0,
        allocated_memory: 0,
        allocated_disk: 0,
        overall_memory_usage: 0,
        overall_disk_usage: 0,
        last_updated: new Date()
      };
    }
  }

  // Clear monitoring cache
  static clearCache(): void {
    monitorCache.clearCache();
    console.log('Monitoring cache cleared');
  }

  // Force refresh all monitoring data
  static async refreshAllData(): Promise<void> {
    console.log('Force refreshing all monitoring data...');
    this.clearCache();
    await Promise.all([
      this.getAllNodesUsage(true),
      this.getAllLocationsCapacity(true),
      this.getMonitoringStats(true)
    ]);
    console.log('All monitoring data refreshed');
  }
}
