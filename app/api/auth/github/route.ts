/**
 * CythroDash - GitHub OAuth Initiation
 * 
 * Initiates GitHub OAuth flow with scopes for auto-starring repos and following organization
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getConfig } = await import('@/database/config-manager.js')
    const GITHUB_CLIENT_ID = await (getConfig as any)('integrations.github.client_id', process.env.GITHUB_CLIENT_ID)
    const base = process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)
    const GITHUB_REDIRECT_URI = await (getConfig as any)('integrations.github.redirect_uri', process.env.GITHUB_REDIRECT_URI || `${base}/api/auth/github/callback`)

    if (!GITHUB_CLIENT_ID) {
      console.error('GitHub OAuth not configured - missing client ID');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=not_configured`);
    }

    if (!GITHUB_REDIRECT_URI) {
      console.error('GitHub OAuth not configured - missing redirect URI');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=not_configured`);
    }

    console.log('Initiating GitHub OAuth flow');

    // Determine flow (login vs connect). Default to 'connect' for settings connections
    const flow = request.nextUrl.searchParams.get('flow') === 'login' ? 'login' : 'connect'

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // GitHub OAuth with scopes for starring repos and following users
    const response = NextResponse.redirect(
      `https://github.com/login/oauth/authorize?` +
      `client_id=${GITHUB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&` +
      `scope=user:follow%20public_repo&` +
      `state=${state}`
    );

    // Set state cookie for verification
    response.cookies.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });

    // Also set flow cookie so callback can branch behavior
    response.cookies.set('github_oauth_flow', flow, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600
    });

    return response;

  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL || (request.nextUrl && request.nextUrl.origin)}/settings?github_error=oauth_error`);
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
