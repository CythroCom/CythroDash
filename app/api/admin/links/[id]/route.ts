/**
 * Admin Short Links - Update/Delete by ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import shortLinksOperations from '@/hooks/managers/database/short-links'
import { SecurityLogsController } from '@/hooks/managers/controller/Security/Logs'
import { SecurityLogAction, SecurityLogSeverity } from '@/database/tables/cythro_dash_users_logs'

const idParam = z.object({ id: z.coerce.number().min(1) })
const updateSchema = z.object({
  slug: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  target_url: z.string().url().optional(),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  const parsedId = idParam.safeParse({ id: params.id })
  if (!parsedId.success) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.errors }, { status: 400 })

    const updated = await shortLinksOperations.updateLink(parsedId.data.id, parsed.data)
    try {
      await SecurityLogsController.createLog({ user_id: auth.user.id, action: SecurityLogAction.ADMIN_ACTION_PERFORMED, severity: SecurityLogSeverity.LOW, description: `Updated short link ${updated?.slug}`, details: { id: updated?.id, slug: updated?.slug } })
    } catch {}
    return NextResponse.json({ success: true, item: updated }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  const parsedId = idParam.safeParse({ id: params.id })
  if (!parsedId.success) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 })

  try {
    const ok = await shortLinksOperations.deleteLink(parsedId.data.id)
    try {
      await SecurityLogsController.createLog({ user_id: auth.user.id, action: SecurityLogAction.ADMIN_ACTION_PERFORMED, severity: SecurityLogSeverity.LOW, description: `Deleted short link id=${parsedId.data.id}`, details: { id: parsedId.data.id } })
    } catch {}
    return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

