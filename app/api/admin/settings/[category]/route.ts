/**
 * Admin Settings - List by Category
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import AdminSettingsController from '@/hooks/managers/controller/Admin/SettingsController'

const paramsSchema = z.object({ category: z.enum(['general','oauth','features','security','appearance']) })

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

export async function GET(request: NextRequest, { params }: { params: { category: string } }) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  const parsed = paramsSchema.safeParse({ category: params.category })
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid category' }, { status: 400 })

  const items = await AdminSettingsController.listByCategory(parsed.data.category)
  return NextResponse.json({ success: true, items })
}

