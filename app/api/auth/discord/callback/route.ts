/**
 * CythroDash - Discord OAuth Callback API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';

// Discord OAuth configuration resolved at runtime from DB config with env fallback


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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=oauth_denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=missing_params`);
    }

    // Verify state parameter
    const storedState = request.cookies.get('discord_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=invalid_state`);
    }

    const { getConfig } = await import('@/database/config-manager.js')
    const DISCORD_CLIENT_ID = await (getConfig as any)('integrations.discord.client_id', process.env.DISCORD_CLIENT_ID)
    const DISCORD_CLIENT_SECRET = await (getConfig as any)('integrations.discord.client_secret', process.env.DISCORD_CLIENT_SECRET)
    const DISCORD_REDIRECT_URI = await (getConfig as any)('integrations.discord.redirect_uri', process.env.DISCORD_REDIRECT_URI || `${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/api/auth/discord/callback`)

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=not_configured`);
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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=token_exchange_failed`);
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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=user_fetch_failed`);
    }

    const discordUser = await userResponse.json();

    

    // Decide behavior based on flow cookie
    const flow = request.cookies.get('discord_oauth_flow')?.value || 'connect'

    if (flow === 'login') {
      // Social login: find user by Discord ID and create a session
      try {
        const { userOperations } = await import('@/hooks/managers/database/user')
        const user = await userOperations.getUserByDiscordId(discordUser.id)
        if (!user) {
          // No account linked to this Discord
          const resp = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/login?discord_error=not_linked`)
          // Clear state/flow cookies
          resp.cookies.set('discord_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
          resp.cookies.set('discord_oauth_flow', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
          return resp
        }

        // Build session cookies similar to password login
        const { getSessionCookieOptions } = await import('@/lib/security/config')
        const cookieOptions = (getSessionCookieOptions as any)(false)
        const { randomBytes } = await import('crypto')
        const sessionToken = randomBytes(32).toString('hex')
        const minimalUser = { id: user.id, username: user.username, email: user.email, role: user.role }

        const resp = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/auth/processing`)
        resp.cookies.set('session_token', sessionToken, cookieOptions)
        resp.cookies.set('x_user_data', encodeURIComponent(JSON.stringify(minimalUser)), cookieOptions)
        // Clear state/flow cookies
        resp.cookies.set('discord_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
        resp.cookies.set('discord_oauth_flow', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
        return resp
      } catch (e) {
        console.error('Discord login flow error:', e)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/login?discord_error=internal_error`)
      }
    }

    // CONNECT flow (default) — store pending connection for Settings to consume
    const discordData = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      connected_at: new Date().toISOString()
    };

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?discord_pending=true`);

    // Store Discord connection data temporarily in cookie for the frontend to process
    response.cookies.set('discord_pending_connection', JSON.stringify(discordData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 // 5 minutes to complete connection
    });

    // Clear state/flow cookies
    response.cookies.set('discord_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });
    response.cookies.set('discord_oauth_flow', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/earn?discord_error=callback_error`);
  }
}
