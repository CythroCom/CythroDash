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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=${error}`);
    }

    if (!code) {
      console.error('GitHub OAuth callback missing code parameter');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=missing_code`);
    }

    // Verify state parameter
    const storedState = request.cookies.get('github_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('GitHub OAuth state mismatch');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=invalid_state`);
    }

    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      console.error('GitHub OAuth not properly configured');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=not_configured`);
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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub token exchange error:', tokenData.error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=token_exchange_failed`);
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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=user_fetch_failed`);
    }

    const githubUser = await userResponse.json();

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

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_pending=true`);

    // Store GitHub connection data temporarily in cookie for the frontend to process
    response.cookies.set('github_pending_connection', JSON.stringify(githubData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 // 5 minutes to complete connection
    });

    // Clear state cookie
    response.cookies.set('github_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/settings?github_error=callback_error`);
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
