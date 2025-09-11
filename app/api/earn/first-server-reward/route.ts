import { NextRequest, NextResponse } from 'next/server'
import { rewardsLedgerOperations } from '@/hooks/managers/database/rewards-ledger'
import { userOperations } from '@/hooks/managers/database/user'
import serverOperations from '@/hooks/managers/database/servers'
import { SecurityLogsController } from '@/hooks/managers/controller/Security/Logs'
import { SecurityLogAction, SecurityLogSeverity, SecurityLogStatus } from '@/database/tables/cythro_dash_users_logs'

// Simple auth helper mirroring other user APIs
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) return { success: false, error: 'Authentication required' }

    const userDataHeader = request.headers.get('x-user-data')
    if (userDataHeader) {
      try {
        const user = JSON.parse(decodeURIComponent(userDataHeader))
        if (user && user.id && user.username && user.email) return { success: true, user }
      } catch {}
    }
    return { success: false, error: 'User data missing' }
  } catch (e) {
    return { success: false, error: 'Authentication failed' }
  }
}

const REWARD_AMOUNT = 50
const REFERENCE_ID = 'first_server_reward'

// GET /api/earn/first-server-reward -> status
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })
    }
    const userId = auth.user.id as number

    const count = await serverOperations.getServerCountByUser(userId)

    let claimed = false
    try {
      const { entries } = await rewardsLedgerOperations.query({ user_id: userId, source_category: 'promotion', page: 1, limit: 50 })
      claimed = entries.some(e => e.reference_id === REFERENCE_ID)
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Status retrieved',
      data: {
        has_server: count > 0,
        reward_claimed: claimed,
        can_claim: count > 0 && !claimed,
        reward_amount: REWARD_AMOUNT
      }
    })
  } catch (error) {
    console.error('first-server-reward GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// Idempotent reward for creating the first server.
// POST /api/earn/first-server-reward
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json({ success: false, message: auth.error || 'Unauthorized' }, { status: 401 })
    }
    const userId = auth.user.id as number

    // Verify user actually has at least one server (DB, not panel)
    const serversCount = await serverOperations.getServerCountByUser(userId)
    if (serversCount < 1) {
      return NextResponse.json({ success: false, message: 'No servers found for user' }, { status: 400 })
    }

    // Check ledger for prior grant (idempotent)
    try {
      const { entries } = await rewardsLedgerOperations.query({ user_id: userId, source_category: 'promotion', page: 1, limit: 50 })
      const already = entries.find(e => e.reference_id === REFERENCE_ID)
      if (already) {
        return NextResponse.json({ success: true, message: 'Reward already claimed', data: { coins_awarded: 0 } })
      }
    } catch {}

    // Award coins
    const beforeUser = await userOperations.getUserById(userId)
    const before = beforeUser?.coins ?? 0

    const update = await userOperations.updateUserCoins(userId, REWARD_AMOUNT, 'First Server Created Reward')
    if (!update) {
      return NextResponse.json({ success: false, message: 'Failed to award coins' }, { status: 500 })
    }

    // Record in rewards ledger (best-effort)
    try {
      await rewardsLedgerOperations.add({
        user_id: userId,
        delta: REWARD_AMOUNT,
        balance_before: before,
        balance_after: before + REWARD_AMOUNT,
        source_category: 'promotion',
        source_action: 'earn',
        reference_id: REFERENCE_ID,
        message: 'First Server Created Reward'
      })
    } catch {}

    // Log to security logs so it appears in user earning logs UI
    try {
      await SecurityLogsController.createLog({
        user_id: userId,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.LOW,
        description: `Task Reward: First Server (+${REWARD_AMOUNT} coins)`,
        details: { source_category: 'promotion', reference_id: REFERENCE_ID, amount: REWARD_AMOUNT },
      })
    } catch {}

    return NextResponse.json({ success: true, message: 'Reward granted', data: { coins_awarded: REWARD_AMOUNT } })
  } catch (error) {
    console.error('first-server-reward error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
