/**
 * CythroDash - Discord Connection Reward API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { UserDetailsController } from '@/hooks/managers/controller/User/Details'
import { userOperations } from '@/hooks/managers/database/user'

// Input validation schema
const claimSchema = z.object({ action: z.literal('claim') })

// Auth helper (same pattern as others)
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const authHeader = request.headers.get('authorization')
    const sessionToken = authHeader?.replace('Bearer ', '') || request.cookies.get('session_token')?.value
    if (!sessionToken) return { success: false, error: 'Authentication required' }

    const userDataHeader = request.headers.get('x-user-data')
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader))
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData }
        }
      } catch {}
    }
    return { success: false, error: 'User data missing' }
  } catch (e) {
    return { success: false, error: 'Authentication failed' }
  }
}

const REWARD_AMOUNT = 25
const META_FLAG = 'discord_reward_claimed'

// GET /api/auth/discord/reward -> status
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const user = await userOperations.getUserById(auth.user.id)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    // Check connection
    const discordConn = await userOperations.getDiscordConnection(auth.user.id)
    const connected = !!discordConn

    // Claimed flag (stored in metadata fields on user)
    // We read it via UserDetailsController to keep consistency with existing GitHub reward code
    // Read claimed flag directly from user record; getUserDetails omits metadata
    const userFull = await userOperations.getUserById(auth.user.id)
    const claimed = !!(userFull as any)?.[META_FLAG]

    return NextResponse.json({
      success: true,
      message: 'Discord reward status retrieved',
      data: {
        discord_connected: connected,
        reward_claimed: claimed,
        can_claim: connected && !claimed,
        reward_amount: REWARD_AMOUNT
      }
    })
  } catch (error) {
    console.error('Discord reward GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/auth/discord/reward -> claim
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const val = claimSchema.safeParse(body)
    if (!val.success) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
    }

    const user = await userOperations.getUserById(auth.user.id)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const discordConn = await userOperations.getDiscordConnection(auth.user.id)
    if (!discordConn) {
      return NextResponse.json({ success: false, message: 'Discord account not connected' }, { status: 400 })
    }

    // Already claimed?
    const userFull = await userOperations.getUserById(auth.user.id)
    if ((userFull as any)?.[META_FLAG]) {
      return NextResponse.json({ success: false, message: 'Reward already claimed' }, { status: 400 })
    }

    // Award coins
    const before = user.coins || 0
    const updated = await UserDetailsController.updateUserCoins(auth.user.id, REWARD_AMOUNT, 'Discord Account Connection Reward')
    if (!updated.success) {
      return NextResponse.json({ success: false, message: 'Failed to award coins' }, { status: 500 })
    }

    // Ledger + security log (best-effort)
    try {
      const { rewardsLedgerOperations } = await import('@/hooks/managers/database/rewards-ledger')
      await rewardsLedgerOperations.add({
        user_id: auth.user.id,
        delta: REWARD_AMOUNT,
        balance_before: before,
        balance_after: before + REWARD_AMOUNT,
        source_category: 'promotion',
        source_action: 'earn',
        reference_id: 'discord_connection_reward',
        message: 'Discord Account Connection Reward'
      })
    } catch {}
    try {
      const { SecurityLogsController } = await import('@/hooks/managers/controller/Security/Logs')
      const { SecurityLogAction, SecurityLogSeverity } = await import('@/database/tables/cythro_dash_users_logs')
      await SecurityLogsController.createLog({
        user_id: auth.user.id,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.LOW,
        description: `Task Reward: Discord Connection (+${REWARD_AMOUNT} coins)`,
        details: { source_category: 'promotion', reference_id: 'discord_connection_reward', amount: REWARD_AMOUNT },
      })
    } catch {}

    // Mark metadata claimed
    await UserDetailsController.updateUserMetadata(auth.user.id, { [META_FLAG]: true, discord_reward_claimed_at: new Date() })

    return NextResponse.json({ success: true, message: 'Discord connection reward claimed', data: { coins_awarded: REWARD_AMOUNT } })
  } catch (error) {
    console.error('Discord reward POST error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

