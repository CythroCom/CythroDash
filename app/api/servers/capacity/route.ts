/**
 * CythroDash - Server Creation Capacity API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { NodeMonitorService } from '@/hooks/managers/monitoring/node-monitor';
import { CapacityCalculator } from '@/hooks/managers/monitoring/capacity-calculator';
import { z } from 'zod';

// Input validation schema for GET request
const getCapacitySchema = z.object({
  location_id: z.coerce.number().optional(),
  required_memory: z.coerce.number().min(1).optional(),
  required_disk: z.coerce.number().min(1).optional(),
  required_cpu: z.coerce.number().min(0).optional(),
  include_recommendations: z.coerce.boolean().optional().default(true),
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
 * GET /api/servers/capacity
 * Check capacity availability for server creation
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
        message: 'Authentication required to check server capacity'
      }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getCapacitySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const filters = validation.data;
    const user = authResult.user;

    // Check if user can create servers
    if (user.role > 1) { // Only users (role 1) and admins (role 0) can create servers
      return NextResponse.json({
        success: false,
        message: 'You do not have permission to create servers'
      }, { status: 403 });
    }

    // Prepare response data
    const responseData: any = {
      success: true,
      message: 'Capacity information retrieved successfully',
      timestamp: new Date().toISOString(),
      user_permissions: {
        can_create_servers: true,
        max_servers: user.max_servers || null,
        current_servers: user.current_servers || 0,
        requires_verification: !user.verified
      }
    };

    // If specific location and requirements provided
    if (filters.location_id && filters.required_memory && filters.required_disk) {
      const requirements = {
        memory: filters.required_memory,
        disk: filters.required_disk,
        cpu: filters.required_cpu
      };

      // Check location capacity
      const capacityCheck = await CapacityCalculator.checkLocationCapacity(
        filters.location_id,
        requirements,
        false // Don't force refresh for user requests
      );

      responseData.location_capacity = {
        location_id: filters.location_id,
        can_accommodate: capacityCheck.can_accommodate,
        status: capacityCheck.location_status,
        available_nodes: capacityCheck.available_nodes,
        utilization_after_creation: capacityCheck.utilization_after_creation,
        warnings: capacityCheck.warnings
      };

      // Get node selection if capacity is available
      if (capacityCheck.can_accommodate && filters.include_recommendations) {
        const nodeSelection = await CapacityCalculator.selectOptimalNode(
          filters.location_id,
          requirements,
          false
        );

        if (nodeSelection.success && nodeSelection.selected_node) {
          responseData.recommended_node = {
            node_id: nodeSelection.selected_node.node_id,
            node_name: nodeSelection.selected_node.node_name,
            fqdn: nodeSelection.selected_node.fqdn,
            available_memory: nodeSelection.selected_node.available_memory,
            available_disk: nodeSelection.selected_node.available_disk,
            selection_reason: nodeSelection.selected_node.selection_reason
          };
        }
      }
    }
    // If only location provided (general capacity check)
    else if (filters.location_id) {
      const locationCapacity = await NodeMonitorService.getLocationCapacity(filters.location_id, false);
      
      if (!locationCapacity) {
        return NextResponse.json({
          success: false,
          message: 'Location not found or unavailable'
        }, { status: 404 });
      }

      responseData.location_capacity = {
        location_id: filters.location_id,
        status: locationCapacity.status,
        available_nodes: locationCapacity.active_nodes,
        total_capacity: {
          memory: locationCapacity.total_memory,
          disk: locationCapacity.total_disk
        },
        available_capacity: {
          memory: locationCapacity.available_memory,
          disk: locationCapacity.available_disk
        },
        current_utilization: {
          memory_percentage: locationCapacity.memory_usage_percentage,
          disk_percentage: locationCapacity.disk_usage_percentage
        }
      };
    }
    // General capacity overview for all locations
    else {
      const allLocationsCapacity = await NodeMonitorService.getAllLocationsCapacity(false);
      
      // Transform for public API (hide sensitive details)
      const publicLocationData = allLocationsCapacity.map(location => ({
        location_id: location.location_id,
        status: location.status,
        available_nodes: location.active_nodes,
        capacity_status: location.status,
        utilization: {
          memory_percentage: location.memory_usage_percentage,
          disk_percentage: location.disk_usage_percentage
        },
        can_create_servers: location.status === 'available' || location.status === 'limited'
      }));

      responseData.locations = publicLocationData;

      // If requirements provided, check all locations
      if (filters.required_memory && filters.required_disk) {
        const requirements = {
          memory: filters.required_memory,
          disk: filters.required_disk,
          cpu: filters.required_cpu
        };

        const locationIds = allLocationsCapacity.map(loc => loc.location_id);
        const capacityChecks = await CapacityCalculator.getMultiLocationCapacity(
          locationIds,
          requirements,
          false
        );

        // Transform capacity checks for public API
        const publicCapacityChecks = capacityChecks.map(check => ({
          location_id: check.location_id,
          can_accommodate: check.can_accommodate,
          status: check.location_status,
          utilization_after_creation: check.utilization_after_creation,
          warnings: check.warnings
        }));

        responseData.capacity_checks = publicCapacityChecks;

        // Recommend best locations
        const viableLocations = publicCapacityChecks
          .filter(check => check.can_accommodate)
          .sort((a, b) => {
            // Prefer locations with lower utilization after creation
            const aUtil = Math.max(a.utilization_after_creation.memory_percentage, a.utilization_after_creation.disk_percentage);
            const bUtil = Math.max(b.utilization_after_creation.memory_percentage, b.utilization_after_creation.disk_percentage);
            return aUtil - bUtil;
          });

        responseData.recommended_locations = viableLocations.slice(0, 3);
      }
    }

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
      'Cache-Control': 'public, max-age=60', // Cache for 1 minute
    };

    return NextResponse.json(responseData, { 
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('GET /api/servers/capacity error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while checking server capacity'
    }, { status: 500 });
  }
}
