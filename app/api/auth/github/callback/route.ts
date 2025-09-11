/**
 * CythroDash - GitHub OAuth Callback
 * 
 * Handles GitHub OAuth callback and performs auto-actions
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=${error}`);
    }

    if (!code) {
      console.error('GitHub OAuth callback missing code parameter');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=missing_code`);
    }

    // Verify state parameter
    const storedState = request.cookies.get('github_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('GitHub OAuth state mismatch');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=invalid_state`);
    }

    const { getConfig } = await import('@/database/config-manager.js')
    const GITHUB_CLIENT_ID = await (getConfig as any)('integrations.github.client_id', process.env.GITHUB_CLIENT_ID)
    const GITHUB_CLIENT_SECRET = await (getConfig as any)('integrations.github.client_secret', process.env.GITHUB_CLIENT_SECRET)

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      console.error('GitHub OAuth not properly configured');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=not_configured`);
    }

    // Exchange code for access token
    console.log('Exchanging GitHub authorization code for access token');
    
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('GitHub token exchange failed:', tokenResponse.status);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub token exchange error:', tokenData.error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=token_exchange_failed`);
    }

    // Get user information
    console.log('Fetching GitHub user information');
    
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CythroDash'
      },
    });

    if (!userResponse.ok) {
      console.error('GitHub user fetch failed:', userResponse.status);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=user_fetch_failed`);
    }

    const githubUser = await userResponse.json();

    // Decide behavior based on flow cookie
    const flow = request.cookies.get('github_oauth_flow')?.value || 'connect'

    if (flow === 'login') {
      // Social login: find user by GitHub ID and create a session
      try {
        const { userOperations } = await import('@/hooks/managers/database/user')
        const user = await userOperations.getUserByGitHubId(githubUser.id)
        if (!user) {
          const resp = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/login?github_error=not_linked`)
          // Clear state/flow cookies
          resp.cookies.set('github_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
          resp.cookies.set('github_oauth_flow', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
          return resp
        }

        const { getSessionCookieOptions } = await import('@/lib/security/config')
        const cookieOptions = (getSessionCookieOptions as any)(false)
        const { randomBytes } = await import('crypto')
        const sessionToken = randomBytes(32).toString('hex')
        const minimalUser = { id: user.id, username: user.username, email: user.email, role: user.role }

        const resp = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/auth/processing`)
        resp.cookies.set('session_token', sessionToken, cookieOptions)
        resp.cookies.set('x_user_data', encodeURIComponent(JSON.stringify(minimalUser)), cookieOptions)
        // Clear state/flow cookies
        resp.cookies.set('github_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
        resp.cookies.set('github_oauth_flow', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 })
        return resp
      } catch (e) {
        console.error('GitHub login flow error:', e)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/login?github_error=internal_error`)
      }
    }

    // CONNECT flow (default): perform auto-actions and store pending connection for Settings to consume
    // Perform auto-actions: star repos and follow organization
    let autoActionsResult = null;
    try {
      const { GitHubAutoActionsService } = await import('@/hooks/managers/github/auto-actions');
      autoActionsResult = await GitHubAutoActionsService.performAutoActions(
        tokenData.access_token,
        {
          id: githubUser.id,
          login: githubUser.login,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url
        }
      );
      console.log('GitHub auto-actions result:', autoActionsResult);
    } catch (error) {
      console.error('GitHub auto-actions failed:', error);
      autoActionsResult = {
        success: false,
        message: 'Failed to perform GitHub auto-actions',
        actions_performed: {
          repos_starred: 0,
          organization_followed: false,
          failed_actions: ['Auto-actions service error']
        },
        error: 'AUTO_ACTIONS_ERROR'
      };
    }

    // Store GitHub connection temporarily for the frontend to process
    const githubData = {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name,
      avatar_url: githubUser.avatar_url,
      connected_at: new Date().toISOString(),
      auto_actions_result: autoActionsResult
    };

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_pending=true`);

    // Store GitHub connection data temporarily in cookie for the frontend to process
    response.cookies.set('github_pending_connection', JSON.stringify(githubData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 // 5 minutes to complete connection
    });

    // Clear state/flow cookies
    response.cookies.set('github_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });
    response.cookies.set('github_oauth_flow', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=callback_error`);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
