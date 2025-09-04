/**
 * CythroDash - Discord Verification API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DiscordVerificationController } from '@/hooks/managers/controller/Social/DiscordVerification';
import { z } from 'zod';

// Rate limiting map (in production, use Redis)
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
        error: 'No session token found'
      };
    }

    // Validate session token format (should be hex string)
    const hexTokenRegex = /^[a-f0-9]{64}$/i; // 32 bytes = 64 hex characters
    if (!hexTokenRegex.test(sessionToken)) {
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
        console.log('User data header parsing failed:', parseError);
      }
    }

    return {
      success: false,
      error: 'User identification required'
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Input validation schema
const verifyDiscordSchema = z.object({
  action: z.enum(['verify', 'claim', 'recheck']),
  verification_id: z.string().optional(), // Required for claim and recheck
  guild_id: z.string().optional() // Required for verify
});

/**
 * POST /api/social/discord/verify
 * Handle Discord verification actions
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `discord_verify_${userId}_${clientIp}`;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxAttempts = 10;

    const current = rateLimitMap.get(rateLimitKey);
    if (current && current.resetTime > now) {
      if (current.count >= maxAttempts) {
        return NextResponse.json({
          success: false,
          message: 'Too many verification attempts. Please try again later.',
          error: 'RATE_LIMITED'
        }, { status: 429 });
      }
      current.count++;
    } else {
      rateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + windowMs });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = verifyDiscordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }, { status: 400 });
    }

    const { action, verification_id, guild_id } = validationResult.data;

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || 'unknown';

    switch (action) {
      case 'verify':
        if (!guild_id) {
          return NextResponse.json({
            success: false,
            message: 'Guild ID is required for verification',
            error: 'MISSING_GUILD_ID'
          }, { status: 400 });
        }

        // Get Discord connection data from database
        const { userOperations } = await import('@/hooks/managers/database/user');
        const discordConnection = await userOperations.getDiscordConnection(userId);

        if (!discordConnection) {
          return NextResponse.json({
            success: false,
            message: 'Discord account not connected. Please connect your Discord account first.',
            error: 'DISCORD_NOT_CONNECTED'
          }, { status: 400 });
        }

        console.log('Discord connection data:', {
          discord_user_id: discordConnection.id,
          discord_username: discordConnection.username,
          user_id: userId,
          guild_id
        });

        const verifyResult = await DiscordVerificationController.verifyServerMembership({
          user_id: userId,
          guild_id,
          ip_address: clientIp,
          user_agent: userAgent,
          discord_user_id: discordConnection.id,
          discord_username: discordConnection.username
        });

        return NextResponse.json(verifyResult, {
          status: verifyResult.success ? 200 : 400
        });

      case 'claim':
        if (!verification_id) {
          return NextResponse.json({
            success: false,
            message: 'Verification ID is required for claiming rewards',
            error: 'MISSING_VERIFICATION_ID'
          }, { status: 400 });
        }

        const claimResult = await DiscordVerificationController.claimDiscordReward(
          userId,
          verification_id
        );

        return NextResponse.json(claimResult, { 
          status: claimResult.success ? 200 : 400 
        });

      case 'recheck':
        if (!verification_id) {
          return NextResponse.json({
            success: false,
            message: 'Verification ID is required for rechecking',
            error: 'MISSING_VERIFICATION_ID'
          }, { status: 400 });
        }

        const recheckResult = await DiscordVerificationController.recheckMembership(
          verification_id
        );

        return NextResponse.json(recheckResult, { 
          status: recheckResult.success ? 200 : 400 
        });

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action',
          error: 'INVALID_ACTION'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Discord verification API error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/social/discord/verify
 * Get user's Discord verification status
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Get user's Discord verifications
    const { socialVerificationOperations } = await import('@/hooks/managers/database/social-verifications');
    const { SocialPlatform } = await import('@/database/tables/cythro_dash_social_verifications');
    
    const verifications = await socialVerificationOperations.getUserVerifications(userId);
    const discordVerifications = verifications.filter(v => v.platform === SocialPlatform.DISCORD);

    return NextResponse.json({
      success: true,
      message: 'Discord verification status retrieved successfully',
      data: {
        verifications: discordVerifications,
        stats: {
          total_discord_verifications: discordVerifications.length,
          verified_discord_count: discordVerifications.filter(v => v.status === 'verified').length,
          unclaimed_discord_rewards: discordVerifications
            .filter(v => v.status === 'verified' && !v.claimed)
            .reduce((sum, v) => sum + v.coins_reward, 0)
        }
      }
    });

  } catch (error) {
    console.error('Discord verification status API error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve Discord verification status',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
