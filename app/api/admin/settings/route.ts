/**
 * Admin Settings - List/Update
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import AdminSettingsController from '@/hooks/managers/controller/Admin/SettingsController'

const listSchema = z.object({})
const updateSchema = z.object({ key: z.string().min(1), value: z.any() })

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

  const items = await AdminSettingsController.listAll()
  return NextResponse.json({ success: true, items })
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.errors }, { status: 400 })

  const ok = await AdminSettingsController.update(parsed.data.key, parsed.data.value, auth.user.id)
  return NextResponse.json({ success: ok })
}

