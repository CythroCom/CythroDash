/**
 * CythroDash - Pterodactyl Panel Egg Management Hooks
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

export interface PterodactylEgg {
  id: number;
  uuid: string;
  name: string;
  nest: number;
  author: string;
  description: string;
  docker_image: string;
  docker_images?: Record<string, string>;
  config: {
    files: Record<string, any>;
    startup: Record<string, any>;
    stop: string;
    logs: any[];
    file_denylist: string[];
    extends: string | null;
  };
  startup: string;
  script: {
    privileged: boolean;
    install: string;
    entry: string;
    container: string;
    extends: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface PterodactylEggVariable {
  id: number;
  egg_id: number;
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
  created_at: string;
  updated_at: string;
}

export interface EggListParams {
  page?: number;
  per_page?: number;
  include?: "variables" | "nest";
}

export interface EggDetailsParams {
  include?: "variables" | "nest";
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

// EGG MANAGEMENT FUNCTIONS

/** Get all eggs within a specific nest */
export async function panelEggGetAll(
  nestId: number,
  params?: EggListParams
): Promise<PterodactylListResponse<PterodactylEgg>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/nests/${nestId}/eggs`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylListResponse<PterodactylEgg>>(response);
}

/** Get details of a specific egg within a nest */
export async function panelEggGetDetails(
  nestId: number,
  eggId: number,
  params?: EggDetailsParams
): Promise<PterodactylResponse<PterodactylEgg>> {
  const { baseUrl } = getPterodactylConfig();
  const url = buildUrl(baseUrl, `/api/application/nests/${nestId}/eggs/${eggId}`, params);

  const response = await fetch(url, {
    method: "GET",
    headers: getDefaultHeaders(),
  });

  return handleApiResponse<PterodactylResponse<PterodactylEgg>>(response);
}

// UTILITY FUNCTIONS

/** Search for eggs by name within a specific nest */
export async function panelEggSearchByName(
  nestId: number,
  name: string
): Promise<PterodactylEgg[]> {
  const response = await panelEggGetAll(nestId, { per_page: 100 });

  return response.data
    .filter(egg => egg.attributes?.name.toLowerCase().includes(name.toLowerCase()))
    .map(egg => egg.attributes!)
    .filter(Boolean);
}

/** Get egg by UUID within a specific nest */
export async function panelEggGetByUuid(
  nestId: number,
  uuid: string
): Promise<PterodactylEgg | null> {
  const response = await panelEggGetAll(nestId, { per_page: 100 });

  const egg = response.data.find(egg => egg.attributes?.uuid === uuid);
  return egg?.attributes || null;
}

/** Check if an egg exists by name within a specific nest */
export async function panelEggExistsByName(
  nestId: number,
  name: string
): Promise<boolean> {
  try {
    const eggs = await panelEggSearchByName(nestId, name);
    return eggs.length > 0;
  } catch (error) {
    if (error instanceof PterodactylError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/** Get eggs with their variables included */
export async function panelEggGetAllWithVariables(
  nestId: number
): Promise<PterodactylListResponse<PterodactylEgg>> {
  return panelEggGetAll(nestId, { include: "variables", per_page: 100 });
}

/** Get eggs by Docker image */
export async function panelEggGetByDockerImage(
  nestId: number,
  dockerImage: string
): Promise<PterodactylEgg[]> {
  const response = await panelEggGetAll(nestId, { per_page: 100 });

  return response.data
    .filter(egg => egg.attributes?.docker_image === dockerImage)
    .map(egg => egg.attributes!)
    .filter(Boolean);
}

/** Search for eggs across all nests by name */
export async function panelEggSearchGlobalByName(name: string): Promise<Array<{ nestId: number; egg: PterodactylEgg }>> {
  // First get all nests
  const { panelNestGetAll } = await import('./nests');
  const nestsResponse = await panelNestGetAll({ per_page: 100 });

  const results: Array<{ nestId: number; egg: PterodactylEgg }> = [];

  // Search in each nest
  for (const nestResponse of nestsResponse.data) {
    if (nestResponse.attributes) {
      const nestId = nestResponse.attributes.id;
      const eggs = await panelEggSearchByName(nestId, name);

      for (const egg of eggs) {
        results.push({ nestId, egg });
      }
    }
  }

  return results;
}

/** Get all eggs across all nests */
export async function panelEggGetAllGlobal(): Promise<Array<{ nestId: number; egg: PterodactylEgg }>> {
  // First get all nests
  const { panelNestGetAll } = await import('./nests');
  const nestsResponse = await panelNestGetAll({ per_page: 100 });

  const results: Array<{ nestId: number; egg: PterodactylEgg }> = [];

  // Get eggs from each nest
  for (const nestResponse of nestsResponse.data) {
    if (nestResponse.attributes) {
      const nestId = nestResponse.attributes.id;
      const eggsResponse = await panelEggGetAll(nestId, { per_page: 100 });

      for (const eggResponse of eggsResponse.data) {
        if (eggResponse.attributes) {
          results.push({ nestId, egg: eggResponse.attributes });
        }
      }
    }
  }

  return results;
}

/** Get egg statistics for a specific nest */
export interface EggStats {
  total: number;
  byAuthor: Record<string, number>;
  byDockerImage: Record<string, number>;
}

export async function panelEggGetStats(nestId: number): Promise<EggStats> {
  const response = await panelEggGetAll(nestId, { per_page: 100 });

  const eggs = response.data.map(egg => egg.attributes!).filter(Boolean);

  const stats: EggStats = {
    total: response.meta.pagination.total,
    byAuthor: {},
    byDockerImage: {},
  };

  // Count by author
  eggs.forEach(egg => {
    stats.byAuthor[egg.author] = (stats.byAuthor[egg.author] || 0) + 1;
  });

  // Count by docker image
  eggs.forEach(egg => {
    stats.byDockerImage[egg.docker_image] = (stats.byDockerImage[egg.docker_image] || 0) + 1;
  });

  return stats;
}

/** Get eggs that support specific Docker images */
export async function panelEggGetByDockerImageSupport(
  nestId: number,
  dockerImage: string
): Promise<PterodactylEgg[]> {
  const response = await panelEggGetAll(nestId, { per_page: 100 });

  return response.data
    .filter(egg => {
      if (!egg.attributes) return false;

      // Check primary docker image
      if (egg.attributes.docker_image === dockerImage) return true;

      // Check additional docker images if available
      if (egg.attributes.docker_images) {
        return Object.values(egg.attributes.docker_images).includes(dockerImage);
      }

      return false;
    })
    .map(egg => egg.attributes!)
    .filter(Boolean);
}