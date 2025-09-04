/**
 * CythroDash - GitHub Connection Status API
 * 
 * Check and manage GitHub connection status from database
 */

import { NextRequest, NextResponse } from 'next/server';

// Authentication function
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return {
        success: false,
        error: 'No session token found'
      };
    }

    // Get user data from headers (sent by client)
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

/**
 * GET /api/auth/github/status
 * Check GitHub connection status from database
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Get GitHub connection from database
    const { userOperations } = await import('@/hooks/managers/database/user');
    const githubConnection = await userOperations.getGitHubConnection(userId);
    
    if (!githubConnection) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'GitHub not connected'
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      github_user: {
        id: githubConnection.id,
        login: githubConnection.login,
        name: githubConnection.name,
        avatar_url: githubConnection.avatar_url,
        connected_at: githubConnection.connected_at
      },
      message: 'GitHub connected successfully'
    });

  } catch (error) {
    console.error('GitHub status check error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to check GitHub connection status',
      error: 'STATUS_CHECK_ERROR'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/github/status
 * Disconnect GitHub account from database
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Disconnect GitHub from database
    const { userOperations } = await import('@/hooks/managers/database/user');
    const success = await userOperations.disconnectGitHub(userId);

    if (!success) {
      return NextResponse.json({
        success: false,
        message: 'Failed to disconnect GitHub account'
      }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'GitHub disconnected successfully'
    });

    // Clear any existing GitHub connection cookie
    response.cookies.set('github_pending_connection', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('GitHub disconnect error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to disconnect GitHub',
      error: 'DISCONNECT_ERROR'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
