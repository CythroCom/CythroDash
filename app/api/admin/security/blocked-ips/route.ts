/**
 * Admin: List Blocked IPs
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { IPBlockingController } from '@/hooks/managers/controller/Admin/IPBlockingController'

const schema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
})

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

  try {
    const url = new URL(request.url)
    const qp = Object.fromEntries(url.searchParams.entries())
    const parsed = schema.safeParse(qp)
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid query', errors: parsed.error.errors }, { status: 400 })

    const { items, total } = await IPBlockingController.listBlockedIPs(auth.user.id, parsed.data)
    return NextResponse.json({ success: true, items, total }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

