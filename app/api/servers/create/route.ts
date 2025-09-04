/**
 * CythroDash - Server Creation API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import ServersController from '@/hooks/managers/controller/User/Servers';
import { z } from 'zod';
import { getPublicFlag } from '@/lib/public-settings'

// Input validation schema for POST request
const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  server_type_id: z.string(),
  server_software_id: z.string(),
  location_id: z.string(),
  plan_id: z.string(),
  environment_variables: z.record(z.string()).optional().default({}),
  startup_command: z.string().optional(),
  docker_image: z.string().optional(),
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

        if (userData && userData.id && userData.username && userData.email) {
          return {
            success: true,
            user: userData
          };
        }
      } catch (parseError) {
        console.log('User data header parsing failed:', parseError);
      }
    }

    return {
      success: false,
      error: 'User identification required'
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Rate limiting check (simple implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 server creations per minute

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIP);

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize rate limit
    rateLimitMap.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: clientData.resetTime
    };
  }

  clientData.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - clientData.count,
    resetTime: clientData.resetTime
  };
}

/**
 * POST /api/servers/create
 * Create a new server
 */
export async function POST(request: NextRequest) {
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

    // Feature gate: server creation
    const serverCreationEnabled = await getPublicFlag('NEXT_PUBLIC_SERVER_CREATION', process.env.NEXT_PUBLIC_SERVER_CREATION === 'true')
    if (!serverCreationEnabled) {
      return NextResponse.json({ success: false, message: 'Server creation is disabled' }, { status: 403 })
    }

    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required to create servers'
      }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createServerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const createRequest = validation.data;
    const user = authResult.user;

    // Check if user can create servers
    if (user.role > 1) { // Only users (role 1) and admins (role 0) can create servers
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to create servers'
      }, { status: 403 });
    }



    try {
      // Use the new ServersController to create the server
      const serverCreationRequest = {
        name: createRequest.name,
        description: undefined, // Can be added later if needed
        server_type_id: createRequest.server_type_id,
        software_id: createRequest.server_software_id,
        location_id: createRequest.location_id,
        plan_id: createRequest.plan_id,
        environment_variables: createRequest.environment_variables,
        startup_command: createRequest.startup_command,
        docker_image: createRequest.docker_image
      };

      const result = await ServersController.createServer(user.id, serverCreationRequest);

      if (!result.success) {
        return NextResponse.json({
          success: false,
          message: result.message
        }, { status: 400 });
      }

      // Server created successfully by controller
      console.log('Server created successfully:', {
        server_id: result.server?.id,
        pterodactyl_id: result.server?.pterodactyl_server_id,
        user_id: user.id
      });

      // Set rate limit headers
      const responseHeaders = {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
      };

      return NextResponse.json({
        success: true,
        message: result.message,
        server_id: result.server?.pterodactyl_server_id,
        server: {
          id: result.server?.id,
          pterodactyl_id: result.server?.pterodactyl_server_id,
          name: result.server?.name,
          status: result.server?.status,
          power_state: result.server?.power_state,
          billing_status: result.server?.billing_status
        },
        cost_breakdown: {
          plan_cost: result.server?.billing.monthly_cost || 0,
          setup_fee: result.server?.billing.setup_fee_paid || 0,
          total_cost: (result.server?.billing.monthly_cost || 0) + (result.server?.billing.setup_fee_paid || 0)
        }
      }, {
        status: 201,
        headers: responseHeaders
      });

    } catch (error) {
      console.error('POST /api/servers/create error:', error);
      return NextResponse.json({
        success: false,
        message: 'An unexpected error occurred while creating server'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('POST /api/servers/create error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while creating server'
    }, { status: 500 });
  }
}
