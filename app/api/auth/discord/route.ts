/**
 * CythroDash - Discord OAuth API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';

// Discord OAuth configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_URL}/api/auth/discord/callback`;

/**
 * GET /api/auth/discord
 * Redirect to Discord OAuth authorization
 */
export async function GET(request: NextRequest) {
  try {
    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json({
        success: false,
        message: 'Discord OAuth not configured. Please set DISCORD_CLIENT_ID in environment variables.',
        error: 'DISCORD_NOT_CONFIGURED'
      }, { status: 500 });
    }

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store state in session/cookie for verification (simplified approach)
    const response = NextResponse.redirect(
      `https://discord.com/api/oauth2/authorize?` +
      `client_id=${DISCORD_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=identify%20guilds%20guilds.join&` +
      `state=${state}`
    );

    // Set state cookie for verification
    response.cookies.set('discord_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });

    return response;

  } catch (error) {
    console.error('Discord OAuth initiation error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to initiate Discord OAuth',
      error: 'OAUTH_INIT_ERROR'
    }, { status: 500 });
  }
}
