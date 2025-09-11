/**
 * CythroDash - GitHub Connection Reward API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserDetailsController } from '@/hooks/managers/controller/User/Details';

import { userOperations } from '@/hooks/managers/database/user'

// Input validation schema
const claimRewardSchema = z.object({
  action: z.literal('claim')
});

// Rate limiting map (in production, use Redis or database)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Authentication function following the established pattern
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Get session token from cookies or Authorization header
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') ||
                        request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Basic session token validation
    if (typeof sessionToken !== 'string' || sessionToken.length < 10) {
      return {
        success: false,
        error: 'Invalid session token format'
      };
    }

    // Get user information from request headers (sent by client)
    const userDataHeader = request.headers.get('x-user-data');
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));

        if (userData && userData.id && userData.username && userData.email) {
          return {
            success: true,
            user: userData
          };
        }
      } catch (parseError) {
        console.error('Error parsing user data header:', parseError);
      }
    }

    return {
      success: false,
      error: 'User data not found in request headers'
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Rate limiting function
function checkRateLimit(userId: number): boolean {
  const key = `github-reward-${userId}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const maxRequests = 3; // Max 3 attempts per hour

  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

// Check if user has GitHub connected (simplified check)
async function checkGitHubConnection(user: any): Promise<boolean> {
  try {
    // Source of truth: OAuth connections table via userOperations
    const conn = await userOperations.getGitHubConnection(user.id)
    return !!conn
  } catch (error) {
    console.error('Error checking GitHub connection:', error)
    return false
  }
}

// Check if user has already claimed GitHub reward
async function hasClaimedGitHubReward(userId: number): Promise<boolean> {
  try {
    const user = await userOperations.getUserById(userId)
    return !!(user as any)?.github_reward_claimed
  } catch (error) {
    console.error('Error checking GitHub reward status:', error)
    return false
  }
}

// Mark GitHub reward as claimed
async function markGitHubRewardClaimed(userId: number): Promise<boolean> {
  try {
    // Mark the GitHub reward as claimed in the user record
    // This is a simplified implementation

    const updateResult = await UserDetailsController.updateUserMetadata(
      userId,
      { github_reward_claimed: true, github_reward_claimed_at: new Date() }
    );

    return updateResult.success;

  } catch (error) {
    console.error('Error marking GitHub reward as claimed:', error);
    return false;
  }
}

/**
 * Claim GitHub connection reward
 * POST /api/auth/github/reward
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const user = authResult.user!;

    // Parse and validate request body
    const body = await request.json();
    const validation = claimRewardSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    // Check rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.'
      }, { status: 429 });
    }

    // Check if user has GitHub connected
    const hasGitHubConnection = await checkGitHubConnection(user);
    if (!hasGitHubConnection) {
      return NextResponse.json({
        success: false,
        message: 'GitHub account not connected. Please connect your GitHub account in Settings first.'
      }, { status: 400 });
    }

    // Check if user has already claimed the reward
    const alreadyClaimed = await hasClaimedGitHubReward(user.id);
    if (alreadyClaimed) {
      return NextResponse.json({
        success: false,
        message: 'GitHub connection reward has already been claimed.'
      }, { status: 400 });
    }

    // Award coins for GitHub connection
    const rewardAmount = 40; // GitHub connection reward

    try {
      const beforeUser = await userOperations.getUserById(user.id)
      const before = beforeUser?.coins ?? 0

      const updateResult = await UserDetailsController.updateUserCoins(
        user.id,
        rewardAmount,
        'GitHub Account Connection Reward'
      );

      if (!updateResult.success) {
        console.error('Failed to update user coins:', updateResult.message);
        return NextResponse.json({
          success: false,
          message: 'Failed to award coins. Please try again.'
        }, { status: 500 });
      }

      // Rewards ledger entry (best-effort)
      try {
        const { rewardsLedgerOperations } = await import('@/hooks/managers/database/rewards-ledger')
        await rewardsLedgerOperations.add({
          user_id: user.id,
          delta: rewardAmount,
          balance_before: before,
          balance_after: before + rewardAmount,
          source_category: 'promotion',
          source_action: 'earn',
          reference_id: 'github_connection_reward',
          message: 'GitHub Account Connection Reward'
        })
      } catch {}

      // Security log entry for earning logs UI
      try {
        const { SecurityLogsController } = await import('@/hooks/managers/controller/Security/Logs')
        const { SecurityLogAction, SecurityLogSeverity } = await import('@/database/tables/cythro_dash_users_logs')
        await SecurityLogsController.createLog({
          user_id: user.id,
          action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
          severity: SecurityLogSeverity.LOW,
          description: `Task Reward: GitHub Connection (+${rewardAmount} coins)`,
          details: { source_category: 'promotion', reference_id: 'github_connection_reward', amount: rewardAmount },
        })
      } catch {}

      // Mark reward as claimed
      const markResult = await markGitHubRewardClaimed(user.id);
      if (!markResult) {
        console.error('Failed to mark GitHub reward as claimed for user:', user.id);
        // Note: Coins were awarded but marking failed
        // In production, you might want to implement compensation logic
      }

      return NextResponse.json({
        success: true,
        message: 'GitHub connection reward claimed successfully!',
        data: {
          coins_awarded: rewardAmount,
          claimed_at: new Date()
        }
      });

    } catch (error) {
      console.error('Error awarding GitHub reward:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to process reward. Please try again.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in GitHub reward API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Check GitHub connection and reward status
 * GET /api/auth/github/reward
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const user = authResult.user!;

    // Check GitHub connection status
    const hasGitHubConnection = await checkGitHubConnection(user);
    const alreadyClaimed = await hasClaimedGitHubReward(user.id);

    return NextResponse.json({
      success: true,
      message: 'GitHub reward status retrieved',
      data: {
        github_connected: hasGitHubConnection,
        reward_claimed: alreadyClaimed,
        can_claim: hasGitHubConnection && !alreadyClaimed,
        reward_amount: 40
      }
    });

  } catch (error) {
    console.error('Error in GitHub reward status API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
