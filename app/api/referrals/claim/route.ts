/**
 * CythroDash - Referral Claim Rewards API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReferralsController, ClaimRewardsRequest } from '@/hooks/managers/controller/User/Referrals';
import { z } from 'zod';

// Input validation schema
const claimRewardsSchema = z.object({
  claim_type: z.enum(['clicks', 'signups', 'all']).default('all')
});

// Simple authentication function for referrals API
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('session_token')?.value;

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

    // For now, we'll accept any valid session token and require user ID in query params
    const userId = request.nextUrl.searchParams.get('user_id');
    if (userId && !isNaN(parseInt(userId))) {
      return {
        success: true,
        user: { id: parseInt(userId) }
      };
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

// Rate limiting for claim attempts
const claimAttempts = new Map<string, { count: number; lastAttempt: number }>();

function checkClaimRateLimit(userId: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxAttempts = 5; // Max 5 claim attempts per minute per user

  const key = `user_${userId}`;
  const attempts = claimAttempts.get(key);
  
  if (!attempts) {
    claimAttempts.set(key, { count: 1, lastAttempt: now });
    return true;
  }

  // Reset if window has passed
  if (now - attempts.lastAttempt > windowMs) {
    claimAttempts.set(key, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if within limits
  if (attempts.count >= maxAttempts) {
    return false;
  }

  // Increment count
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

function resetClaimRateLimit(userId: number): void {
  claimAttempts.delete(`user_${userId}`);
}

export async function POST(request: NextRequest) {
  try {
    // Validate user session
    const sessionResult = await authenticateRequest(request);
    
    if (!sessionResult.success || !sessionResult.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    const userId = sessionResult.user.id;

    // Check rate limiting
    if (!checkClaimRateLimit(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many claim attempts. Please try again later.',
          error: 'RATE_LIMITED'
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const inputValidation = claimRewardsSchema.safeParse(body);

    if (!inputValidation.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid input data',
          errors: inputValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const { claim_type } = inputValidation.data;

    // Get client IP and user agent for logging
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Prepare claim request
    const claimRequest: ClaimRewardsRequest = {
      user_id: userId,
      claim_type,
      ip_address: ip,
      user_agent: userAgent
    };

    // Process the claim
    const result = await ReferralsController.claimReferralRewards(claimRequest);

    if (result.success) {
      // Reset rate limiting on successful claim
      resetClaimRateLimit(userId);

      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Failed to claim rewards',
          errors: result.errors || []
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Referral claim API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
