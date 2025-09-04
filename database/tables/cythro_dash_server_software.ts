/**
 * CythroDash - Server Software Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Software status enumeration
export enum SoftwareStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  DEPRECATED = 'deprecated',
  BETA = 'beta'
}

// Software stability enumeration
export enum SoftwareStability {
  STABLE = 'stable',
  BETA = 'beta',
  ALPHA = 'alpha',
  EXPERIMENTAL = 'experimental'
}

// Version information interface
export interface VersionInfo {
  version: string; // Version string (e.g., "1.20.1", "latest")
  minecraft_version?: string; // For Minecraft servers
  build_number?: string; // Build number if applicable
  release_date?: Date; // Release date
  changelog_url?: string; // Link to changelog
}

// Docker configuration interface
export interface DockerConfig {
  image: string; // Primary docker image
  alternative_images?: Record<string, string>; // Alternative images by name
  startup_command?: string; // Override startup command
  stop_command?: string; // Override stop command
}

// Environment variables interface
export interface EnvironmentVariable {
  name: string; // Variable name
  display_name: string; // Human-readable name
  description?: string; // Description of what this variable does
  default_value: string; // Default value
  user_viewable: boolean; // Can users see this variable
  user_editable: boolean; // Can users edit this variable
  validation_rules?: string; // Validation regex or rules
  field_type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  select_options?: string[]; // Options for select fields
}

// Server software interface definition
export interface CythroDashServerSoftware {
  _id?: ObjectId;
  
  // Basic identification
  id: string; // Unique identifier (e.g., "paper-1.20", "forge-1.19")
  name: string; // Display name (e.g., "Paper", "Forge")
  description?: string; // Detailed description
  short_description?: string; // Brief description for cards
  
  // Relationships
  server_type_id: string; // Links to CythroDashServerType
  pterodactyl_egg_id: number; // Maps to Pterodactyl egg ID
  
  // Version and stability
  version_info: VersionInfo;
  stability: SoftwareStability;
  
  // Status and availability
  status: SoftwareStatus;
  recommended?: boolean; // Show "Recommended" badge
  latest?: boolean; // Show "Latest" badge
  
  // Docker and execution configuration
  docker_config: DockerConfig;
  
  // Environment variables and configuration
  environment_variables: EnvironmentVariable[];
  
  // Display and ordering
  display_order: number; // Sort order within server type
  icon?: string; // Icon identifier or URL
  color?: string; // Hex color code for theming
  
  // Resource requirements (overrides from server type)
  resource_overrides?: {
    min_memory?: number; // Override minimum memory requirement
    min_disk?: number; // Override minimum disk requirement
    min_cpu?: number; // Override minimum CPU requirement
    recommended_memory?: number; // Override recommended memory
    recommended_disk?: number; // Override recommended disk
    recommended_cpu?: number; // Override recommended CPU
  };
  
  // Compatibility and restrictions
  compatibility: {
    min_java_version?: number; // Minimum Java version required
    max_java_version?: number; // Maximum Java version supported
    supported_architectures?: string[]; // Supported CPU architectures
    requires_specific_os?: string[]; // Required OS types
  };
  
  // Features and capabilities
  features: {
    supports_plugins?: boolean; // Supports plugin installation
    supports_mods?: boolean; // Supports mod installation
    supports_datapacks?: boolean; // Supports datapacks
    supports_custom_worlds?: boolean; // Supports custom world uploads
    supports_backups?: boolean; // Supports automatic backups
    supports_console_commands?: boolean; // Supports console commands
    supports_file_manager?: boolean; // Supports file management
  };
  
  // Documentation and help
  documentation: {
    installation_guide?: string; // Link to installation guide
    configuration_guide?: string; // Link to configuration guide
    plugin_guide?: string; // Link to plugin installation guide
    troubleshooting_guide?: string; // Link to troubleshooting guide
    official_website?: string; // Official website URL
    github_repository?: string; // GitHub repository URL
  };
  
  // Update and maintenance information
  update_info: {
    auto_update_available?: boolean; // Can be auto-updated
    update_frequency?: string; // How often updates are released
    last_updated?: Date; // Last time this software was updated
    next_update_eta?: Date; // Estimated next update
    security_updates?: boolean; // Receives security updates
  };
  
  // Statistics
  stats?: {
    total_installations: number; // Total servers using this software
    active_installations: number; // Currently active servers
    success_rate: number; // Installation success rate percentage
    average_startup_time?: number; // Average startup time in seconds
  };
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: number; // Admin user ID who created this software
  last_modified_by?: number; // Admin user ID who last modified
  
  // Deprecation information
  deprecation_info?: {
    deprecated_since?: Date; // When this was deprecated
    replacement_software_id?: string; // Recommended replacement
    removal_date?: Date; // When this will be removed
    deprecation_reason?: string; // Why this was deprecated
  };
}

// Software summary interface (for listings)
export interface SoftwareSummary {
  id: string;
  name: string;
  version: string;
  stability: SoftwareStability;
  recommended?: boolean;
  latest?: boolean;
  short_description?: string;
  icon?: string;
}

// Server software helper functions
export const ServerSoftwareHelpers = {
  // Generate a unique software ID
  generateSoftwareId: (name: string, version: string): string => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanVersion = version.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${cleanName}-${cleanVersion}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
  },

  // Check if software is available for use
  isAvailable: (software: CythroDashServerSoftware): boolean => {
    return software.status === SoftwareStatus.ACTIVE || software.status === SoftwareStatus.BETA;
  },

  // Get software display name with version
  getDisplayNameWithVersion: (software: CythroDashServerSoftware): string => {
    return `${software.name} ${software.version_info.version}`;
  },

  // Get software summary
  getSummary: (software: CythroDashServerSoftware): SoftwareSummary => {
    return {
      id: software.id,
      name: software.name,
      version: software.version_info.version,
      stability: software.stability,
      recommended: software.recommended,
      latest: software.latest,
      short_description: software.short_description,
      icon: software.icon,
    };
  },

  // Get user-editable environment variables
  getUserEditableVariables: (software: CythroDashServerSoftware): EnvironmentVariable[] => {
    return software.environment_variables.filter(variable => variable.user_editable);
  },

  // Get default environment values
  getDefaultEnvironmentValues: (software: CythroDashServerSoftware): Record<string, string> => {
    const defaults: Record<string, string> = {};
    software.environment_variables.forEach(variable => {
      defaults[variable.name] = variable.default_value;
    });
    return defaults;
  },

  // Check if software supports feature
  supportsFeature: (software: CythroDashServerSoftware, feature: keyof typeof software.features): boolean => {
    return software.features[feature] === true;
  },

  // Get effective resource requirements
  getResourceRequirements: (software: CythroDashServerSoftware, baseRequirements: any): any => {
    return {
      min_memory: software.resource_overrides?.min_memory || baseRequirements.min_memory,
      min_disk: software.resource_overrides?.min_disk || baseRequirements.min_disk,
      min_cpu: software.resource_overrides?.min_cpu || baseRequirements.min_cpu,
      recommended_memory: software.resource_overrides?.recommended_memory || baseRequirements.recommended_memory,
      recommended_disk: software.resource_overrides?.recommended_disk || baseRequirements.recommended_disk,
      recommended_cpu: software.resource_overrides?.recommended_cpu || baseRequirements.recommended_cpu,
    };
  },

  // Get default software values
  getDefaultSoftwareValues: (): Partial<CythroDashServerSoftware> => ({
    status: SoftwareStatus.ACTIVE,
    stability: SoftwareStability.STABLE,
    display_order: 100,
    environment_variables: [],
    docker_config: {
      image: '',
    },
    compatibility: {},
    features: {
      supports_plugins: false,
      supports_mods: false,
      supports_datapacks: false,
      supports_custom_worlds: true,
      supports_backups: true,
      supports_console_commands: true,
      supports_file_manager: true,
    },
    documentation: {},
    update_info: {},
    created_at: new Date(),
    updated_at: new Date(),
  }),

  // Validate software data
  validateSoftwareData: (software: Partial<CythroDashServerSoftware>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!software.id || software.id.trim().length === 0) {
      errors.push('Software ID is required');
    }

    if (!software.name || software.name.trim().length === 0) {
      errors.push('Software name is required');
    }

    if (!software.server_type_id || software.server_type_id.trim().length === 0) {
      errors.push('Server type ID is required');
    }

    if (software.pterodactyl_egg_id === undefined || software.pterodactyl_egg_id < 1) {
      errors.push('Valid Pterodactyl egg ID is required');
    }

    if (!software.version_info || !software.version_info.version) {
      errors.push('Version information is required');
    }

    if (!software.docker_config || !software.docker_config.image) {
      errors.push('Docker image is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Sort software by recommended status, stability, and display order
  sortSoftware: (software: CythroDashServerSoftware[]): CythroDashServerSoftware[] => {
    return software.sort((a, b) => {
      // Recommended items first
      if (a.recommended !== b.recommended) {
        return a.recommended ? -1 : 1;
      }

      // Then by stability (stable first)
      const stabilityOrder = {
        [SoftwareStability.STABLE]: 0,
        [SoftwareStability.BETA]: 1,
        [SoftwareStability.ALPHA]: 2,
        [SoftwareStability.EXPERIMENTAL]: 3,
      };
      
      if (a.stability !== b.stability) {
        return stabilityOrder[a.stability] - stabilityOrder[b.stability];
      }

      // Then by display order
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }

      // Finally by name
      return a.name.localeCompare(b.name);
    });
  },

  // Filter software by server type
  filterByServerType: (software: CythroDashServerSoftware[], serverTypeId: string): CythroDashServerSoftware[] => {
    return software.filter(s => s.server_type_id === serverTypeId && ServerSoftwareHelpers.isAvailable(s));
  },

  // Get software by stability level
  filterByStability: (software: CythroDashServerSoftware[], stability: SoftwareStability): CythroDashServerSoftware[] => {
    return software.filter(s => s.stability === stability);
  },
};

// Export collection name constant
export const SERVER_SOFTWARE_COLLECTION = 'cythro_dash_server_software';

// Export default
export default {
  SoftwareStatus,
  SoftwareStability,
  ServerSoftwareHelpers,
  SERVER_SOFTWARE_COLLECTION,
};
