/**
 * CythroDash - Client Server Controller
 *
 * Bridges Pterodactyl Client API with CythroDash DB servers. Exposes helpers
 * to fetch live status & usage and to execute power actions, merging DB metadata
 * with panel state.
 */

import { pteroClientServers, ClientServerResourcesResponse, ClientServerAttributes } from '@/hooks/managers/pterodactyl/client/server'
import { serverOperations } from '@/hooks/managers/database/servers'
import { CythroDashServer } from '@/database/tables/cythro_dash_servers'

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
    try {
      // If caller passed numeric id, try to locate db server to get short identifier first
      let identifier: string | null = null
      let db: CythroDashServer | null = null

      if (typeof pterodactyl_server_id === 'number' || /^[0-9]+$/.test(String(pterodactyl_server_id))) {
        db = await serverOperations.getServerByPterodactylId(Number(pterodactyl_server_id))
        identifier = resolvePanelIdentifier(db)
      } else {
        identifier = String(pterodactyl_server_id)
      }

      if (!identifier) {
        return { success: false, message: 'Server identifier not found' }
      }

      const resources: ClientServerResourcesResponse = await pteroClientServers.getResources(identifier)
      const r = resources.attributes

      const status: LiveServerStatus = {
        state: asState(r.current_state),
        is_suspended: r.is_suspended,
        cpu_absolute: r.resources.cpu_absolute ?? 0,
        memory_bytes: r.resources.memory_bytes ?? 0,
        memory_limit_bytes: r.resources.memory_limit_bytes ?? 0,
        disk_bytes: r.resources.disk_bytes ?? 0,
        network_rx_bytes: r.resources.network_rx_bytes ?? 0,
        network_tx_bytes: r.resources.network_tx_bytes ?? 0,
        uptime_ms: r.resources.uptime ?? 0,
      }

      return { success: true, status }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  },

  /** Get comprehensive server details (DB + panel + live) */
  async getServerDetails(pterodactyl_server_id: number | string): Promise<{ success: boolean; server?: EnrichedServer; message?: string }>{
    try {
      let identifier: string | null = null
      let db: CythroDashServer | null = null

      if (typeof pterodactyl_server_id === 'number' || /^[0-9]+$/.test(String(pterodactyl_server_id))) {
        db = await serverOperations.getServerByPterodactylId(Number(pterodactyl_server_id))
        identifier = resolvePanelIdentifier(db)
      } else {
        identifier = String(pterodactyl_server_id)
        // Try lookup DB by identifier if possible
        // Not available directly — leaving db possibly null
      }

      if (!identifier) return { success: false, message: 'Server identifier not found' }

      const [detailsResp, resourcesResp] = await Promise.all([
        pteroClientServers.getDetails(identifier),
        pteroClientServers.getResources(identifier),
      ])

      const details = detailsResp.attributes
      const res = resourcesResp.attributes

      const enriched: EnrichedServer = {
        db,
        panel: {
          identifier: details.identifier,
          internal_id: details.internal_id,
          uuid: details.uuid,
          name: details.name,
          description: details.description,
          status: details.status,
          is_suspended: details.is_suspended,
          limits: details.limits,
        },
        live: {
          state: asState(res.current_state),
          is_suspended: res.is_suspended,
          cpu_absolute: res.resources.cpu_absolute ?? 0,
          memory_bytes: res.resources.memory_bytes ?? 0,
          memory_limit_bytes: res.resources.memory_limit_bytes ?? 0,
          disk_bytes: res.resources.disk_bytes ?? 0,
          network_rx_bytes: res.resources.network_rx_bytes ?? 0,
          network_tx_bytes: res.resources.network_tx_bytes ?? 0,
          uptime_ms: res.resources.uptime ?? 0,
        },
      }

      return { success: true, server: enriched }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  },

  /** Execute power action via client API */
  async executeServerAction(pterodactyl_server_id: number | string, action: 'start' | 'stop' | 'restart' | 'kill'):
    Promise<{ success: boolean; message: string }>{
    try {
      let identifier: string | null = null
      let db: CythroDashServer | null = null
      if (typeof pterodactyl_server_id === 'number' || /^[0-9]+$/.test(String(pterodactyl_server_id))) {
        db = await serverOperations.getServerByPterodactylId(Number(pterodactyl_server_id))
        identifier = resolvePanelIdentifier(db)
      } else {
        identifier = String(pterodactyl_server_id)
      }
      if (!identifier) return { success: false, message: 'Server identifier not found' }

      await pteroClientServers.power(identifier, action)

      // Fire-and-forget server action log
      try {
        const { serverLogsOperations } = await import('@/hooks/managers/database/server-logs')
        const { ServerLogAction } = await import('@/database/tables/cythro_dash_server_logs')
        await serverLogsOperations.log({
          server_id: db?.id || '',
          user_id: db?.user_id,
          action: (action === 'start' ? ServerLogAction.POWER_START : action === 'stop' ? ServerLogAction.POWER_STOP : action === 'restart' ? ServerLogAction.POWER_RESTART : ServerLogAction.POWER_KILL),
          message: `Power ${action} requested`,
          pterodactyl_identifier: db?.pterodactyl_identifier,
          pterodactyl_uuid: db?.pterodactyl_uuid,
          pterodactyl_server_id: db?.pterodactyl_server_id || undefined,
        })
      } catch {}

      return { success: true, message: `Action ${action} sent` }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  },
}

