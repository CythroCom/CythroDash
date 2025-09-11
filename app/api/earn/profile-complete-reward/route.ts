/**
 * CythroDash - Profile Completion Reward API Route
 */

import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/hooks/managers/database/user'
import { UserDetailsController } from '@/hooks/managers/controller/User/Details'

async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('session_token')?.value
    if (!token) return { success: false, error: 'Authentication required' }
    const hdr = request.headers.get('x-user-data')
    if (hdr) {
      try {
        const user = JSON.parse(decodeURIComponent(hdr))
        if (user?.id && user?.username && user?.email) return { success: true, user }
      } catch {}
    }
    return { success: false, error: 'User data missing' }
  } catch {
    return { success: false, error: 'Authentication failed' }
  }
}

const REWARD_AMOUNT = 15
const REFERENCE_ID = 'profile_complete_reward'
const META_FLAG = 'profile_reward_claimed'

// GET -> status
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })

    const user = await userOperations.getUserById(auth.user.id)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const complete = !!(user.first_name && user.last_name)

    let claimed = false
    try {
      const details = await UserDetailsController.getUserDetails({ user_id: auth.user.id, include_activity: false, include_servers: false, include_stats: false })
      claimed = !!(details.user as any)?.[META_FLAG]
    } catch {}

    return NextResponse.json({ success: true, message: 'Status retrieved', data: { profile_complete: complete, reward_claimed: claimed, can_claim: complete && !claimed, reward_amount: REWARD_AMOUNT } })
  } catch (e) {
    console.error('profile-complete GET error', e)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// POST -> claim
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })

    const user = await userOperations.getUserById(auth.user.id)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const complete = !!(user.first_name && user.last_name)
    if (!complete) return NextResponse.json({ success: false, message: 'Profile is not complete' }, { status: 400 })

    // Already claimed?
    const details = await UserDetailsController.getUserDetails({ user_id: auth.user.id, include_activity: false, include_servers: false, include_stats: false })
    if ((details.user as any)?.[META_FLAG]) {
      return NextResponse.json({ success: false, message: 'Reward already claimed' }, { status: 400 })
    }

    const before = user.coins || 0
    const updated = await UserDetailsController.updateUserCoins(auth.user.id, REWARD_AMOUNT, 'Profile Completion Reward')
    if (!updated.success) return NextResponse.json({ success: false, message: 'Failed to award coins' }, { status: 500 })

    // Ledger + security log
    try {
      const { rewardsLedgerOperations } = await import('@/hooks/managers/database/rewards-ledger')
      await rewardsLedgerOperations.add({ user_id: auth.user.id, delta: REWARD_AMOUNT, balance_before: before, balance_after: before + REWARD_AMOUNT, source_category: 'promotion', source_action: 'earn', reference_id: REFERENCE_ID, message: 'Profile Completion Reward' })
    } catch {}
    try {
      const { SecurityLogsController } = await import('@/hooks/managers/controller/Security/Logs')
      const { SecurityLogAction, SecurityLogSeverity } = await import('@/database/tables/cythro_dash_users_logs')
      await SecurityLogsController.createLog({ user_id: auth.user.id, action: SecurityLogAction.ADMIN_ACTION_PERFORMED, severity: SecurityLogSeverity.LOW, description: `Task Reward: Profile Completion (+${REWARD_AMOUNT} coins)`, details: { source_category: 'promotion', reference_id: REFERENCE_ID, amount: REWARD_AMOUNT } })
    } catch {}

    await UserDetailsController.updateUserMetadata(auth.user.id, { [META_FLAG]: true, profile_reward_claimed_at: new Date() })

    return NextResponse.json({ success: true, message: 'Profile completion reward claimed', data: { coins_awarded: REWARD_AMOUNT } })
  } catch (e) {
    console.error('profile-complete POST error', e)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

