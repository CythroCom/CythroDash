/**
 * CythroDash - Pterodactyl Panel Location Management Hooks
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

export interface PterodactylLocation {
  id: number;
  short: string;
  long: string;
  created_at: string;
  updated_at: string;
}

export interface LocationListParams {
  page?: number;
  per_page?: number;
  "filter[short]"?: string;
  "filter[long]"?: string;
  sort?: "id" | "short" | "long" | "created_at" | "updated_at";
  include?: "nodes" | "servers";
}

export interface LocationDetailsParams {
  include?: "nodes" | "servers";
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

// LOCATION MANAGEMENT FUNCTIONS

/** Get all locations from the Pterodactyl panel with optional filtering and pagination */
export async function panelLocationGetAll(
  params?: LocationListParams
): Promise<PterodactylListResponse<PterodactylLocation>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, "/api/application/locations", params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylLocation>>(response);
}

/** Get details of a specific location from the Pterodactyl panel */
export async function panelLocationGetDetails(
  locationId: number,
  params?: LocationDetailsParams
): Promise<PterodactylResponse<PterodactylLocation>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/locations/${locationId}`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylLocation>>(response);
}

// UTILITY FUNCTIONS

/** Search for locations by short code */
export async function panelLocationSearchByShort(short: string): Promise<PterodactylLocation[]> {
  const response = await panelLocationGetAll({
    "filter[short]": short,
    per_page: 100,
  });

  return response.data
    .map(location => location.attributes!)
    .filter(Boolean);
}

/** Search for locations by long name */
export async function panelLocationSearchByLong(long: string): Promise<PterodactylLocation[]> {
  const response = await panelLocationGetAll({
    "filter[long]": long,
    per_page: 100,
  });

  return response.data
    .map(location => location.attributes!)
    .filter(Boolean);
}

/** Get locations with their nodes included */
export async function panelLocationGetAllWithNodes(): Promise<PterodactylListResponse<PterodactylLocation>> {
  return panelLocationGetAll({ include: "nodes", per_page: 100 });
}

/** Get locations with their servers included */
export async function panelLocationGetAllWithServers(): Promise<PterodactylListResponse<PterodactylLocation>> {
  return panelLocationGetAll({ include: "servers", per_page: 100 });
}

/** Check if a location exists by short code */
export async function panelLocationExistsByShort(short: string): Promise<boolean> {
  try {
    const locations = await panelLocationSearchByShort(short);
    return locations.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}