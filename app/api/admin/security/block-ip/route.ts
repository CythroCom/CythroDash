/**
 * Admin: Block IP
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { IPBlockingController } from '@/hooks/managers/controller/Admin/IPBlockingController'

const schema = z.object({
  ip_address: z.string().min(3),
  reason: z.string().min(3),
  expires_at: z.string().datetime().optional().nullable(),
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

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.errors }, { status: 400 })

    const result = await IPBlockingController.blockIP(auth.user.id, parsed.data)
    return NextResponse.json({ success: true, record: result.record }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

