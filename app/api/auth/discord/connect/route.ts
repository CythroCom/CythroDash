/**
 * CythroDash - Discord Connection Completion API
 * 
 * This endpoint completes the Discord connection process by saving
 * the pending Discord data to the user's database record.
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
 * POST /api/auth/discord/connect
 * Complete Discord connection by saving pending data to database
 */
export async function POST(request: NextRequest) {
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

    // Get pending Discord connection data from cookie
    const pendingConnection = request.cookies.get('discord_pending_connection')?.value;
    
    if (!pendingConnection) {
      return NextResponse.json({
        success: false,
        message: 'No pending Discord connection found. Please start the connection process again.',
        error: 'NO_PENDING_CONNECTION'
      }, { status: 400 });
    }

    let discordData;
    try {
      discordData = JSON.parse(pendingConnection);
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: 'Invalid pending connection data. Please start the connection process again.',
        error: 'INVALID_PENDING_DATA'
      }, { status: 400 });
    }

    // Save Discord connection to database
    const { userOperations } = await import('@/hooks/managers/database/user');
    
    const connectionData = {
      id: discordData.id,
      username: discordData.username,
      discriminator: discordData.discriminator,
      avatar: discordData.avatar
    };

    await userOperations.connectDiscord(userId, connectionData);

    const response = NextResponse.json({
      success: true,
      message: 'Discord account connected successfully',
      discord_user: {
        id: discordData.id,
        username: discordData.username,
        discriminator: discordData.discriminator,
        avatar: discordData.avatar,
        connected_at: new Date().toISOString()
      },
      auto_join_result: discordData.auto_join_result || null
    });

    // Clear the pending connection cookie
    response.cookies.set('discord_pending_connection', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('Discord connection completion error:', error);
    
    if (error instanceof Error && error.message.includes('already connected')) {
      return NextResponse.json({
        success: false,
        message: 'This Discord account is already connected to another user.',
        error: 'DISCORD_ALREADY_CONNECTED'
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Failed to complete Discord connection',
      error: 'CONNECTION_FAILED'
    }, { status: 500 });
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
