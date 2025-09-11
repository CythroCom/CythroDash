/**
 * CythroDash - Admin Force Password Reset API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/hooks/managers/database/user'

async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) return { success: false, error: 'No session token found' }
    const hexTokenRegex = /^[a-f0-9]{64}$/i
    if (!hexTokenRegex.test(sessionToken)) return { success: false, error: 'Invalid session token format' }
    const userDataHeader = request.headers.get('x-user-data')
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader))
        if (userData && userData.id && userData.username && userData.email) return { success: true, user: userData }
      } catch {}
    }
    return { success: false, error: 'User identification required' }
  } catch (e) {
    return { success: false, error: 'Authentication failed' }
  }
}

/**
 * POST /api/admin/users/[id]/force-password-reset
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 })

    const user = await userOperations.getUserById(userId)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    await userOperations.setPasswordResetToken(userId)

    return NextResponse.json({ success: true, message: 'Password reset required for user' })
  } catch (error) {
    console.error('POST /api/admin/users/[id]/force-password-reset error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

