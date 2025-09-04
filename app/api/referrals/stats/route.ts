/**
 * CythroDash - Referral Statistics API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReferralsController } from '@/hooks/managers/controller/User/Referrals';

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

export async function GET(request: NextRequest) {
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

    // Get user referral statistics
    const result = await ReferralsController.getUserReferralStats(userId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Failed to retrieve referral statistics',
          errors: result.errors || []
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Referral stats API error:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
