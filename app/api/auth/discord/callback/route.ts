/**
 * CythroDash - Discord OAuth Callback API Route
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
 * GET /api/auth/discord/callback
 * Handle Discord OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('Discord OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=oauth_denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=missing_params`);
    }

    // Verify state parameter
    const storedState = request.cookies.get('discord_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=invalid_state`);
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=not_configured`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get Discord user information
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      console.error('Discord user fetch failed:', await userResponse.text());
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=user_fetch_failed`);
    }

    const discordUser = await userResponse.json();

    // Auto-join user to Cythro Discord server
    let autoJoinResult = null;
    try {
      const { DiscordAutoJoinService } = await import('@/hooks/managers/discord/auto-join');
      autoJoinResult = await DiscordAutoJoinService.addUserToServer(
        discordUser.id,
        tokenData.access_token,
        {
          id: discordUser.id,
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar
        }
      );
      console.log('Discord auto-join result:', autoJoinResult);
    } catch (error) {
      console.error('Discord auto-join failed:', error);
      autoJoinResult = {
        success: false,
        message: 'Failed to auto-join Discord server',
        error: 'AUTO_JOIN_ERROR'
      };
    }

    // Store Discord connection temporarily for the frontend to process
    // The user will complete the connection when they visit settings
    const discordData = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      connected_at: new Date().toISOString(),
      auto_join_result: autoJoinResult
    };

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?discord_pending=true`);

    // Store Discord connection data temporarily in cookie for the frontend to process
    response.cookies.set('discord_pending_connection', JSON.stringify(discordData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 // 5 minutes to complete connection
    });

    // Clear state cookie
    response.cookies.set('discord_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/earn?discord_error=callback_error`);
  }
}
