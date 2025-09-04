/**
 * User Announcements - Visible list
 */

import { NextRequest, NextResponse } from 'next/server'
import announcementsOperations from '@/hooks/managers/database/announcements'

import { getPublicFlag } from '@/lib/public-settings'
async function featureEnabled() {
  // Server-side gate: DB-first with env fallback
  try {
    return await getPublicFlag('NEXT_PUBLIC_ANNOUNCEMENT', process.env.NEXT_PUBLIC_ANNOUNCEMENT === 'true')
  } catch { return String(process.env.NEXT_PUBLIC_ANNOUNCEMENT || 'false') === 'true' }
}

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

export async function GET(request: NextRequest) {
  if (!(await featureEnabled())) return NextResponse.json({ success: true, items: [] }, { status: 200 })
  const user = await getUser(request)
  const items = await announcementsOperations.getVisibleAnnouncements()
  // Include read status if user
  let reads: Record<number, boolean> = {}
  if (user?.id) {
    const flags: Record<number, boolean> = {}
    for (const a of items) {
      try { flags[a.id] = await announcementsOperations.getUserReadStatus(user.id, a.id) } catch { flags[a.id] = false }
    }
    reads = flags
  }
  return NextResponse.json({ success: true, items, reads }, { status: 200 })
}

