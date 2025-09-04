/**
 * CythroDash - Pterodactyl Panel Nest Management Hooks
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

export interface PterodactylNest {
  id: number;
  uuid: string;
  author: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface NestListParams {
  page?: number;
  per_page?: number;
  include?: "eggs" | "servers";
}

export interface NestDetailsParams {
  include?: "eggs" | "servers";
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

// NEST MANAGEMENT FUNCTIONS

/** Get all nests from the Pterodactyl panel with optional filtering and pagination */
export async function panelNestGetAll(
  params?: NestListParams
): Promise<PterodactylListResponse<PterodactylNest>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, "/api/application/nests", params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylNest>>(response);
}

/** Get details of a specific nest from the Pterodactyl panel */
export async function panelNestGetDetails(
  nestId: number,
  params?: NestDetailsParams
): Promise<PterodactylResponse<PterodactylNest>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/nests/${nestId}`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylNest>>(response);
}

// UTILITY FUNCTIONS

/** Search for nests by name */
export async function panelNestSearchByName(name: string): Promise<PterodactylNest[]> {
  const response = await panelNestGetAll({ per_page: 100 });

  return response.data
    .filter(nest => nest.attributes?.name.toLowerCase().includes(name.toLowerCase()))
    .map(nest => nest.attributes!)
    .filter(Boolean);
}

/** Get nest by UUID */
export async function panelNestGetByUuid(uuid: string): Promise<PterodactylNest | null> {
  const response = await panelNestGetAll({ per_page: 100 });

  const nest = response.data.find(nest => nest.attributes?.uuid === uuid);
  return nest?.attributes || null;
}

/** Check if a nest exists by name */
export async function panelNestExistsByName(name: string): Promise<boolean> {
  try {
    const nests = await panelNestSearchByName(name);
    return nests.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/** Get nests with their eggs included */
export async function panelNestGetAllWithEggs(): Promise<PterodactylListResponse<PterodactylNest>> {
  return panelNestGetAll({ include: "eggs", per_page: 100 });
}

/** Get nests with their servers included */
export async function panelNestGetAllWithServers(): Promise<PterodactylListResponse<PterodactylNest>> {
  return panelNestGetAll({ include: "servers", per_page: 100 });
}