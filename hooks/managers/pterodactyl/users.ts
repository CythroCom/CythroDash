/**
 * CythroDash - Pterodactyl Panel User Management Hooks
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

export interface PterodactylUser {
  id: number;
  external_id: string | null;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  root_admin: boolean;
  "2fa": boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface UserCreateData {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password?: string;
  language?: string;
  root_admin?: boolean;
  external_id?: string;
}

export interface UserUpdateData {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  language?: string;
  root_admin?: boolean;
  external_id?: string;
}

export interface UserListParams {
  page?: number;
  per_page?: number;
  "filter[email]"?: string;
  "filter[uuid]"?: string;
  "filter[username]"?: string;
  "filter[external_id]"?: string;
  sort?: "id" | "uuid" | "username" | "email" | "created_at" | "updated_at";
  include?: "servers";
}

export interface UserDetailsParams {
  include?: "servers";
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

// USER MANAGEMENT FUNCTIONS

/** Create a new user in the Pterodactyl panel */
export async function panelUserCreate(
  userData: UserCreateData
): Promise<PterodactylResponse<PterodactylUser>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/users`, {
    method: "POST",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(userData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylUser>>(response);
}

/** Update an existing user in the Pterodactyl panel */
export async function panelUserUpdate(
  userId: number,
  updateData: UserUpdateData
): Promise<PterodactylResponse<PterodactylUser>> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/users/${userId}`, {
    method: "PATCH",
    headers: getDefaultHeaders(true),
    body: JSON.stringify(updateData),
  });

  return handleApiResponse<PterodactylResponse<PterodactylUser>>(response);
}

/** Get details of a specific user from the Pterodactyl panel */
export async function panelUserGetDetails(
  userId: number,
  params?: UserDetailsParams
): Promise<PterodactylResponse<PterodactylUser>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/users/${userId}`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylUser>>(response);
}

/** Get all users from the Pterodactyl panel with optional filtering and pagination */
export async function panelUserGetAll(
  params?: UserListParams
): Promise<PterodactylListResponse<PterodactylUser>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, "/api/application/users", params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylUser>>(response);
}

/** Get servers associated with a specific user */
export async function panelUserGetServers(
  userId: number
): Promise<PterodactylResponse<PterodactylUser>> {
  return panelUserGetDetails(userId, { include: "servers" });
}

/** Delete a user from the Pterodactyl panel */
export async function panelUserDelete(userId: number): Promise<void> {
  const { baseUrl } = getPterodactylConfig();

  const response = await fetch(`${baseUrl}/api/application/users/${userId}`, {
    method: "DELETE",
    headers: getDefaultHeaders(),
  });

  if (response.status !== 204) {
    await handleApiResponse(response);
  }
}

// UTILITY FUNCTIONS

/** Search for users by email address */
export async function panelUserSearchByEmail(
  email: string,
  exactMatch = true
): Promise<PterodactylListResponse<PterodactylUser>> {
  return panelUserGetAll({
    "filter[email]": exactMatch ? email : `*${email}*`,
    per_page: 100,
  });
}

/** Search for users by username */
export async function panelUserSearchByUsername(
  username: string,
  exactMatch = true
): Promise<PterodactylListResponse<PterodactylUser>> {
  return panelUserGetAll({
    "filter[username]": exactMatch ? username : `*${username}*`,
    per_page: 100,
  });
}

/** Get user by UUID */
export async function panelUserGetByUuid(
  uuid: string
): Promise<PterodactylListResponse<PterodactylUser>> {
  return panelUserGetAll({
    "filter[uuid]": uuid,
    per_page: 1,
  });
}

/** Get all admin users */
export async function panelUserGetAdmins(
  includeServers = false
): Promise<PterodactylUser[]> {
  const response = await panelUserGetAll({
    per_page: 100,
    include: includeServers ? "servers" : undefined,
  });

  return response.data
    .filter(user => user.attributes?.root_admin === true)
    .map(user => user.attributes!)
    .filter(Boolean);
}

/** Check if a user exists by email */
export async function panelUserExistsByEmail(email: string): Promise<boolean> {
  try {
    const response = await panelUserSearchByEmail(email, true);
    return response.data.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/** Check if a user exists by username */
export async function panelUserExistsByUsername(username: string): Promise<boolean> {
  try {
    const response = await panelUserSearchByUsername(username, true);
    return response.data.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export interface UserStats {
  total: number;
  admins: number;
  regular: number;
  with2fa: number;
  without2fa: number;
}

/** Get user statistics */
export async function panelUserGetStats(): Promise<UserStats> {
  const response = await panelUserGetAll({ per_page: 100 });

  const users = response.data.map(user => user.attributes!).filter(Boolean);

  const stats: UserStats = {
    total: response.meta.pagination.total,
    admins: users.filter(user => user.root_admin).length,
    regular: users.filter(user => !user.root_admin).length,
    with2fa: users.filter(user => user["2fa"]).length,
    without2fa: users.filter(user => !user["2fa"]).length,
  };

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

/** Create multiple users in batch */
export async function panelUserCreateBatch(
  usersData: UserCreateData[],
  options: BatchOptions = { continueOnError: true, delayBetweenRequests: 100 }
): Promise<BatchResult<PterodactylUser>> {
  const result: BatchResult<PterodactylUser> = {
    successful: [],
    failed: [],
    total: usersData.length,
    successCount: 0,
    failureCount: 0,
  };

  for (const userData of usersData) {
    try {
      const response = await panelUserCreate(userData);
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

      result.failed.push({ data: userData, error: pterodactylError });
      result.failureCount++;

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return result;
}

