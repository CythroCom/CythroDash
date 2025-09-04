/**
 * CythroDash - User Referral Code API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { userOperations } from '@/hooks/managers/database/user';
import { UserHelpers } from '@/database/tables/cythro_dash_users';

// Simple authentication function
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

    // Get current user to check if they already have a referral code
    const currentUser = await userOperations.getUserById(userId);
    
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // If user already has a referral code, return it
    if (currentUser.referral_code) {
      return NextResponse.json({
        success: true,
        message: 'User already has a referral code',
        data: {
          referral_code: currentUser.referral_code
        }
      });
    }

    // Generate new referral code
    const referralCode = UserHelpers.generateReferralCode(currentUser.username);

    // Update user with new referral code
    const updatedUser = await userOperations.updateUser(userId, {
      referral_code: referralCode
    });

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to update user with referral code',
          error: 'UPDATE_FAILED'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code generated successfully',
      data: {
        referral_code: referralCode
      }
    });

  } catch (error) {
    console.error('Referral code generation API error:', error);
    
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

    // Get current user
    const currentUser = await userOperations.getUserById(userId);
    
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code retrieved successfully',
      data: {
        referral_code: currentUser.referral_code || null
      }
    });

  } catch (error) {
    console.error('Referral code retrieval API error:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
