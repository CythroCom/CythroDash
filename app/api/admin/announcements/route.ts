/**
 * Admin Announcements - List/Create
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import announcementsOperations from '@/hooks/managers/database/announcements'
import { SecurityLogsController } from '@/hooks/managers/controller/Security/Logs'
import { SecurityLogAction, SecurityLogSeverity } from '@/database/tables/cythro_dash_users_logs'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  is_visible: z.boolean().optional(),
  priority: z.coerce.number().optional(),
})

const listSchema = z.object({ page: z.coerce.number().min(1).optional(), limit: z.coerce.number().min(1).max(100).optional(), search: z.string().optional() })

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

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  const url = new URL(request.url)
  const qp = Object.fromEntries(url.searchParams.entries())
  const parsed = listSchema.safeParse(qp)
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid query', errors: parsed.error.errors }, { status: 400 })

  const { items, total, page, limit } = await announcementsOperations.getAnnouncements(parsed.data)
  return NextResponse.json({ success: true, items, total, page, limit }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.errors }, { status: 400 })

    const doc = await announcementsOperations.createAnnouncement({ ...parsed.data, created_by_admin_id: auth.user.id })
    try {
      await SecurityLogsController.createLog({ user_id: auth.user.id, action: SecurityLogAction.ADMIN_ACTION_PERFORMED, severity: SecurityLogSeverity.LOW, description: `Created announcement ${doc.title}`, details: { id: doc.id } })
    } catch {}
    return NextResponse.json({ success: true, item: doc }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

