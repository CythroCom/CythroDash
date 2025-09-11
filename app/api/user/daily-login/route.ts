/**
 * CythroDash - Daily Login Bonus API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DailyLoginController } from '@/hooks/managers/database/daily-logins';
import { UserDetailsController } from '@/hooks/managers/controller/User/Details';

// Input validation schemas
const claimBonusSchema = z.object({
  action: z.literal('claim')
});

const checkStatusSchema = z.object({
  action: z.literal('check')
});

const getHistorySchema = z.object({
  action: z.literal('history'),
  limit: z.number().min(1).max(100).optional().default(30),
  offset: z.number().min(0).optional().default(0)
});

const requestSchema = z.discriminatedUnion('action', [
  claimBonusSchema,
  checkStatusSchema,
  getHistorySchema
]);

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
function checkRateLimit(userId: number, action: string): boolean {
  const key = `${userId}-${action}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = action === 'claim' ? 5 : 20; // Stricter limit for claims

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

// Get environment configuration (DB-first with env fallback)
import { getPublicFlag, getPublicNumber } from '@/lib/public-settings'
async function getDailyLoginConfig() {
  const enabled = await getPublicFlag('NEXT_PUBLIC_DAILY_LOGIN_BONUS', process.env.NEXT_PUBLIC_DAILY_LOGIN_BONUS === 'true');
  const amount = await getPublicNumber('NEXT_PUBLIC_DAILY_LOGIN_BONUS_AMOUNT', Number(process.env.NEXT_PUBLIC_DAILY_LOGIN_BONUS_AMOUNT || '10'));

  return {
    enabled,
    amount: isNaN(Number(amount)) ? 10 : Math.max(1, Math.min(Number(amount), 1000)) // Clamp between 1-1000
  };
}

/**
 * Handle daily login bonus requests
 * POST /api/user/daily-login
 */
export async function POST(request: NextRequest) {
  try {
    // Check if daily login bonus is enabled
    const config = await getDailyLoginConfig();
    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        message: 'Daily login bonus is currently disabled'
      }, { status: 503 });
    }

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
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { action } = validation.data;

    // Check rate limiting
    if (!checkRateLimit(user.id, action)) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.'
      }, { status: 429 });
    }

    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    switch (action) {
      case 'check': {
        // Check today's login status
        const result = await DailyLoginController.checkTodayLogin(user.id);
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: result.message
          }, { status: 500 });
        }

        // If no login today, record it
        if (!result.data.hasLoggedIn) {
          const recordResult = await DailyLoginController.recordDailyLogin(
            user.id,
            config.amount,
            clientIP,
            userAgent
          );

          if (recordResult.success) {
            // Return updated status
            const updatedResult = await DailyLoginController.checkTodayLogin(user.id);
            return NextResponse.json({
              success: true,
              message: 'Daily login recorded',
              data: updatedResult.data
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Daily login status retrieved',
          data: result.data
        });
      }

      case 'claim': {
        // Claim daily login bonus
        const claimResult = await DailyLoginController.claimDailyBonus(user.id);
        
        if (!claimResult.success) {
          return NextResponse.json({
            success: false,
            message: claimResult.message
          }, { status: 400 });
        }

        // Update user's coin balance
        try {
          const updateResult = await UserDetailsController.updateUserCoins( 
            user.id,
            claimResult.data.coins_awarded,
            'Daily Login Bonus'
          );

          if (!updateResult.success) {
            console.error('Failed to update user coins:', updateResult.message);
            // Note: The claim was successful, but coin update failed
            // In production, you might want to implement compensation logic
          }
        } catch (error) {
          console.error('Error updating user coins:', error);
        }

        return NextResponse.json({
          success: true,
          message: 'Daily login bonus claimed successfully',
          data: {
            coins_awarded: claimResult.data.coins_awarded,
            claimed_at: claimResult.data.claimed_at
          }
        });
      }

      case 'history': {
        // Get daily login history
        const { limit, offset } = validation.data;
        const historyResult = await DailyLoginController.getDailyLoginHistory(
          user.id,
          limit,
          offset
        );

        if (!historyResult.success) {
          return NextResponse.json({
            success: false,
            message: historyResult.message
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Daily login history retrieved',
          data: historyResult.data
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in daily login API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Get daily login statistics
 * GET /api/user/daily-login
 */
export async function GET(request: NextRequest) {
  try {
    // Check if daily login bonus is enabled
    const config = await getDailyLoginConfig();
    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        message: 'Daily login bonus is currently disabled'
      }, { status: 503 });
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const user = authResult.user!;

    // Check rate limiting
    if (!checkRateLimit(user.id, 'stats')) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.'
      }, { status: 429 });
    }

    // Get user's daily login statistics
    const statsResult = await DailyLoginController.getDailyLoginStats(user.id);

    if (!statsResult.success) {
      return NextResponse.json({
        success: false,
        message: statsResult.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Daily login statistics retrieved',
      data: statsResult.data
    });

  } catch (error) {
    console.error('Error in daily login stats API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
