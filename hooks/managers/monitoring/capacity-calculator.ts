/**
 * CythroDash - Capacity Calculation and Load Balancing
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NodeMonitorService, type NodeResourceUsage, type LocationCapacitySummary } from './node-monitor';

// Resource requirements interface
export interface ResourceRequirements {
  memory: number; // MB
  disk: number;   // MB
  cpu?: number;   // Percentage (optional)
}

// Node selection result
export interface NodeSelectionResult {
  success: boolean;
  selected_node?: {
    node_id: number;
    node_name: string;
    node_uuid: string;
    fqdn: string;
    location_id: number;
    available_memory: number;
    available_disk: number;
    current_load_score: number;
    selection_reason: string;
  };
  error?: string;
  alternatives?: Array<{
    node_id: number;
    node_name: string;
    load_score: number;
    reason_not_selected: string;
  }>;
}

// Capacity check result
export interface CapacityCheckResult {
  can_accommodate: boolean;
  location_id: number;
  location_status: 'available' | 'limited' | 'full' | 'maintenance';
  available_nodes: number;
  total_capacity: {
    memory: number;
    disk: number;
  };
  available_capacity: {
    memory: number;
    disk: number;
  };
  required_resources: ResourceRequirements;
  utilization_after_creation: {
    memory_percentage: number;
    disk_percentage: number;
  };
  recommended_nodes?: Array<{
    node_id: number;
    node_name: string;
    load_score: number;
    fit_score: number;
  }>;
  warnings?: string[];
}

export class CapacityCalculator {
  // Calculate load score for a node (lower is better)
  static calculateLoadScore(nodeUsage: NodeResourceUsage): number {
    if (nodeUsage.maintenance_mode) {
      return Infinity; // Never select maintenance nodes
    }

    // Weight factors
    const memoryWeight = 0.4;
    const diskWeight = 0.3;
    const serverCountWeight = 0.2;
    const availabilityWeight = 0.1;

    // Calculate individual scores (0-100)
    const memoryScore = nodeUsage.memory_usage_percentage;
    const diskScore = nodeUsage.disk_usage_percentage;
    
    // Server density score (more servers = higher load)
    const maxServersEstimate = Math.floor(nodeUsage.effective_memory_limit / 1024); // Assume 1GB per server average
    const serverDensityScore = maxServersEstimate > 0 ? (nodeUsage.total_servers / maxServersEstimate) * 100 : 0;
    
    // Availability score (based on status)
    let availabilityScore = 0;
    switch (nodeUsage.status) {
      case 'available':
        availabilityScore = 0;
        break;
      case 'limited':
        availabilityScore = 50;
        break;
      case 'full':
        availabilityScore = 100;
        break;
      case 'maintenance':
        availabilityScore = 100;
        break;
    }

    // Calculate weighted score
    const totalScore = (
      memoryScore * memoryWeight +
      diskScore * diskWeight +
      serverDensityScore * serverCountWeight +
      availabilityScore * availabilityWeight
    );

    return Math.round(totalScore * 100) / 100;
  }

  // Calculate fit score for a node with specific requirements (higher is better)
  static calculateFitScore(nodeUsage: NodeResourceUsage, requirements: ResourceRequirements): number {
    if (nodeUsage.maintenance_mode) {
      return 0; // Never select maintenance nodes
    }

    // Check if node can accommodate the requirements
    if (nodeUsage.available_memory < requirements.memory || nodeUsage.available_disk < requirements.disk) {
      return 0; // Cannot fit
    }

    // Calculate efficiency scores (how well the requirements fit)
    const memoryEfficiency = nodeUsage.available_memory > 0 ? 
      Math.min(100, (requirements.memory / nodeUsage.available_memory) * 100) : 0;
    
    const diskEfficiency = nodeUsage.available_disk > 0 ? 
      Math.min(100, (requirements.disk / nodeUsage.available_disk) * 100) : 0;

    // Prefer nodes that will be well-utilized but not overloaded
    const idealUtilization = 70; // Target 70% utilization
    const memoryUtilizationAfter = ((nodeUsage.allocated_memory + requirements.memory) / nodeUsage.effective_memory_limit) * 100;
    const diskUtilizationAfter = ((nodeUsage.allocated_disk + requirements.disk) / nodeUsage.effective_disk_limit) * 100;
    
    const memoryUtilizationScore = 100 - Math.abs(memoryUtilizationAfter - idealUtilization);
    const diskUtilizationScore = 100 - Math.abs(diskUtilizationAfter - idealUtilization);

    // Calculate overall fit score
    const fitScore = (
      memoryEfficiency * 0.3 +
      diskEfficiency * 0.3 +
      memoryUtilizationScore * 0.2 +
      diskUtilizationScore * 0.2
    );

    return Math.max(0, Math.round(fitScore * 100) / 100);
  }

  // Check if a location can accommodate the requirements
  static async checkLocationCapacity(
    locationId: number, 
    requirements: ResourceRequirements,
    forceRefresh: boolean = false
  ): Promise<CapacityCheckResult> {
    try {
      // Get location capacity
      const locationCapacity = await NodeMonitorService.getLocationCapacity(locationId, forceRefresh);
      
      if (!locationCapacity) {
        return {
          can_accommodate: false,
          location_id: locationId,
          location_status: 'maintenance',
          available_nodes: 0,
          total_capacity: { memory: 0, disk: 0 },
          available_capacity: { memory: 0, disk: 0 },
          required_resources: requirements,
          utilization_after_creation: { memory_percentage: 0, disk_percentage: 0 },
          warnings: ['Location not found or unavailable']
        };
      }

      // Check basic capacity
      const canAccommodate = locationCapacity.available_memory >= requirements.memory && 
                            locationCapacity.available_disk >= requirements.disk &&
                            locationCapacity.active_nodes > 0;

      // Calculate utilization after creation
      const memoryAfter = locationCapacity.allocated_memory + requirements.memory;
      const diskAfter = locationCapacity.allocated_disk + requirements.disk;
      
      const memoryPercentageAfter = locationCapacity.total_memory > 0 ? 
        (memoryAfter / locationCapacity.total_memory) * 100 : 0;
      const diskPercentageAfter = locationCapacity.total_disk > 0 ? 
        (diskAfter / locationCapacity.total_disk) * 100 : 0;

      // Get node-level details for recommendations
      const allNodeUsages = await NodeMonitorService.getAllNodesUsage(forceRefresh);
      const locationNodes = allNodeUsages.filter(node => 
        node.location_id === locationId && !node.maintenance_mode
      );

      // Calculate recommended nodes
      const recommendedNodes = locationNodes
        .filter(node => 
          node.available_memory >= requirements.memory && 
          node.available_disk >= requirements.disk
        )
        .map(node => ({
          node_id: node.node_id,
          node_name: node.node_name,
          load_score: this.calculateLoadScore(node),
          fit_score: this.calculateFitScore(node, requirements)
        }))
        .sort((a, b) => {
          // Sort by fit score (descending) then load score (ascending)
          if (a.fit_score !== b.fit_score) {
            return b.fit_score - a.fit_score;
          }
          return a.load_score - b.load_score;
        })
        .slice(0, 5); // Top 5 recommendations

      // Generate warnings
      const warnings: string[] = [];
      if (memoryPercentageAfter > 90) {
        warnings.push('Memory utilization will exceed 90% after creation');
      }
      if (diskPercentageAfter > 90) {
        warnings.push('Disk utilization will exceed 90% after creation');
      }
      if (locationCapacity.active_nodes < 2) {
        warnings.push('Location has limited redundancy (less than 2 active nodes)');
      }
      if (recommendedNodes.length === 0 && canAccommodate) {
        warnings.push('No optimal nodes found, but capacity exists');
      }

      return {
        can_accommodate: canAccommodate,
        location_id: locationId,
        location_status: locationCapacity.status,
        available_nodes: locationCapacity.active_nodes,
        total_capacity: {
          memory: locationCapacity.total_memory,
          disk: locationCapacity.total_disk
        },
        available_capacity: {
          memory: locationCapacity.available_memory,
          disk: locationCapacity.available_disk
        },
        required_resources: requirements,
        utilization_after_creation: {
          memory_percentage: Math.round(memoryPercentageAfter * 100) / 100,
          disk_percentage: Math.round(diskPercentageAfter * 100) / 100
        },
        recommended_nodes: recommendedNodes.length > 0 ? recommendedNodes : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error(`Error checking location capacity for location ${locationId}:`, error);
      return {
        can_accommodate: false,
        location_id: locationId,
        location_status: 'maintenance',
        available_nodes: 0,
        total_capacity: { memory: 0, disk: 0 },
        available_capacity: { memory: 0, disk: 0 },
        required_resources: requirements,
        utilization_after_creation: { memory_percentage: 0, disk_percentage: 0 },
        warnings: ['Error occurred while checking capacity']
      };
    }
  }

  // Select the best node for server creation
  static async selectOptimalNode(
    locationId: number,
    requirements: ResourceRequirements,
    forceRefresh: boolean = false
  ): Promise<NodeSelectionResult> {
    try {
      // First check if location can accommodate
      const capacityCheck = await this.checkLocationCapacity(locationId, requirements, forceRefresh);
      
      if (!capacityCheck.can_accommodate) {
        return {
          success: false,
          error: `Location cannot accommodate the required resources. Available: ${capacityCheck.available_capacity.memory}MB memory, ${capacityCheck.available_capacity.disk}MB disk. Required: ${requirements.memory}MB memory, ${requirements.disk}MB disk.`
        };
      }

      // Get all node usages for the location
      const allNodeUsages = await NodeMonitorService.getAllNodesUsage(forceRefresh);
      const locationNodes = allNodeUsages.filter(node => 
        node.location_id === locationId && !node.maintenance_mode
      );

      // Filter nodes that can accommodate the requirements
      const viableNodes = locationNodes.filter(node => 
        node.available_memory >= requirements.memory && 
        node.available_disk >= requirements.disk
      );

      if (viableNodes.length === 0) {
        return {
          success: false,
          error: 'No viable nodes found that can accommodate the requirements'
        };
      }

      // Calculate scores for all viable nodes
      const scoredNodes = viableNodes.map(node => ({
        node,
        loadScore: this.calculateLoadScore(node),
        fitScore: this.calculateFitScore(node, requirements)
      }));

      // Sort by fit score (descending) then load score (ascending)
      scoredNodes.sort((a, b) => {
        if (a.fitScore !== b.fitScore) {
          return b.fitScore - a.fitScore;
        }
        return a.loadScore - b.loadScore;
      });

      const selectedNodeData = scoredNodes[0];
      const selectedNode = selectedNodeData.node;

      // Generate selection reason
      let selectionReason = `Selected based on optimal fit score (${selectedNodeData.fitScore}) and load score (${selectedNodeData.loadScore})`;
      if (selectedNode.status === 'available') {
        selectionReason += '. Node has excellent availability';
      } else if (selectedNode.status === 'limited') {
        selectionReason += '. Node has limited capacity but is still viable';
      }

      // Generate alternatives list
      const alternatives = scoredNodes.slice(1, 4).map(scored => ({
        node_id: scored.node.node_id,
        node_name: scored.node.node_name,
        load_score: scored.loadScore,
        reason_not_selected: scored.fitScore < selectedNodeData.fitScore ? 
          'Lower fit score' : 'Higher load score'
      }));

      return {
        success: true,
        selected_node: {
          node_id: selectedNode.node_id,
          node_name: selectedNode.node_name,
          node_uuid: selectedNode.node_uuid,
          fqdn: selectedNode.fqdn,
          location_id: selectedNode.location_id,
          available_memory: selectedNode.available_memory,
          available_disk: selectedNode.available_disk,
          current_load_score: selectedNodeData.loadScore,
          selection_reason: selectionReason
        },
        alternatives: alternatives.length > 0 ? alternatives : undefined
      };

    } catch (error) {
      console.error(`Error selecting optimal node for location ${locationId}:`, error);
      return {
        success: false,
        error: 'An error occurred while selecting the optimal node'
      };
    }
  }

  // Get capacity status for multiple locations
  static async getMultiLocationCapacity(
    locationIds: number[],
    requirements: ResourceRequirements,
    forceRefresh: boolean = false
  ): Promise<CapacityCheckResult[]> {
    const capacityPromises = locationIds.map(locationId => 
      this.checkLocationCapacity(locationId, requirements, forceRefresh)
    );

    return await Promise.all(capacityPromises);
  }
}
