/**
 * CythroDash - Pterodactyl Panel Node Management Hooks
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

// TYPE DEFINITIONS

export interface PterodactylResponse<T> {
  object: string;
  attributes?: T;
  relationships?: Record<string, any>;
}

export interface PterodactylListResponse<T> {
  object: "list";
  data: PterodactylResponse<T>[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links: Record<string, any>;
    };
  };
}

export interface PterodactylNode {
  id: number;
  uuid: string;
  public: boolean;
  name: string;
  description: string;
  location_id: number;
  fqdn: string;
  scheme: string;
  behind_proxy: boolean;
  maintenance_mode: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemon_listen: number;
  daemon_sftp: number;
  daemon_base: string;
  created_at: string;
  updated_at: string;
  allocated_resources: {
    memory: number;
    disk: number;
  };
}

export interface PterodactylAllocation {
  id: number;
  ip: string;
  ip_alias: string | null;
  port: number;
  notes: string | null;
  assigned: boolean;
}

export interface NodeListParams {
  page?: number;
  per_page?: number;
  "filter[name]"?: string;
  "filter[uuid]"?: string;
  "filter[fqdn]"?: string;
  sort?: "id" | "uuid" | "name" | "created_at" | "updated_at";
  include?: "allocations" | "location" | "servers";
}

export interface NodeDetailsParams {
  include?: "allocations" | "location" | "servers";
}

export class PterodactylError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "PterodactylError";
  }
}

// API CLIENT UTILITIES

function getPterodactylConfig() {
  const panelUrl = process.env.PANEL_URL || process.env.NEXT_PUBLIC_PANEL_URL;
  const apiKey = process.env.PANEL_API_KEY || process.env.NEXT_PUBLIC_PANEL_API_KEY;

  if (!panelUrl || !apiKey) {
    throw new PterodactylError(
      "Missing Pterodactyl configuration. Please set PANEL_URL and PANEL_API_KEY environment variables.",
      500,
      "MISSING_CONFIG"
    );
  }

  return {
    baseUrl: panelUrl.endsWith("/") ? panelUrl.slice(0, -1) : panelUrl,
    apiKey: apiKey,
  };
}

function getDefaultHeaders(): HeadersInit {
  const { apiKey } = getPterodactylConfig();

  return {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "Application/vnd.pterodactyl.v1+json",
  };
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = response.status.toString();
    let errorDetails: any = null;

    try {
      const errorData = await response.json();
      if (errorData.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.map((err: any) => err.detail || err.message).join(", ");
        errorCode = errorData.errors[0]?.code || errorCode;
        errorDetails = errorData.errors;
      }
    } catch {
      // If we can't parse the error response, use the default message
    }

    throw new PterodactylError(errorMessage, response.status, errorCode, errorDetails);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new PterodactylError(
      "Failed to parse API response",
      500,
      "PARSE_ERROR",
      error
    );
  }
}

function buildUrl(baseUrl: string, endpoint: string, params?: Record<string, any>): string {
  const url = new URL(`${baseUrl}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });
  }

  return url.toString();
}

// NODE MANAGEMENT FUNCTIONS

/** Get all nodes from the Pterodactyl panel with optional filtering and pagination */
export async function panelNodeGetAll(
  params?: NodeListParams
): Promise<PterodactylListResponse<PterodactylNode>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, "/api/application/nodes", params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylNode>>(response);
}

/** Get details of a specific node from the Pterodactyl panel */
export async function panelNodeGetDetails(
  nodeId: number,
  params?: NodeDetailsParams
): Promise<PterodactylResponse<PterodactylNode>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/nodes/${nodeId}`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylNode>>(response);
}

// UTILITY FUNCTIONS

/** Search for nodes by name */
export async function panelNodeSearchByName(name: string): Promise<PterodactylNode[]> {
  const response = await panelNodeGetAll({
    "filter[name]": name,
    per_page: 100,
  });

  return response.data
    .map(node => node.attributes!)
    .filter(Boolean);
}

/** Search for nodes by FQDN */
export async function panelNodeSearchByFqdn(fqdn: string): Promise<PterodactylNode[]> {
  const response = await panelNodeGetAll({
    "filter[fqdn]": fqdn,
    per_page: 100,
  });

  return response.data
    .map(node => node.attributes!)
    .filter(Boolean);
}

/** Get node by UUID */
export async function panelNodeGetByUuid(uuid: string): Promise<PterodactylNode | null> {
  const response = await panelNodeGetAll({
    "filter[uuid]": uuid,
    per_page: 1,
  });

  const node = response.data.find(node => node.attributes?.uuid === uuid);
  return node?.attributes || null;
}

/** Get nodes with their allocations included */
export async function panelNodeGetAllWithAllocations(): Promise<PterodactylListResponse<PterodactylNode>> {
  return panelNodeGetAll({ include: "allocations", per_page: 100 });
}

/** Get nodes with their location included */
export async function panelNodeGetAllWithLocation(): Promise<PterodactylListResponse<PterodactylNode>> {
  return panelNodeGetAll({ include: "location", per_page: 100 });
}

/** Get nodes with their servers included */
export async function panelNodeGetAllWithServers(): Promise<PterodactylListResponse<PterodactylNode>> {
  return panelNodeGetAll({ include: "servers", per_page: 100 });
}

/** Get nodes by location ID */
export async function panelNodeGetByLocation(locationId: number): Promise<PterodactylNode[]> {
  const response = await panelNodeGetAll({ per_page: 100 });

  return response.data
    .filter(node => node.attributes?.location_id === locationId)
    .map(node => node.attributes!)
    .filter(Boolean);
}

/** Get nodes in maintenance mode */
export async function panelNodeGetInMaintenance(): Promise<PterodactylNode[]> {
  const response = await panelNodeGetAll({ per_page: 100 });

  return response.data
    .filter(node => node.attributes?.maintenance_mode === true)
    .map(node => node.attributes!)
    .filter(Boolean);
}

/** Check if a node exists by name */
export async function panelNodeExistsByName(name: string): Promise<boolean> {
  try {
    const nodes = await panelNodeSearchByName(name);
    return nodes.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}