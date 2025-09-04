/**
 * CythroDash - User Servers API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { panelServerGetByUser } from '@/hooks/managers/pterodactyl/servers';
import { z } from 'zod';

// Input validation schema for GET request
const getUserServersSchema = z.object({
  include_details: z.coerce.boolean().optional().default(false),
  status: z.enum(['online', 'offline', 'starting', 'stopping']).optional(),
  sort_by: z.enum(['name', 'created_at', 'status']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
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
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

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
 * GET /api/servers
 * Retrieve user's servers from Pterodactyl
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

    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required to access servers'
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

    try {
      // Get user's servers from Pterodactyl
      const serversResponse = await panelServerGetByUser(
        user.pterodactyl_id || user.id,
        filters.include_details
      );

      // Transform servers for frontend
      const transformedServers = serversResponse.data.map(serverData => {
        const server = serverData.attributes!;
        
        // Calculate resource usage percentages
        const memoryUsage = server.limits?.memory ? 
          Math.round((server.resource_usage?.memory_bytes || 0) / (server.limits.memory * 1024 * 1024) * 100) : 0;
        const diskUsage = server.limits?.disk ? 
          Math.round((server.resource_usage?.disk_bytes || 0) / (server.limits.disk * 1024 * 1024) * 100) : 0;
        const cpuUsage = Math.round(server.resource_usage?.cpu_absolute || 0);

        // Determine server status
        let status: 'online' | 'offline' | 'starting' | 'stopping' = 'offline';
        if (server.status === 'running') status = 'online';
        else if (server.status === 'starting') status = 'starting';
        else if (server.status === 'stopping') status = 'stopping';

        return {
          id: server.id.toString(),
          pterodactyl_id: server.id,
          name: server.name,
          description: server.description || '',
          status: status,
          
          // Resource information
          resources: {
            memory: {
              used: Math.round((server.resource_usage?.memory_bytes || 0) / (1024 * 1024)), // MB
              limit: server.limits?.memory || 0, // MB
              percentage: memoryUsage
            },
            disk: {
              used: Math.round((server.resource_usage?.disk_bytes || 0) / (1024 * 1024)), // MB
              limit: server.limits?.disk || 0, // MB
              percentage: diskUsage
            },
            cpu: {
              used: cpuUsage,
              limit: server.limits?.cpu || 0,
              percentage: cpuUsage
            }
          },
          
          // Server details
          node_id: server.node,
          allocation: server.allocation,
          egg_id: server.egg,
          
          // Timestamps
          created_at: server.created_at,
          updated_at: server.updated_at,
          
          // Display information
          players: status === 'online' ? `${server.resource_usage?.players || 0}/${server.limits?.players || 20}` : '0/20',
          uptime: server.resource_usage?.uptime || '0m',
          
          // Legacy compatibility
          type: server.egg_name || 'Unknown',
          cpu: `${cpuUsage}%`,
          memory: `${Math.round((server.resource_usage?.memory_bytes || 0) / (1024 * 1024))}MB/${server.limits?.memory || 0}MB`
        };
      });

      // Apply filters
      let filteredServers = transformedServers;
      if (filters.status) {
        filteredServers = filteredServers.filter(server => server.status === filters.status);
      }

      // Apply sorting
      filteredServers.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (filters.sort_by) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'created_at':
          default:
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
        }

        if (filters.sort_order === 'desc') {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      // Set rate limit headers
      const responseHeaders = {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
      };

      return NextResponse.json({
        success: true,
        message: 'Servers retrieved successfully',
        servers: filteredServers,
        total: filteredServers.length,
        user_permissions: {
          can_create_servers: user.role <= 1, // Users and admins can create servers
          max_servers: user.max_servers || null,
          current_servers: filteredServers.length,
          requires_verification: !user.verified
        }
      }, { 
        status: 200,
        headers: responseHeaders
      });

    } catch (pterodactylError) {
      console.error('Error fetching servers from Pterodactyl:', pterodactylError);
      return NextResponse.json({
        success: false,
        message: 'Failed to retrieve servers from game panel'
      }, { status: 503 });
    }

  } catch (error) {
    console.error('GET /api/servers error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving servers'
    }, { status: 500 });
  }
}
