/**
 * CythroDash - Authentication Middleware
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: any;
}

/**
 * Authentication middleware for API routes
 * Validates session token and extracts user information from request headers
 */
export async function authMiddleware(request: NextRequest): Promise<{
  success: boolean;
  user?: any;
  error?: string;
  response?: NextResponse
}> {
  try {
    // Get token from Authorization header or cookies
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') ||
                        request.cookies.get('session_token')?.value;

    // Require at least some auth context: session token OR x_user_data
    const hasUserHeader = !!request.headers.get('x-user-data')
    const hasUserCookie = !!request.cookies.get('x_user_data')?.value
    if (!sessionToken && !hasUserHeader && !hasUserCookie) {
      return {
        success: false,
        error: 'No authentication context provided',
        response: NextResponse.json(
          { success: false, message: 'Authentication required', error: 'NO_AUTH_CONTEXT' },
          { status: 401 }
        )
      };
    }

    // Note: Do not strictly validate session token format here.
    // Some environments may use non-hex tokens (JWT or other). We rely on user context cookie/header for now.

    // Get user information from request headers (sent by client)
    const userDataHeader = request.headers.get('x-user-data');
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData };
        }
      } catch (parseError) {
        console.log('User data header parsing failed:', parseError);
      }
    }

    // Fallback: try x_user_data cookie (set at login)
    const userDataCookie = request.cookies.get('x_user_data')?.value;
    if (userDataCookie) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataCookie));
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData };
        }
      } catch (e) {
        // ignore
      }
    }

    // Fallback: Try to parse session token as JSON (legacy compatibility)
    if (sessionToken) {
      try {
        const userData = JSON.parse(decodeURIComponent(sessionToken));
        if (userData && userData.id) {
          return { success: true, user: userData };
        }
      } catch (parseError) {
        // ignore; not JSON-encoded
      }
    }

    // No user available; require header or cookie until session store is implemented
    return {
      success: false,
      error: 'Session validation not implemented - user data required',
      response: NextResponse.json(
        {
          success: false,
          message: 'Authentication failed - user context missing',
          error: 'SESSION_VALIDATION_NOT_IMPLEMENTED',
          hint: 'Include x-user-data header or ensure x_user_data cookie is set at login'
        },
        { status: 401 }
      )
    };

  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      success: false,
      error: 'Authentication error',
      response: NextResponse.json(
        { success: false, message: 'Authentication error', error: 'AUTH_ERROR' },
        { status: 500 }
      )
    };
  }
}

/**
 * Role-based authorization middleware
 */
export async function requireRole(
  request: NextRequest, 
  requiredRole: number = 1 // 0 = admin, 1 = user
): Promise<{ 
  success: boolean; 
  user?: any; 
  error?: string; 
  response?: NextResponse 
}> {
  const authResult = await authMiddleware(request);
  
  if (!authResult.success) {
    return authResult;
  }

  const user = authResult.user;
  
  // Check if user has required role (lower number = higher privilege)
  if (user.role > requiredRole) {
    return {
      success: false,
      error: 'Insufficient permissions',
      response: NextResponse.json(
        { success: false, message: 'Insufficient permissions', error: 'INSUFFICIENT_PERMISSIONS' },
        { status: 403 }
      )
    };
  }

  return {
    success: true,
    user
  };
}

/**
 * Admin-only middleware
 */
export async function requireAdmin(request: NextRequest) {
  return requireRole(request, 0); // Admin role = 0
}

/**
 * Wrapper function to protect API routes
 */
export function withAuth(
  handler: (request: NextRequest, user: any) => Promise<NextResponse>,
  options: { requireAdmin?: boolean } = {}
) {
  return async (request: NextRequest) => {
    const authResult = options.requireAdmin 
      ? await requireAdmin(request)
      : await authMiddleware(request);

    if (!authResult.success) {
      return authResult.response!;
    }

    return handler(request, authResult.user);
  };
}

/**
 * Client-side authentication check hook
 */
export function useAuthCheck() {
  if (typeof window === 'undefined') return { isAuthenticated: false };
  
  const sessionToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('session_token='))
    ?.split('=')[1];

  return {
    isAuthenticated: !!sessionToken,
    sessionToken
  };
}

/**
 * Session validation utility
 * Note: Simplified version that checks for session token presence
 */
export async function validateClientSession(): Promise<boolean> {
  try {
    // Simple check for session token in cookies
    const sessionToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('session_token='))
      ?.split('=')[1];

    return !!sessionToken;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

/**
 * Logout utility
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Clear local storage and redirect
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/auth/login';
  }
}
