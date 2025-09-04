/**
 * CythroDash - Get Current User API Route
 *
 * Simple endpoint to fetch current user data from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { userOperations } from '@/hooks/managers/database/user';

// Authentication function following your existing pattern
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

export async function GET(request: NextRequest) {
  try {
    // Validate user session using your existing pattern
    const sessionResult = await authenticateRequest(request);

    if (!sessionResult.success || !sessionResult.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'No user logged in'
        },
        { status: 401 }
      );
    }

    const userId = sessionResult.user.id;

    // Fetch fresh user data from database using the authenticated user's ID
    const user = await userOperations.getUserById(userId);

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    // Return user data
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        coins: user.coins || 0,
        avatar_url: user.avatar_url || null,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('💥 Get user data error:', error);

    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
