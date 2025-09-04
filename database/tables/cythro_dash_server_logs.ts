/**
 * CythroDash - Server Management Logs Schema
 */

export enum ServerLogAction {
  CREATE = 'create',
  DELETE = 'delete',
  SUSPEND = 'suspend',
  UNSUSPEND = 'unsuspend',
  POWER_START = 'start',
  POWER_STOP = 'stop',
  POWER_RESTART = 'restart',
  POWER_KILL = 'kill'
}

export interface CythroDashServerLog {
  id: number
  server_id: string // CythroDash server id
  user_id?: number // actor
  action: ServerLogAction
  message?: string
  details?: any
  // Panel identifiers for correlation
  pterodactyl_identifier?: string
  pterodactyl_uuid?: string
  pterodactyl_server_id?: number
  created_at: Date
}

export const SERVER_LOGS_COLLECTION = 'cythro_dash_server_logs'

export const SERVER_LOGS_INDEXES = [
  { key: { server_id: 1, created_at: -1 }, name: 'server_time' },
  { key: { user_id: 1, created_at: -1 }, name: 'user_time' },
  { key: { action: 1, created_at: -1 }, name: 'action_time' },
  { key: { created_at: -1 }, name: 'created_desc' },
]

