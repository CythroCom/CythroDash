/**
 * CythroDash - Capacity Monitoring API Route
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
  node_id: z.coerce.number().optional(),
  include_nodes: z.coerce.boolean().optional().default(false),
  include_stats: z.coerce.boolean().optional().default(false),
  force_refresh: z.coerce.boolean().optional().default(false),
  
  // Resource requirements for capacity checking
  required_memory: z.coerce.number().min(1).optional(),
  required_disk: z.coerce.number().min(1).optional(),
  required_cpu: z.coerce.number().min(0).optional(),
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
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute (lower for monitoring)

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
 * GET /api/admin/monitoring/capacity
 * Retrieve real-time capacity information for nodes and locations
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
        message: 'Authentication required to access capacity monitoring'
      }, { status: 401 });
    }

    // Check admin permissions (role 0 = admin)
    if (authResult.user.role !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Admin access required for capacity monitoring'
      }, { status: 403 });
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

    // Prepare response data
    const responseData: any = {
      success: true,
      message: 'Capacity data retrieved successfully',
      timestamp: new Date().toISOString()
    };

    // Handle specific node request
    if (filters.node_id) {
      const nodeUsage = await NodeMonitorService.getNodeUsage(filters.node_id, filters.force_refresh);
      
      if (!nodeUsage) {
        return NextResponse.json({
          success: false,
          message: 'Node not found or unavailable'
        }, { status: 404 });
      }

      responseData.node = nodeUsage;

      // If resource requirements provided, check capacity
      if (filters.required_memory && filters.required_disk) {
        const requirements = {
          memory: filters.required_memory,
          disk: filters.required_disk,
          cpu: filters.required_cpu
        };

        const canAccommodate = nodeUsage.available_memory >= requirements.memory && 
                              nodeUsage.available_disk >= requirements.disk &&
                              !nodeUsage.maintenance_mode;

        responseData.capacity_check = {
          can_accommodate: canAccommodate,
          required_resources: requirements,
          available_resources: {
            memory: nodeUsage.available_memory,
            disk: nodeUsage.available_disk
          },
          utilization_after: canAccommodate ? {
            memory_percentage: ((nodeUsage.allocated_memory + requirements.memory) / nodeUsage.effective_memory_limit) * 100,
            disk_percentage: ((nodeUsage.allocated_disk + requirements.disk) / nodeUsage.effective_disk_limit) * 100
          } : null
        };
      }
    }
    // Handle specific location request
    else if (filters.location_id) {
      const locationCapacity = await NodeMonitorService.getLocationCapacity(filters.location_id, filters.force_refresh);
      
      if (!locationCapacity) {
        return NextResponse.json({
          success: false,
          message: 'Location not found or unavailable'
        }, { status: 404 });
      }

      responseData.location = locationCapacity;

      // Include individual nodes if requested
      if (filters.include_nodes) {
        const allNodeUsages = await NodeMonitorService.getAllNodesUsage(filters.force_refresh);
        responseData.nodes = allNodeUsages.filter(node => node.location_id === filters.location_id);
      }

      // If resource requirements provided, check capacity
      if (filters.required_memory && filters.required_disk) {
        const requirements = {
          memory: filters.required_memory,
          disk: filters.required_disk,
          cpu: filters.required_cpu
        };

        const capacityCheck = await CapacityCalculator.checkLocationCapacity(
          filters.location_id, 
          requirements, 
          filters.force_refresh
        );

        responseData.capacity_check = capacityCheck;

        // Also get optimal node selection
        const nodeSelection = await CapacityCalculator.selectOptimalNode(
          filters.location_id,
          requirements,
          filters.force_refresh
        );

        responseData.node_selection = nodeSelection;
      }
    }
    // Handle all locations request
    else {
      const allLocationsCapacity = await NodeMonitorService.getAllLocationsCapacity(filters.force_refresh);
      responseData.locations = allLocationsCapacity;

      // Include individual nodes if requested
      if (filters.include_nodes) {
        const allNodeUsages = await NodeMonitorService.getAllNodesUsage(filters.force_refresh);
        responseData.nodes = allNodeUsages;
      }

      // Include overall statistics if requested
      if (filters.include_stats) {
        const monitoringStats = await NodeMonitorService.getMonitoringStats(filters.force_refresh);
        responseData.stats = monitoringStats;
      }

      // If resource requirements provided, check capacity for all locations
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
          filters.force_refresh
        );

        responseData.capacity_checks = capacityChecks;

        // Find best locations
        const viableLocations = capacityChecks
          .filter(check => check.can_accommodate)
          .sort((a, b) => {
            // Sort by available capacity (descending)
            const aCapacity = a.available_capacity.memory + a.available_capacity.disk;
            const bCapacity = b.available_capacity.memory + b.available_capacity.disk;
            return bCapacity - aCapacity;
          });

        responseData.recommended_locations = viableLocations.slice(0, 3);
      }
    }

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    return NextResponse.json(responseData, { 
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('GET /api/admin/monitoring/capacity error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving capacity data'
    }, { status: 500 });
  }
}
