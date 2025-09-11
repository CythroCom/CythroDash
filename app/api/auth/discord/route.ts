/**
 * CythroDash - Discord OAuth API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';

// Discord OAuth configuration will be resolved at request time from DB config with env fallback

/**
 * GET /api/auth/discord
 * Redirect to Discord OAuth authorization
 */
export async function GET(request: NextRequest) {
  try {
    const { getConfig } = await import('@/database/config-manager.js')
    const DISCORD_CLIENT_ID = await (getConfig as any)('integrations.discord.client_id', process.env.DISCORD_CLIENT_ID)
    const DISCORD_REDIRECT_URI = await (getConfig as any)('integrations.discord.redirect_uri', process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/api/auth/discord/callback`)

    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json({
        success: false,
        message: 'Discord OAuth not configured. Please set up Discord credentials.',
        error: 'DISCORD_NOT_CONFIGURED'
      }, { status: 500 });
    }

    // Determine flow (login vs connect). Default to 'connect' for settings connections
    const flow = request.nextUrl.searchParams.get('flow') === 'login' ? 'login' : 'connect'

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Store state in session/cookie for verification (simplified approach)
    const response = NextResponse.redirect(
      `https://discord.com/api/oauth2/authorize?` +
      `client_id=${DISCORD_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=identify&` +
      `state=${state}`
    );

    // Set state cookie for verification
    response.cookies.set('discord_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });

    // Also set flow cookie so callback can branch behavior
    response.cookies.set('discord_oauth_flow', flow, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600
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
