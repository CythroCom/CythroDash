/**
 * CythroDash - Server Locations API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { locationOperations } from '@/hooks/managers/database/location';
import { LocationStatus, LocationVisibility } from '@/database/tables/cythro_dash_locations';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache';

// Input validation schema for GET request
const getServerLocationsSchema = z.object({
  server_type_id: z.string().optional(),
  plan_id: z.string().optional(),
  include_capacity: z.coerce.boolean().optional().default(true),
  include_stats: z.coerce.boolean().optional(),
  sort_by: z.enum(['name', 'country', 'priority', 'capacity']).optional().default('priority'),
  sort_order: z.enum(['asc', 'desc']).optional().default('asc'),
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

// Calculate capacity status
function getCapacityStatus(location: any): { status: 'available' | 'limited' | 'full'; percentage: number } {
  if (!location.total_capacity || !location.current_usage) {
    return { status: 'available', percentage: 0 };
  }

  const memoryPercentage = location.total_capacity.memory > 0 
    ? (location.current_usage.memory / location.total_capacity.memory) * 100 
    : 0;
  const diskPercentage = location.total_capacity.disk > 0 
    ? (location.current_usage.disk / location.total_capacity.disk) * 100 
    : 0;
  const cpuPercentage = location.total_capacity.cpu > 0 
    ? (location.current_usage.cpu / location.total_capacity.cpu) * 100 
    : 0;

  const maxPercentage = Math.max(memoryPercentage, diskPercentage, cpuPercentage);

  if (maxPercentage >= 95) return { status: 'full', percentage: maxPercentage };
  if (maxPercentage >= 80) return { status: 'limited', percentage: maxPercentage };
  return { status: 'available', percentage: maxPercentage };
}

/**
 * GET /api/servers/locations
 * Retrieve available public locations with capacity status for server creation
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
        message: 'Authentication required to access server locations'
      }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getServerLocationsSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const filters = validation.data;
    const user = authResult.user;

    // Cache (per-user + filters)
    const t0 = Date.now();
    const bypass = shouldBypassCache(request.url);
    const cacheKey = makeKey([
      'server_locations', user.id,
      filters.server_type_id || '', filters.plan_id || '',
      filters.include_capacity ?? true, filters.include_stats ?? false,
      filters.sort_by, filters.sort_order
    ]);
    if (!bypass) {
      const cached = getCache<any>(cacheKey);
      const ifNoneMatch = request.headers.get('if-none-match') || '';
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value);
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { status: 304, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } });
        }
        return NextResponse.json(cached.value, { status: 200, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } });
      }
    }

    // Get public locations that are active and available for users
    const locations = await locationOperations.getPublicLocations();
    
    // Filter locations based on status and availability
    const availableLocations = locations.filter(location => 
      location.status === LocationStatus.ACTIVE &&
      location.visibility === LocationVisibility.PUBLIC
    );

    // Transform locations for API response
    const transformedLocations = availableLocations.map(location => {
      const capacityStatus = getCapacityStatus(location);
      
      return {
        id: location.id,
        name: location.name,
        description: location.description,
        short_code: location.short_code,
        country: location.country,
        region: location.region,
        city: location.city,
        priority: location.priority,
        status: location.status,
        visibility: location.visibility,
        
        // Capacity information
        capacity_status: capacityStatus.status,
        capacity_percentage: Math.round(capacityStatus.percentage),
        
        // Available resources (if capacity info is included)
        ...(filters.include_capacity && location.total_capacity && location.current_usage ? {
          available_resources: {
            memory: Math.max(0, location.total_capacity.memory - location.current_usage.memory),
            disk: Math.max(0, location.total_capacity.disk - location.current_usage.disk),
            cpu: Math.max(0, location.total_capacity.cpu - location.current_usage.cpu)
          },
          total_capacity: location.total_capacity,
          current_usage: location.current_usage
        } : {}),
        
        // Node information
        associated_nodes: location.associated_nodes?.length || 0,
        
        // Features
        features: location.features,
        
        // Network information
        network: location.network,
        
        // Metadata
        created_at: location.created_at,
        updated_at: location.updated_at
      };
    });

    // Sort locations based on sort criteria
    const sortedLocations = transformedLocations.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sort_by) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '');
          break;
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'capacity':
          comparison = a.capacity_percentage - b.capacity_percentage;
          break;
        default:
          comparison = a.priority - b.priority;
      }
      
      return filters.sort_order === 'desc' ? -comparison : comparison;
    });

    // Get statistics if requested
    let stats = null;
    if (filters.include_stats) {
      const totalCapacity = availableLocations.reduce((acc, loc) => ({
        memory: acc.memory + (loc.total_capacity?.memory || 0),
        disk: acc.disk + (loc.total_capacity?.disk || 0),
        cpu: acc.cpu + (loc.total_capacity?.cpu || 0)
      }), { memory: 0, disk: 0, cpu: 0 });

      const totalUsage = availableLocations.reduce((acc, loc) => ({
        memory: acc.memory + (loc.current_usage?.memory || 0),
        disk: acc.disk + (loc.current_usage?.disk || 0),
        cpu: acc.cpu + (loc.current_usage?.cpu || 0)
      }), { memory: 0, disk: 0, cpu: 0 });

      stats = {
        total_locations: availableLocations.length,
        available_locations: sortedLocations.filter(l => l.capacity_status === 'available').length,
        limited_locations: sortedLocations.filter(l => l.capacity_status === 'limited').length,
        full_locations: sortedLocations.filter(l => l.capacity_status === 'full').length,
        total_nodes: availableLocations.reduce((acc, loc) => acc + (loc.associated_nodes?.length || 0), 0),
        total_capacity: totalCapacity,
        total_usage: totalUsage,
        average_capacity_usage: totalCapacity.memory > 0 ? Math.round((totalUsage.memory / totalCapacity.memory) * 100) : 0
      };
    }

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
    };

    const payload = {
      success: true,
      message: 'Server locations retrieved successfully',
      locations: sortedLocations,
      stats: stats,
      user_permissions: {
        can_create_servers: user.role <= 1, // Users and admins can create servers
        max_servers: user.max_servers || null,
        requires_verification: !user.verified,
        current_balance: user.coins || 0
      }
    };

    const etag = makeETagFromObject(payload);
    if (!bypass) setCache(cacheKey, payload, 60_000, { ...responseHeaders, ETag: etag }, etag);

    return NextResponse.json(payload, {
      status: 200,
      headers: { ...responseHeaders, ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` }
    });

  } catch (error) {
    console.error('GET /api/servers/locations error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving server locations'
    }, { status: 500 });
  }
}
