/**
 * CythroDash - Pterodactyl Client API (User) Manager
 *
 * Provides read-only and control endpoints using the client API key (ptlc_*).
 * Do NOT use the admin API key here. This is intended for live status/usage,
 * power controls, console and activity, mirroring patterns from the admin manager.
 */

// TYPES (subset shaped after Pterodactyl Client API responses)
export interface ClientApiListResponse<T> {
  object: 'list';
  data: Array<{ object: string; attributes: T; relationships?: Record<string, any> }>;
  meta?: any;
}

export interface ClientApiObjectResponse<T> {
  object: string;
  attributes: T;
  relationships?: Record<string, any>;
  meta?: any;
}

export interface ClientServerAttributes {
  server_owner: boolean;
  identifier: string; // short id
  internal_id: number; // numeric id on panel
  uuid: string;
  name: string;
  description?: string;
  node: string;
  is_suspended: boolean;
  is_installing: boolean;
  is_transferring: boolean;
  status: 'running' | 'offline' | 'starting' | 'stopping' | null;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number; // percent (e.g., 200 means 2 cores on panel)
    threads: string | null;
    oom_disabled?: boolean;
  };
  feature_limits: { databases: number; allocations: number; backups: number };
}

export interface ClientServerResourcesResponse {
  object: 'stats';
  attributes: {
    current_state: 'running' | 'offline' | 'starting' | 'stopping' | 'unknown';
    is_suspended: boolean;
    resources: {
      memory_bytes: number;
      memory_limit_bytes: number;
      cpu_absolute: number;
      disk_bytes: number;
      network_rx_bytes: number;
      network_tx_bytes: number;
      uptime: number; // ms
    };
  };
}

export class PterodactylClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PterodactylClientError';
  }
}

// CONFIG/HEADERS (mirrors admin manager style but uses client key)
function getClientConfig() {
  const baseUrl = (process.env.PANEL_URL || process.env.NEXT_PUBLIC_PANEL_URL || '').replace(/\/$/, '');
  // Prefer server-side client key; optionally fall back to NEXT_PUBLIC for dev
  const apiKey = process.env.PANEL_CLIENT_API_KEY || process.env.NEXT_PUBLIC_PANEL_CLIENT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new PterodactylClientError(
      'Missing Pterodactyl client configuration. Set PANEL_URL and PANEL_CLIENT_API_KEY.',
      500,
      'MISSING_CLIENT_CONFIG'
    );
  }

  return { baseUrl, apiKey };
}

function getClientHeaders(includeContentType = false): HeadersInit {
  const { apiKey } = getClientConfig();
  const headers: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'Application/vnd.pterodactyl.v1+json',
  };
  if (includeContentType) (headers as any)['Content-Type'] = 'application/json';
  return headers;
}

async function handleClientResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let code = response.status.toString();
    let details: any = null;
    try {
      const err = await response.json();
      if (Array.isArray(err?.errors) && err.errors.length) {
        message = err.errors.map((e: any) => e.detail || e.message).join(', ');
        code = err.errors[0]?.code || code;
        details = err.errors;
      }
    } catch {}
    throw new PterodactylClientError(message, response.status, code, details);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    // @ts-expect-error returning undefined for void-like endpoints
    return undefined;
  }

  try {
    return await response.json();
  } catch (e) {
    throw new PterodactylClientError('Failed to parse client API response', 500, 'PARSE_ERROR');
  }
}

// PUBLIC CLIENT API
export const pteroClientServers = {
  /** List servers for this client key */
  async list(params?: { page?: number; per_page?: number; include?: string }): Promise<ClientApiListResponse<ClientServerAttributes>> {
    const { baseUrl } = getClientConfig();
    const url = new URL(`${baseUrl}/api/client`);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.per_page) url.searchParams.set('per_page', String(params.per_page));
    if (params?.include) url.searchParams.set('include', params.include);

    const res = await fetch(url.toString(), { headers: getClientHeaders() });
    return handleClientResponse(res);
  },

  /** Get server details by identifier (short id) or UUID */
  async getDetails(server: string): Promise<ClientApiObjectResponse<ClientServerAttributes>> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}`, { headers: getClientHeaders() });
    return handleClientResponse(res);
  },

  /** Get live resource usage (CPU/memory/disk/status/uptime) */
  async getResources(server: string): Promise<ClientServerResourcesResponse> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/resources`, { headers: getClientHeaders() });
    return handleClientResponse(res);
  },

  /** Power management: start/stop/restart/kill (204 on success) */
  async power(server: string, signal: 'start' | 'stop' | 'restart' | 'kill'): Promise<void> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/power`, {
      method: 'POST',
      headers: getClientHeaders(true),
      body: JSON.stringify({ signal }),
    });
    await handleClientResponse(res);
  },

  /** Get WebSocket credentials for console access */
  async getWebsocket(server: string): Promise<{ data: { token: string; socket: string } }> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/websocket`, { headers: getClientHeaders() });
    return handleClientResponse(res);
  },

  /** Send console command (204 on success) */
  async sendCommand(server: string, command: string): Promise<void> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/command`, {
      method: 'POST',
      headers: getClientHeaders(true),
      body: JSON.stringify({ command }),
    });
    await handleClientResponse(res);
  },

  /** Activity logs */
  async getActivity(server: string): Promise<ClientApiListResponse<any>> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/activity`, { headers: getClientHeaders() });
    return handleClientResponse(res);
  },

  /** Startup configuration (variables and meta) */
  async getStartup(server: string): Promise<ClientApiListResponse<any>> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/startup`, { headers: getClientHeaders() });
    return handleClientResponse(res);
  },

  /** Update a startup variable */
  async updateStartupVariable(server: string, key: string, value: string): Promise<ClientApiObjectResponse<any>> {
    const { baseUrl } = getClientConfig();
    const res = await fetch(`${baseUrl}/api/client/servers/${server}/startup/variable`, {
      method: 'PUT',
      headers: getClientHeaders(true),
      body: JSON.stringify({ key, value }),
    });
    return handleClientResponse(res);
  },
};

