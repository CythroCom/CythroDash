/**
 * CythroDash - Login API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoginController } from '@/hooks/managers/controller/Auth/Login';
import { z } from 'zod';
import { SECURITY_CONFIG, getSessionCookieOptions, getRefreshTokenCookieOptions, getClientIP } from '../../../../lib/security/config';
import { getPublicFlag } from '@/lib/public-settings'

// Input validation schema
const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional().default(false),
});

// Rate limiting (simple in-memory store - use Redis in production)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  const config = SECURITY_CONFIG.RATE_LIMIT.LOGIN;

  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }

  // Reset if lockout period has passed
  if (now - attempts.lastAttempt > config.LOCKOUT_DURATION) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if too many attempts
  if (attempts.count >= config.MAX_ATTEMPTS) {
    return false;
  }

  // Increment attempts
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}


export async function POST(request: NextRequest) {
  try {
    // Maintenance mode: allow login? Typically yes, but we can block if desired
    const maintenance = await getPublicFlag('NEXT_PUBLIC_MAINTENANCE_MODE', process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true')
    if (maintenance) {
      return NextResponse.json({ success: false, message: 'Maintenance mode enabled' }, { status: 503 })
    }

    // Feature gate: account login
    const loginEnabled = await getPublicFlag('NEXT_PUBLIC_ACCOUNT_LOGIN', process.env.NEXT_PUBLIC_ACCOUNT_LOGIN === 'true')
    if (!loginEnabled) {
      return NextResponse.json({ success: false, message: 'Login is disabled' }, { status: 403 })
    }

    // Get client IP
    const ip = getClientIP(request);

    // Check rate limiting
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many login attempts. Please try again later.',
          error: 'RATE_LIMITED'
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const inputValidation = loginSchema.safeParse(body);

    if (!inputValidation.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid input data',
          errors: inputValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const { identifier, password, remember_me } = inputValidation.data;

    // Prepare login request
    const loginRequest = {
      identifier,
      password,
      remember_me,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown'
    };

    // Attempt login
    const loginResult = await LoginController.loginUser(loginRequest);

    if (loginResult.success && loginResult.user && loginResult.session) {
      // Reset rate limiting on successful login
      resetRateLimit(ip);

      // Prepare response
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: {
          id: loginResult.user.id,
          pterodactyl_uuid: loginResult.user.id.toString(), // Use ID as UUID fallback
          username: loginResult.user.username,
          email: loginResult.user.email,
          first_name: loginResult.user.first_name,
          last_name: loginResult.user.last_name,
          display_name: `${loginResult.user.first_name} ${loginResult.user.last_name}`,
          role: loginResult.user.role,
          verified: loginResult.user.verified,
          coins: loginResult.user.coins || 0,
          avatar_url: loginResult.user.avatar_url,
          created_at: new Date().toISOString(), // Use current date as fallback
          last_login: new Date().toISOString()
        },
        sessionToken: loginResult.session.token
      });

      // Set secure HTTP-only cookie for session token
      const cookieOptions = getSessionCookieOptions(remember_me);
      response.cookies.set('session_token', loginResult.session.token, cookieOptions);

      // Set refresh token if available (for future implementation)
      // if (loginResult.refreshToken) {
      //   response.cookies.set('refresh_token', loginResult.refreshToken, getRefreshTokenCookieOptions());
      // }

      return response;
    } else {
      return NextResponse.json(
        {
          success: false,
          message: loginResult.message || 'Login failed',
          errors: loginResult.errors || []
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login API error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...SECURITY_CONFIG.HEADERS
    },
  });
}
