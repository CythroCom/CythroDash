/**
 * CythroDash - Admin Enable (Unban) User API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AdminDisableUserController } from '@/hooks/managers/controller/Admin/disableUser'

// Authentication helper (mirrors disable route pattern)
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
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData }
        }
      } catch {}
    }
    return { success: false, error: 'User identification required' }
  } catch (error) {
    console.error('Authentication error:', error)
    return { success: false, error: 'Authentication failed' }
  }
}

/**
 * POST /api/admin/users/[id]/enable
 * Unban/enable a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    }
    if (authResult.user.role !== 0) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 })
    }

    const result = await AdminDisableUserController.unbanUser(
      userId,
      authResult.user.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    )

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'User enabled successfully', user: result.user })
  } catch (error) {
    console.error('POST /api/admin/users/[id]/enable error:', error)
    return NextResponse.json({ success: false, message: 'An unexpected error occurred while enabling user' }, { status: 500 })
  }
}

