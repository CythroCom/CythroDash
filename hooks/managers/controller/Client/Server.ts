/**
 * CythroDash - Client Server Controller
 *
 * Bridges Pterodactyl Client API with CythroDash DB servers. Exposes helpers
 * to fetch live status & usage and to execute power actions, merging DB metadata
 * with panel state.
 */

// Client API not used in this scope; stubbed to avoid hard dependency
// import { pteroClientServers, ClientServerResourcesResponse, ClientServerAttributes } from '../../pterodactyl/client/server'
import { serverOperations } from '@/hooks/managers/database/servers'
import { CythroDashServer } from '@/database/tables/cythro_dash_servers'

type ClientServerResourcesResponse = any
type ClientServerAttributes = any
const CLIENT_API_DISABLED = true

export type LiveServerStatus = {
  state: 'running' | 'offline' | 'starting' | 'stopping' | 'unknown'
  is_suspended: boolean
  cpu_absolute: number
  memory_bytes: number
  memory_limit_bytes: number
  disk_bytes: number
  network_rx_bytes: number
  network_tx_bytes: number
  uptime_ms: number
}

export type EnrichedServer = {
  db: CythroDashServer | null
  panel?: {
    identifier: string
    internal_id: number
    uuid: string
    name: string
    description?: string
    status: ClientServerAttributes['status']
    is_suspended: boolean
    limits: ClientServerAttributes['limits']
  }
  live?: LiveServerStatus
}

/** Map pterodactyl state to narrow union */
function asState(s?: string | null): LiveServerStatus['state'] {
  if (s === 'running' || s === 'offline' || s === 'starting' || s === 'stopping') return s
  return 'unknown'
}

/**
 * Resolve panel identifier for a DB server.
 * Prefer db.pterodactyl_identifier; fallback to db.pterodactyl_uuid; lastly numeric id as string.
 */
function resolvePanelIdentifier(db: CythroDashServer | null): string | null {
  if (!db) return null
  if (db.pterodactyl_identifier) return db.pterodactyl_identifier
  if (db.pterodactyl_uuid) return db.pterodactyl_uuid
  if (db.pterodactyl_server_id) return String(db.pterodactyl_server_id)
  return null
}

export const ClientServerController = {
  /**
   * Get live status and usage by pterodactyl server id (numeric) or identifier/uuid.
   */
  async getServerStatus(pterodactyl_server_id: number | string): Promise<{ success: boolean; status?: LiveServerStatus; message?: string }>{
    return { success: false, message: 'Client API disabled' }
  },

  /** Get comprehensive server details (DB + panel + live) */
  async getServerDetails(pterodactyl_server_id: number | string): Promise<{ success: boolean; server?: EnrichedServer; message?: string }>{
    return { success: false, message: 'Client API disabled' }
  },

  /** Execute power action via client API */
  async executeServerAction(pterodactyl_server_id: number | string, action: 'start' | 'stop' | 'restart' | 'kill'):
    Promise<{ success: boolean; message: string }>{
    return { success: false, message: 'Client API disabled' }
  }
}

