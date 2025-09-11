/**
 * CythroDash - Admin Security Logs API
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userLogsOperations } from '@/hooks/managers/database/user-logs'
import { SecurityLogAction, SecurityLogSeverity, SecurityLogStatus } from '@/database/tables/cythro_dash_users_logs'

// Reuse auth pattern from other admin routes
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) return { success: false, error: 'No session token found' }

    const userDataHeader = request.headers.get('x-user-data')
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader))
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData }
        }
      } catch {}
    }
    const userDataCookie = request.cookies.get('x_user_data')?.value
    if (userDataCookie) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataCookie))
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData }
        }
      } catch {}
    }
    return { success: false, error: 'User identification required' }
  } catch (e) {
    return { success: false, error: 'Authentication failed' }
  }
}

const querySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  user_id: z.coerce.number().optional(),
  action: z.union([z.nativeEnum(SecurityLogAction), z.array(z.nativeEnum(SecurityLogAction)), z.string()]).optional(),
  severity: z.union([z.nativeEnum(SecurityLogSeverity), z.array(z.nativeEnum(SecurityLogSeverity)), z.string()]).optional(),
  status: z.union([z.nativeEnum(SecurityLogStatus), z.array(z.nativeEnum(SecurityLogStatus)), z.string()]).optional(),
  ip_address: z.string().optional(),
  is_suspicious: z.coerce.boolean().optional(),
  requires_attention: z.coerce.boolean().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sort_by: z.enum(['created_at','severity','action']).optional(),
  sort_order: z.enum(['asc','desc']).optional(),
})

function parseMaybeList<T extends string>(v: unknown, allowed: Set<string>): T | T[] | undefined {
  if (typeof v === 'string') {
    if (v.includes(',')) {
      return v.split(',').map(s => s.trim()).filter(s => allowed.has(s)) as T[]
    }
    return allowed.has(v) ? (v as T) : undefined
  }
  if (Array.isArray(v)) {
    return v.map(x => String(x)).filter(s => allowed.has(s)) as T[]
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    }
    if (auth.user.role !== 0) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    const url = new URL(request.url)
    const qp = Object.fromEntries(url.searchParams.entries())
    const parsed = querySchema.safeParse(qp)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid query params', errors: parsed.error.errors }, { status: 400 })
    }

    const { page = 1, limit = 50 } = parsed.data

    // Build query mapping to userLogsOperations.queryLogs
    const allowedActions = new Set<string>(Object.values(SecurityLogAction))
    const allowedSeverities = new Set<string>(Object.values(SecurityLogSeverity))
    const allowedStatuses = new Set<string>(Object.values(SecurityLogStatus))

    const action = parseMaybeList(parsed.data.action, allowedActions)
    const severity = parseMaybeList(parsed.data.severity, allowedSeverities)
    const status = parseMaybeList(parsed.data.status, allowedStatuses)

    const date_from = parsed.data.date_from ? new Date(parsed.data.date_from) : undefined
    const date_to = parsed.data.date_to ? new Date(parsed.data.date_to) : undefined

    const logs = await userLogsOperations.queryLogs({
      user_id: parsed.data.user_id,
      action: action as any,
      severity: severity as any,
      status: status as any,
      ip_address: parsed.data.ip_address,
      is_suspicious: parsed.data.is_suspicious,
      requires_attention: parsed.data.requires_attention,
      date_from,
      date_to,
      sort_by: parsed.data.sort_by || 'created_at',
      sort_order: parsed.data.sort_order || 'desc',
      limit,
      offset: (page - 1) * limit,
    })

    return NextResponse.json({ success: true, logs, pagination: { page, per_page: limit, count: logs.length } })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Unexpected error' }, { status: 500 })
  }
}

