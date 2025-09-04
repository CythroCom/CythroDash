/**
 * CythroDash - Pterodactyl Panel Server Management Hooks
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

export interface PterodactylServer {
  id: number;
  external_id: string | null;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  status: string | null;
  suspended: boolean;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string | null;
    oom_disabled: boolean;
    players?: number; // For game servers
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  user: number;
  node: number;
  allocation: number;
  nest: number;
  egg: number;
  container: {
    startup_command: string;
    image: string;
    installed: boolean;
    environment: Record<string, any>;
  };
  // Resource usage information
  resource_usage?: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
  // Additional server properties
  egg_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PterodactylDatabase {
  id: number;
  server: number;
  host: number;
  database: string;
  username: string;
  remote: string;
  max_connections: number;
  password?: string;
  created_at: string;
  updated_at: string;
}

export interface ServerCreateData {
  name: string;
  user: number;
  egg: number;
  docker_image?: string;
  startup?: string;
  environment?: Record<string, any>;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads?: string;
    oom_disabled?: boolean;
  };
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  allocation?: {
    default: number;
    additional?: number[];
  };
  deploy?: {
    locations: number[];
    dedicated_ip: boolean;
    port_range: string[];
  };
}

export interface ServerUpdateDetailsData {
  name?: string;
  user?: number;
  external_id?: string;
  description?: string;
}

export interface ServerUpdateBuildData {
  allocation: number;
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads?: string;
  feature_limits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  add_allocations?: number[];
  remove_allocations?: number[];
  oom_disabled?: boolean;
}

export interface ServerUpdateStartupData {
  startup: string;
  environment: Record<string, any>;
  egg: number;
  image?: string;
  skip_scripts?: boolean;
}

export interface ServerListParams {
  page?: number;
  per_page?: number;
  "filter[name]"?: string;
  "filter[uuid]"?: string;
  "filter[external_id]"?: string;
  "filter[image]"?: string;
  sort?: "id" | "uuid" | "name" | "created_at" | "updated_at";
  include?: string;
}

export interface ServerDetailsParams {
  include?: string;
}

export interface DatabaseCreateData {
  database: string;
  remote: string;
  host: number;
}

export interface DatabaseUpdateData {
  remote?: string;
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
  const clientApiKey = process.env.PANEL_CLIENT_API_KEY || process.env.NEXT_PUBLIC_PANEL_CLIENT_API_KEY;

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
    clientApiKey: clientApiKey,
  };
}

function getDefaultHeaders(includeContentType = false): HeadersInit {
  const { apiKey } = getPterodactylConfig();

  const headers: HeadersInit = {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "Application/vnd.pterodactyl.v1+json",
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
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

// SERVER MANAGEMENT FUNCTIONS

/** Get all servers from the Pterodactyl panel with optional filtering and pagination */
export async function panelServerGetAll(
  params?: ServerListParams
): Promise<PterodactylListResponse<PterodactylServer>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, "/api/application/servers", params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylServer>>(response);
}

/** Get details of a specific server from the Pterodactyl panel */
export async function panelServerGetDetails(
  serverId: number,
  params?: ServerDetailsParams
): Promise<PterodactylResponse<PterodactylServer>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/servers/${serverId}`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylServer>>(response);
}

/** Create a new server in the Pterodactyl panel */
export async function panelServerCreate(
  serverData: ServerCreateData
): Promise<PterodactylResponse<PterodactylServer>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers`, {
    method: "POST",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(serverData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylServer>>(response);
}

/** Update server details in the Pterodactyl panel */
export async function panelServerUpdateDetails(
  serverId: number,
  updateData: ServerUpdateDetailsData
): Promise<PterodactylResponse<PterodactylServer>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/details`, {
    method: "PATCH",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(updateData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylServer>>(response);
}

/** Update server build configuration in the Pterodactyl panel */
export async function panelServerUpdateBuild(
  serverId: number,
  buildData: ServerUpdateBuildData
): Promise<PterodactylResponse<PterodactylServer>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/build`, {
    method: "PATCH",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(buildData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylServer>>(response);
}

/** Update server startup configuration in the Pterodactyl panel */
export async function panelServerUpdateStartup(
  serverId: number,
  startupData: ServerUpdateStartupData
): Promise<PterodactylResponse<PterodactylServer>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/startup`, {
    method: "PATCH",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(startupData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylServer>>(response);
}

/** Suspend a server in the Pterodactyl panel */
export async function panelServerSuspend(serverId: number): Promise<void> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/suspend`, {
    method: "POST",
    headers: getDefaultHeaders(),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

/** Unsuspend a server in the Pterodactyl panel */
export async function panelServerUnsuspend(serverId: number): Promise<void> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/unsuspend`, {
    method: "POST",
    headers: getDefaultHeaders(),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

/** Reinstall a server in the Pterodactyl panel */
export async function panelServerReinstall(serverId: number): Promise<void> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/reinstall`, {
    method: "POST",
    headers: getDefaultHeaders(),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

/** Delete a server from the Pterodactyl panel */
export async function panelServerDelete(serverId: number, force = false): Promise<void> {
  const { baseUrl } = getPterodactylConfig();
  const url = force
    ? `${baseUrl}/api/application/servers/${serverId}?force=true`
    : `${baseUrl}/api/application/servers/${serverId}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: getDefaultHeaders(),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

// SERVER POWER MANAGEMENT FUNCTIONS (Client API)

/** Start a server using the client API */
export async function panelServerStart(serverId: number): Promise<void> {
  const { baseUrl, clientApiKey } = getPterodactylConfig();

  if (!clientApiKey) {
    throw new PterodactylError("Client API key not configured", 500, "CONFIG_ERROR");
  }

  const response = await fetch(`${baseUrl}/api/client/servers/${serverId}/power`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${clientApiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ signal: "start" }),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

/** Stop a server using the client API */
export async function panelServerStop(serverId: number): Promise<void> {
  const { baseUrl, clientApiKey } = getPterodactylConfig();

  if (!clientApiKey) {
    throw new PterodactylError("Client API key not configured", 500, "CONFIG_ERROR");
  }

  const response = await fetch(`${baseUrl}/api/client/servers/${serverId}/power`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${clientApiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ signal: "stop" }),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

/** Restart a server using the client API */
export async function panelServerRestart(serverId: number): Promise<void> {
  const { baseUrl, clientApiKey } = getPterodactylConfig();

  if (!clientApiKey) {
    throw new PterodactylError("Client API key not configured", 500, "CONFIG_ERROR");
  }

  const response = await fetch(`${baseUrl}/api/client/servers/${serverId}/power`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${clientApiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ signal: "restart" }),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

/** Kill a server using the client API */
export async function panelServerKill(serverId: number): Promise<void> {
  const { baseUrl, clientApiKey } = getPterodactylConfig();

  if (!clientApiKey) {
    throw new PterodactylError("Client API key not configured", 500, "CONFIG_ERROR");
  }

  const response = await fetch(`${baseUrl}/api/client/servers/${serverId}/power`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${clientApiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ signal: "kill" }),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

// DATABASE MANAGEMENT FUNCTIONS

/** Get all databases for a specific server */
export async function panelServerGetDatabases(
  serverId: number
): Promise<PterodactylListResponse<PterodactylDatabase>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/databases`, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylDatabase>>(response);
}

/** Get details of a specific database for a server */
export async function panelServerGetDatabaseDetails(
  serverId: number,
  databaseId: number
): Promise<PterodactylResponse<PterodactylDatabase>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/databases/${databaseId}`, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylDatabase>>(response);
}

/** Create a new database for a server */
export async function panelServerCreateDatabase(
  serverId: number,
  databaseData: DatabaseCreateData
): Promise<PterodactylResponse<PterodactylDatabase>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/databases`, {
    method: "POST",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(databaseData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylDatabase>>(response);
}

/** Update a database for a server */
export async function panelServerUpdateDatabase(
  serverId: number,
  databaseId: number,
  updateData: DatabaseUpdateData
): Promise<PterodactylResponse<PterodactylDatabase>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/databases/${databaseId}`, {
    method: "PATCH",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(updateData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylDatabase>>(response);
}

/** Reset password for a database */
export async function panelServerResetDatabasePassword(
  serverId: number,
  databaseId: number
): Promise<PterodactylResponse<PterodactylDatabase>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/databases/${databaseId}/reset-password`, {
    method: "POST",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylDatabase>>(response);
}

/** Delete a database from a server */
export async function panelServerDeleteDatabase(
  serverId: number,
  databaseId: number
): Promise<void> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/servers/${serverId}/databases/${databaseId}`, {
    method: "DELETE",
    headers: getDefaultHeaders(),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

// UTILITY FUNCTIONS

/** Search for servers by name */
export async function panelServerSearchByName(
  name: string,
  exactMatch = true
): Promise<PterodactylListResponse<PterodactylServer>> {
  return panelServerGetAll({
    "filter[name]": exactMatch ? name : `*${name}*`,
    per_page: 100,
  });
}

/** Search for servers by UUID */
export async function panelServerGetByUuid(
  uuid: string
): Promise<PterodactylListResponse<PterodactylServer>> {
  return panelServerGetAll({
    "filter[uuid]": uuid,
    per_page: 1,
  });
}

/** Get servers by user ID */
export async function panelServerGetByUser(
  userId: number,
  includeRelationships = false
): Promise<PterodactylListResponse<PterodactylServer>> {
  const response = await panelServerGetAll({
    per_page: 100,
    include: includeRelationships ? "user,node,allocations" : undefined,
  });

  // Filter by user ID since there's no direct filter for user in the API
  const filteredData = response.data.filter(server => server.attributes?.user === userId);

  return {
    ...response,
    data: filteredData,
    meta: {
      ...response.meta,
      pagination: {
        ...response.meta.pagination,
        total: filteredData.length,
        count: filteredData.length,
      }
    }
  };
}

/** Get suspended servers */
export async function panelServerGetSuspended(): Promise<PterodactylServer[]> {
  const response = await panelServerGetAll({ per_page: 100 });

  return response.data
    .filter(server => server.attributes?.suspended === true)
    .map(server => server.attributes!)
    .filter(Boolean);
}

/** Get servers by node ID */
export async function panelServerGetByNode(
  nodeId: number
): Promise<PterodactylServer[]> {
  const response = await panelServerGetAll({
    per_page: 100,
    include: "node"
  });

  return response.data
    .filter(server => server.attributes?.node === nodeId)
    .map(server => server.attributes!)
    .filter(Boolean);
}

/** Check if a server exists by name */
export async function panelServerExistsByName(name: string): Promise<boolean> {
  try {
    const response = await panelServerSearchByName(name, true);
    return response.data.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/** Get server statistics */
export interface ServerStats {
  total: number;
  suspended: number;
  active: number;
  byNode: Record<number, number>;
  byUser: Record<number, number>;
}

export async function panelServerGetStats(): Promise<ServerStats> {
  const response = await panelServerGetAll({
    per_page: 100,
    include: "user,node"
  });

  const servers = response.data.map(server => server.attributes!).filter(Boolean);

  const stats: ServerStats = {
    total: response.meta.pagination.total,
    suspended: servers.filter(server => server.suspended).length,
    active: servers.filter(server => !server.suspended).length,
    byNode: {},
    byUser: {},
  };

  // Count by node
  servers.forEach(server => {
    stats.byNode[server.node] = (stats.byNode[server.node] || 0) + 1;
  });

  // Count by user
  servers.forEach(server => {
    stats.byUser[server.user] = (stats.byUser[server.user] || 0) + 1;
  });

  return stats;
}

// BATCH OPERATIONS

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ data: any; error: PterodactylError }>;
  total: number;
  successCount: number;
  failureCount: number;
}

export interface BatchOptions {
  continueOnError?: boolean;
  delayBetweenRequests?: number;
}

/** Create multiple servers in batch */
export async function panelServerCreateBatch(
  serversData: ServerCreateData[],
  options: BatchOptions = { continueOnError: true, delayBetweenRequests: 200 }
): Promise<BatchResult<PterodactylServer>> {
  const result: BatchResult<PterodactylServer> = {
    successful: [],
    failed: [],
    total: serversData.length,
    successCount: 0,
    failureCount: 0,
  };

  for (const serverData of serversData) {
    try {
      const response = await panelServerCreate(serverData);
      if (response.attributes) {
        result.successful.push(response.attributes);
        result.successCount++;
      }

      if (options.delayBetweenRequests && options.delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenRequests));
      }
    } catch (error) {
      const pterodactylError = error instanceof PterodactylError
        ? error
        : new PterodactylError("Unknown error", 500, "UNKNOWN", error);

      result.failed.push({ data: serverData, error: pterodactylError });
      result.failureCount++;

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return result;
}

/** Suspend multiple servers in batch */
export async function panelServerSuspendBatch(
  serverIds: number[],
  options: BatchOptions = { continueOnError: true, delayBetweenRequests: 100 }
): Promise<BatchResult<number>> {
  const result: BatchResult<number> = {
    successful: [],
    failed: [],
    total: serverIds.length,
    successCount: 0,
    failureCount: 0,
  };

  for (const serverId of serverIds) {
    try {
      await panelServerSuspend(serverId);
      result.successful.push(serverId);
      result.successCount++;

      if (options.delayBetweenRequests && options.delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenRequests));
      }
    } catch (error) {
      const pterodactylError = error instanceof PterodactylError
        ? error
        : new PterodactylError("Unknown error", 500, "UNKNOWN", error);

      result.failed.push({ data: serverId, error: pterodactylError });
      result.failureCount++;

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return result;
}

/** Unsuspend multiple servers in batch */
export async function panelServerUnsuspendBatch(
  serverIds: number[],
  options: BatchOptions = { continueOnError: true, delayBetweenRequests: 100 }
): Promise<BatchResult<number>> {
  const result: BatchResult<number> = {
    successful: [],
    failed: [],
    total: serverIds.length,
    successCount: 0,
    failureCount: 0,
  };

  for (const serverId of serverIds) {
    try {
      await panelServerUnsuspend(serverId);
      result.successful.push(serverId);
      result.successCount++;

      if (options.delayBetweenRequests && options.delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenRequests));
      }
    } catch (error) {
      const pterodactylError = error instanceof PterodactylError
        ? error
        : new PterodactylError("Unknown error", 500, "UNKNOWN", error);

      result.failed.push({ data: serverId, error: pterodactylError });
      result.failureCount++;

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return result;
}

/** Delete multiple servers in batch */
export async function panelServerDeleteBatch(
  serverIds: number[],
  force = false,
  options: BatchOptions = { continueOnError: true, delayBetweenRequests: 200 }
): Promise<BatchResult<number>> {
  const result: BatchResult<number> = {
    successful: [],
    failed: [],
    total: serverIds.length,
    successCount: 0,
    failureCount: 0,
  };

  for (const serverId of serverIds) {
    try {
      await panelServerDelete(serverId, force);
      result.successful.push(serverId);
      result.successCount++;

      if (options.delayBetweenRequests && options.delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayBetweenRequests));
      }
    } catch (error) {
      const pterodactylError = error instanceof PterodactylError
        ? error
        : new PterodactylError("Unknown error", 500, "UNKNOWN", error);

      result.failed.push({ data: serverId, error: pterodactylError });
      result.failureCount++;

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return result;
}