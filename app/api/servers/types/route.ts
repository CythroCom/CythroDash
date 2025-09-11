/**
 * CythroDash - Server Types API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { serverTypeOperations } from '@/hooks/managers/database/server-type';
import { ServerTypeCategory } from '@/database/tables/cythro_dash_server_types';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache';

// Input validation schema for GET request
const getServerTypesSchema = z.object({
  category: z.nativeEnum(ServerTypeCategory).optional(),
  featured: z.coerce.boolean().optional(),
  popular: z.coerce.boolean().optional(),
  location_id: z.string().optional(),
  plan_id: z.string().optional(),
  search: z.string().optional(),
  include_stats: z.coerce.boolean().optional(),
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
 * GET /api/servers/types
 * Retrieve available server types with filtering and user-specific availability
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
        message: 'Authentication required to access server types'
      }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getServerTypesSchema.safeParse(queryParams);
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
      'server_types', user.id,
      filters.category || '', filters.featured ?? '', filters.popular ?? '',
      filters.location_id || '', filters.plan_id || '', filters.search || '',
      filters.include_stats ?? false
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

    // Build filters for server type query
    const serverTypeFilters: any = {
      userId: user.id,
      userRole: user.role,
      isVerified: user.verified || false
    };

    // Add optional filters
    if (filters.category) {
      serverTypeFilters.category = filters.category;
    }

    if (filters.featured !== undefined) {
      serverTypeFilters.featured = filters.featured;
    }

    if (filters.popular !== undefined) {
      serverTypeFilters.popular = filters.popular;
    }

    if (filters.location_id) {
      serverTypeFilters.locationId = filters.location_id;
    }

    if (filters.plan_id) {
      serverTypeFilters.planId = filters.plan_id;
    }

    // Get server types based on filters and user permissions
    let serverTypes;
    if (filters.search) {
      // Search functionality
      const allTypes = await serverTypeOperations.searchServerTypes(filters.search, 50);
      // Filter based on user permissions
      const userTypes = await serverTypeOperations.getServerTypesForUser(
        user.id, 
        user.role, 
        user.verified || false
      );
      const userTypeIds = new Set(userTypes.map(t => t.id));
      serverTypes = allTypes
        .filter(t => userTypeIds.has(t.id))
        .map(t => ({
          id: t.id,
          name: t.name,
          short_description: t.short_description,
          category: t.category,
          icon: t.display_config.icon,
          popular: t.popular,
          featured: t.featured,
          new: t.new,
          min_resources: {
            memory: t.resource_requirements.min_memory,
            disk: t.resource_requirements.min_disk,
            cpu: t.resource_requirements.min_cpu,
          },
        }));
    } else {
      // Regular filtered query
      serverTypes = await serverTypeOperations.getServerTypeSummaries(serverTypeFilters);
    }

    // Get statistics if requested (user-filtered, to match returned data)
    let stats = null;
    if (filters.include_stats) {
      // Initialize categories count with all categories set to 0
      const categoriesInit: Record<string, number> = {} as any;
      Object.values(ServerTypeCategory).forEach(cat => { categoriesInit[cat] = 0 })

      // serverTypes may be summaries; count by available fields
      const totals = serverTypes.reduce((acc: any, st: any) => {
        const cat = st.category || 'other'
        acc.categories[cat] = (acc.categories[cat] || 0) + 1
        if (st.featured) acc.featured_count++
        if (st.popular) acc.popular_count++
        acc.total_types++
        acc.active_types++ // all returned are active/user-available
        return acc
      }, { total_types: 0, active_types: 0, categories: { ...categoriesInit }, featured_count: 0, popular_count: 0 })

      stats = totals
    }

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
    };

    const payload = {
      success: true,
      message: 'Server types retrieved successfully',
      server_types: serverTypes,
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
    console.error('GET /api/servers/types error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving server types'
    }, { status: 500 });
  }
}
