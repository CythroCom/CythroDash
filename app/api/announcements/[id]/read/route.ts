/**
 * User Announcements - mark as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import announcementsOperations from '@/hooks/managers/database/announcements'

import { getPublicFlag } from '@/lib/public-settings'
async function featureEnabled() {
  try { return await getPublicFlag('NEXT_PUBLIC_ANNOUNCEMENT', process.env.NEXT_PUBLIC_ANNOUNCEMENT === 'true') }
  catch { return String(process.env.NEXT_PUBLIC_ANNOUNCEMENT || 'false') === 'true' }
}

const idParam = z.object({ id: z.coerce.number().min(1) })

async function getUser(request: NextRequest) {
  const userDataHeader = request.headers.get('x-user-data')
  if (userDataHeader) {
    try { return JSON.parse(decodeURIComponent(userDataHeader)) } catch {}
  }
  const userDataCookie = request.cookies.get('x_user_data')?.value
  if (userDataCookie) {
    try { return JSON.parse(decodeURIComponent(userDataCookie)) } catch {}
  }
  return null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await featureEnabled())) return NextResponse.json({ success: false, message: 'Announcements disabled' }, { status: 404 })
  const user = await getUser(request)
  if (!user?.id) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })

  const parsedId = idParam.safeParse({ id: params.id })
  if (!parsedId.success) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 })

  await announcementsOperations.markAnnouncementAsRead(user.id, parsedId.data.id)
  return NextResponse.json({ success: true })
}

