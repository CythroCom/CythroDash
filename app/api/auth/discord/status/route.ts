/**
 * CythroDash - Discord Connection Status API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
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
 * GET /api/auth/discord/status
 * Check Discord connection status from database
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

    // Get Discord connection from database
    const { userOperations } = await import('@/hooks/managers/database/user');
    const discordConnection = await userOperations.getDiscordConnection(userId);

    if (!discordConnection) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'Discord not connected'
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      discord_user: {
        id: discordConnection.id,
        username: discordConnection.username,
        discriminator: discordConnection.discriminator,
        avatar: discordConnection.avatar,
        connected_at: discordConnection.connected_at
      },
      message: 'Discord connected successfully'
    });

  } catch (error) {
    console.error('Discord status check error:', error);

    return NextResponse.json({
      success: false,
      message: 'Failed to check Discord connection status',
      error: 'STATUS_CHECK_ERROR'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/discord/status
 * Disconnect Discord account from database
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

    // Disconnect Discord from database
    const { userOperations } = await import('@/hooks/managers/database/user');
    const success = await userOperations.disconnectDiscord(userId);

    if (!success) {
      return NextResponse.json({
        success: false,
        message: 'Failed to disconnect Discord account'
      }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Discord disconnected successfully'
    });

    // Clear any existing Discord connection cookie
    response.cookies.set('discord_connection', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('Discord disconnect error:', error);

    return NextResponse.json({
      success: false,
      message: 'Failed to disconnect Discord',
      error: 'DISCONNECT_ERROR'
    }, { status: 500 });
  }
}
