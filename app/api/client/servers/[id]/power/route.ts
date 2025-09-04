import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ClientServerController } from '@/hooks/managers/controller/Client/Server'
import { serverOperations } from '@/hooks/managers/database/servers'

async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const authHeader = request.headers.get('authorization')
    const sessionToken = authHeader?.replace('Bearer ', '') || request.cookies.get('session_token')?.value
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
    // Fallback from cookie if set
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

const idSchema = z.string().min(1)
const powerSchema = z.object({ action: z.enum(['start','stop','restart','kill']) })

export async function POST(request: NextRequest, { params }: { params: any }) {
  const rawParams: any = params
  const resolvedParams = rawParams && typeof rawParams.then === 'function' ? await rawParams : rawParams
  const serverId = typeof resolvedParams?.id === 'string' ? decodeURIComponent(resolvedParams.id) : ''

  // Validate id
  const parsed = idSchema.safeParse(serverId)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'Invalid server id' }, { status: 400 })
  }

  // Auth
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) {
    return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })
  }

  // Validate body
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }
  const bodyParsed = powerSchema.safeParse(body)
  if (!bodyParsed.success) {
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
  const { action } = bodyParsed.data

  // Ownership check using CythroDash server id, then use pterodactyl identifier
  const user = auth.user
  const dbServer = await serverOperations.getServerById(serverId)
  if (!dbServer) {
    return NextResponse.json({ success: false, message: 'Server not found' }, { status: 404 })
  }
  if (user.role > 0 && dbServer.user_id !== user.id) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }
  const identifier = dbServer.pterodactyl_identifier || dbServer.pterodactyl_uuid || String(dbServer.pterodactyl_server_id || '')
  if (!identifier) {
    return NextResponse.json({ success: false, message: 'Pterodactyl identifier not set for this server' }, { status: 409 })
  }

  try {
    const result = await ClientServerController.executeServerAction(identifier, action)
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 502 })
    }
    return NextResponse.json({ success: true, message: `Action ${action} sent` })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Unexpected error' }, { status: 500 })
  }
}

