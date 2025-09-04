/**
 * CythroDash - User Servers API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import ServersController from '@/hooks/managers/controller/User/Servers';
import { z } from 'zod';

// Input validation schema for GET request
const getUserServersSchema = z.object({
  status: z.string().optional(),
  power_state: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  skip: z.coerce.number().min(0).optional(),
});

// Authentication function following the established pattern
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Get session token from cookies or Authorization header
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') ||
                        request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: 'No session token found'
      };
    }

    // Validate session token format (should be hex string)
    const hexTokenRegex = /^[a-f0-9]{64}$/i; // 32 bytes = 64 hex characters
    if (!hexTokenRegex.test(sessionToken)) {
      return {
        success: false,
        error: 'Invalid session token format'
      };
    }

    // Get user information from request headers (sent by client)
    const userDataHeader = request.headers.get('x-user-data');
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));
        return {
          success: true,
          user: userData
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid user data format'
        };
      }
    }

    return {
      success: false,
      error: 'User data not found in request headers'
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 60; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const resetTime = windowStart + RATE_LIMIT_WINDOW_MS;
  
  const key = `${clientIP}:${windowStart}`;
  const current = rateLimitMap.get(key) || { count: 0, resetTime };
  
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime };
  }
  
  current.count++;
  rateLimitMap.set(key, current);
  
  // Clean up old entries
  for (const [mapKey, value] of rateLimitMap.entries()) {
    if (value.resetTime <= now) {
      rateLimitMap.delete(mapKey);
    }
  }
  
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX_REQUESTS - current.count, 
    resetTime 
  };
}

/**
 * GET /api/servers/user
 * Get user's servers with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
        }
      });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: authResult.error || 'Authentication failed'
      }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getUserServersSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const filters = validation.data;
    const user = authResult.user;

    // Get user's servers using the controller
    const result = await ServersController.getUserServers(user.id, {
      status: filters.status as any,
      power_state: filters.power_state as any,
      search: filters.search
    });

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
    };

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      servers: result.servers,
      total_count: result.total_count,
      user_limits: result.user_limits
    }, { 
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('GET /api/servers/user error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving servers'
    }, { status: 500 });
  }
}
