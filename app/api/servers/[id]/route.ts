/**
 * CythroDash - Individual Server Management API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { panelServerGetDetails, panelServerUpdateDetails, panelServerDelete } from '@/hooks/managers/pterodactyl/servers';
import { serverOperations } from '@/hooks/managers/database/servers';
import { z } from 'zod';

// Input validation schema for PATCH request
const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startup: z.string().optional(),
  environment: z.record(z.string()).optional(),
  limits: z.object({
    memory: z.number().min(0).optional(),
    disk: z.number().min(0).optional(),
    cpu: z.number().min(0).optional(),
    swap: z.number().min(0).optional(),
    io: z.number().min(0).optional(),
  }).optional(),
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
 * GET /api/servers/[id]
 * Retrieve detailed information about a specific server
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        message: 'Authentication required to access server details'
      }, { status: 401 });
    }

    const rawId = params.id;

    // Resolve incoming ID to Pterodactyl numeric server ID
    let panelServerId: number | null = null;
    try {
      if (/^\d+$/.test(rawId)) {
        panelServerId = parseInt(rawId, 10);
      } else if (rawId.startsWith('srv_')) {
        const dbServer = await serverOperations.getServerById(rawId);
        if (!dbServer) {
          console.warn('GET /api/servers/[id] - DB server not found for internal id', { rawId });
          return NextResponse.json({ success: false, message: 'Server not found' }, { status: 404 });
        }
        if (typeof dbServer.pterodactyl_server_id === 'number') {
          panelServerId = dbServer.pterodactyl_server_id;
        } else {
          console.warn('GET /api/servers/[id] - Missing panel mapping for server', { rawId });
          return NextResponse.json({ success: false, message: 'Server is not yet linked to game panel' }, { status: 409 });
        }
      } else {
        console.warn('GET /api/servers/[id] - Unsupported ID format', { rawId });
        return NextResponse.json({ success: false, message: 'Invalid server ID format' }, { status: 400 });
      }
    } catch (resolveErr) {
      console.error('GET /api/servers/[id] - Error resolving server id', { rawId, error: String(resolveErr) });
      return NextResponse.json({ success: false, message: 'Failed to resolve server ID' }, { status: 500 });
    }

    const user = authResult.user;

    try {
      // Get server details from Pterodactyl
      const serverResponse = await panelServerGetDetails(panelServerId!, {
        include: "allocations,variables,egg,node"
      });

      if (!serverResponse.attributes) {
        return NextResponse.json({
          success: false,
          message: 'Server not found'
        }, { status: 404 });
      }

      const server = serverResponse.attributes;

      // Check if user owns this server (or is admin)
      if (user.role > 0 && server.user !== (user.pterodactyl_id || user.id)) {
        return NextResponse.json({
          success: false,
          message: 'You do not have permission to access this server'
        }, { status: 403 });
      }

      // Calculate resource usage percentages
      const memoryUsage = server.limits?.memory ? 
        Math.round((server.resource_usage?.memory_bytes || 0) / (server.limits.memory * 1024 * 1024) * 100) : 0;
      const diskUsage = server.limits?.disk ? 
        Math.round((server.resource_usage?.disk_bytes || 0) / (server.limits.disk * 1024 * 1024) * 100) : 0;
      const cpuUsage = Math.round(server.resource_usage?.cpu_absolute || 0);

      // Get billing information from database
      let billingInfo = null;
      try {
        billingInfo = await serverOperations.getServerByPterodactylId(server.id);
      } catch (error) {
        console.warn('Could not fetch billing information for server:', server.id, error);
      }

      // Determine server status
      let status: 'online' | 'offline' | 'starting' | 'stopping' = 'offline';
      if (server.status === 'running') status = 'online';
      else if (server.status === 'starting') status = 'starting';
      else if (server.status === 'stopping') status = 'stopping';

      // Transform server data for frontend
      const transformedServer = {
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
          },
          swap: server.limits?.swap || 0,
          io: server.limits?.io || 500
        },
        
        // Server configuration
        startup: server.startup,
        environment: server.environment || {},
        
        // Server details
        node_id: server.node,
        egg_id: server.egg,
        allocation: server.allocation,
        
        // Network information
        allocations: server.relationships?.allocations?.data?.map((alloc: any) => ({
          id: alloc.attributes.id,
          ip: alloc.attributes.ip,
          port: alloc.attributes.port,
          alias: alloc.attributes.alias,
          assigned: alloc.attributes.assigned
        })) || [],
        
        // Timestamps
        created_at: server.created_at,
        updated_at: server.updated_at,
        
        // Display information
        players: status === 'online' ? `${server.resource_usage?.players || 0}/${server.limits?.players || 20}` : '0/20',
        uptime: server.resource_usage?.uptime || '0m',
        
        // Legacy compatibility
        type: server.egg_name || 'Unknown',
        cpu: `${cpuUsage}%`,
        memory: `${Math.round((server.resource_usage?.memory_bytes || 0) / (1024 * 1024))}MB/${server.limits?.memory || 0}MB`,

        // Billing information from database
        billing_status: billingInfo?.billing_status || 'active',
        expiry_date: billingInfo?.expiry_date?.toISOString(),
        auto_delete_at: billingInfo?.auto_delete_at?.toISOString(),
        overdue_amount: billingInfo?.billing?.overdue_amount,
        pterodactyl_identifier: server.identifier || server.uuid
      };

      // Set rate limit headers
      const responseHeaders = {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
      };

      return NextResponse.json({
        success: true,
        message: 'Server details retrieved successfully',
        server: transformedServer,
        user_permissions: {
          can_modify: user.role === 0 || server.user === (user.pterodactyl_id || user.id),
          can_delete: user.role === 0 || server.user === (user.pterodactyl_id || user.id),
          is_owner: server.user === (user.pterodactyl_id || user.id),
          is_admin: user.role === 0
        }
      }, { 
        status: 200,
        headers: responseHeaders
      });

    } catch (pterodactylError) {
      console.error('Error fetching server from Pterodactyl:', pterodactylError);
      return NextResponse.json({
        success: false,
        message: 'Failed to retrieve server from game panel'
      }, { status: 503 });
    }

  } catch (error) {
    console.error('GET /api/servers/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving server details'
    }, { status: 500 });
  }
}
