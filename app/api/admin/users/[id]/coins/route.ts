/**
 * CythroDash - Admin Adjust User Coins API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userOperations } from '@/hooks/managers/database/user'
import { rewardsLedgerOperations } from '@/hooks/managers/database/rewards-ledger'

const adjustSchema = z.object({
  amount: z.number().int().refine(v => v !== 0, 'Amount cannot be zero').refine(v => Math.abs(v) <= 1_000_000, 'Amount too large'),
  reason: z.string().min(3).max(200),
})

const listSchema = z.object({ page: z.coerce.number().min(1).default(1), limit: z.coerce.number().min(1).max(100).default(50) })

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
 * GET /api/admin/users/[id]/coins?page=&limit=
 * Returns rewards ledger entries for the user
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const parsed = listSchema.safeParse({ page: searchParams.get('page') || '1', limit: searchParams.get('limit') || '50' })
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid query', errors: parsed.error.errors }, { status: 400 })

    const userId = parseInt((await params).id)
    if (isNaN(userId)) return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 })

    const { entries, total } = await rewardsLedgerOperations.query({ user_id: userId, page: parsed.data.page, limit: parsed.data.limit })
    return NextResponse.json({ success: true, entries, total, page: parsed.data.page, limit: parsed.data.limit })
  } catch (error) {
    console.error('GET /api/admin/users/[id]/coins error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/users/[id]/coins
 * Body: { amount: number (positive to add, negative to subtract), reason: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

    const body = await request.json()
    const parsed = adjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid input', errors: parsed.error.errors }, { status: 400 })
    }

    const { amount, reason } = parsed.data
    const { id: adminId } = auth.user
    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 })
    if (userId === adminId && amount < 0) return NextResponse.json({ success: false, message: 'Cannot subtract coins from your own account' }, { status: 400 })

    const user = await userOperations.getUserById(userId)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    // Pre-calc balances for ledger
    const balance_before = user.coins
    const balance_after = user.coins + amount
    if (balance_after < 0) return NextResponse.json({ success: false, message: 'Insufficient coins' }, { status: 400 })

    // Update balance
    const ok = await userOperations.updateUserCoins(userId, amount, `Admin: ${reason}`)
    if (!ok) return NextResponse.json({ success: false, message: 'Failed to adjust coins' }, { status: 500 })

    // Rewards ledger entry (best-effort)
    try {
      await rewardsLedgerOperations.add({
        user_id: userId,
        delta: amount,
        balance_before,
        balance_after,
        source_category: 'admin_adjustment',
        source_action: 'adjust',
        reference_id: `admin:${adminId}`,
        message: reason,
      })
    } catch {}

    return NextResponse.json({ success: true, message: 'Coins adjusted', data: { user_id: userId, amount, balance_before, balance_after } })
  } catch (error) {
    console.error('POST /api/admin/users/[id]/coins error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

