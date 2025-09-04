/**
 * CythroDash - Admin Logs API
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AdminLogsController } from '@/hooks/managers/controller/Admin/LogsController'

// Auth (reuse admin pattern from other admin routes)
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
    // Optional cookie fallback used elsewhere
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
  limit: z.coerce.number().min(1).max(100).optional(),
  category: z.union([z.enum(['user','redeem','referral','rewards','transfer','server']), z.array(z.enum(['user','redeem','referral','rewards','transfer','server']))]).optional(),
  user_id: z.coerce.number().optional(),
  server_id: z.string().optional(),
  action: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
})

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

    const result = await AdminLogsController.getLogs(parsed.data, auth.user.id)
    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Unexpected error' }, { status: 500 })
  }
}

