/**
 * CythroDash - Server Software API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { serverSoftwareOperations } from '@/hooks/managers/database/server-software';
import { serverTypeOperations } from '@/hooks/managers/database/server-type';
import { SoftwareStability, ServerSoftwareHelpers } from '@/database/tables/cythro_dash_server_software';
import { ServerTypeHelpers } from '@/database/tables/cythro_dash_server_types';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache';

// Input validation schema for GET request
const getServerSoftwareSchema = z.object({
  server_type_id: z.string().min(1, 'Server type ID is required'),
  stability: z.nativeEnum(SoftwareStability).optional(),
  featured: z.coerce.boolean().optional(),
  recommended: z.coerce.boolean().optional(),
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
 * GET /api/servers/software
 * Retrieve available server software for a specific server type with filtering and user-specific availability
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
        message: 'Authentication required to access server software'
      }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getServerSoftwareSchema.safeParse(queryParams);
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
      'server_software', user.id,
      filters.server_type_id,
      filters.stability || '', filters.featured ?? '', filters.recommended ?? '',
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

    // Accumulator for stats from the same dataset we return
    let serverSoftwareRaw: any[] = []

    // Validate that the server type exists and user has access to it
    const serverType = await serverTypeOperations.getServerTypeById(filters.server_type_id);
    if (!serverType) {
      return NextResponse.json({
        success: false,
        message: 'Server type not found or not available'
      }, { status: 404 });
    }

    // Check if user has access to this server type (consistent with /types logic)
    const hasAccess = ServerTypeHelpers.isAvailableForUser(
      serverType,
      user.role,
      user.verified || false,
      user.id
    );

    if (!hasAccess) {
      // Do not hard-fail the wizard. Return empty software list with 200 OK so UI can proceed gracefully
      const responseHeaders = {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
      };
      return NextResponse.json({
        success: true,
        message: 'No software available for this server type with your current permissions',
        server_type: { id: serverType.id, name: serverType.name, category: serverType.category },
        server_software: [],
        stats: null,
        user_permissions: {
          can_create_servers: user.role <= 1,
          max_servers: user.max_servers || null,
          requires_verification: !user.verified,
          current_balance: user.coins || 0
        }
      }, { status: 200, headers: responseHeaders });
    }

    // Build filters for server software query
    const serverSoftwareFilters: any = {
      serverTypeId: filters.server_type_id,
      userId: user.id,
      userRole: user.role,
      isVerified: user.verified || false
    };

    // Add optional filters
    if (filters.stability) {
      serverSoftwareFilters.stability = filters.stability;
    }

    if (filters.featured !== undefined) {
      serverSoftwareFilters.featured = filters.featured;
    }

    if (filters.recommended !== undefined) {
      serverSoftwareFilters.recommended = filters.recommended;
    }

    if (filters.location_id) {
      serverSoftwareFilters.locationId = filters.location_id;
    }

    if (filters.plan_id) {
      serverSoftwareFilters.planId = filters.plan_id;
    }

    // Get server software based on filters and user permissions
    let serverSoftware;
    if (filters.search) {
      // Search functionality
      const allSoftware = await serverSoftwareOperations.searchServerSoftware(filters.search, 50);
      // Filter based on user permissions and server type
      const userSoftware = await serverSoftwareOperations.getServerSoftwareForUser(
        user.id,
        user.role,
        user.verified || false
      );
      const userSoftwareIds = new Set(userSoftware.map(s => s.id));
      serverSoftwareRaw = allSoftware.filter(s => userSoftwareIds.has(s.id) && s.server_type_id === filters.server_type_id)
      serverSoftware = serverSoftwareRaw
        .map(s => ({
          id: s.id,
          name: s.name,
          short_description: s.short_description,
          stability: s.stability,
          icon: s.icon,
          recommended: s.recommended,
          latest: s.latest,
          version: s.version_info?.version || 'Unknown',
          min_resources: {
            memory: s.resource_overrides?.min_memory || 0,
            disk: s.resource_overrides?.min_disk || 0,
            cpu: s.resource_overrides?.min_cpu || 0,
          },
          docker_image: s.docker_config?.image || '',
          startup_command: s.docker_config?.startup_command || ''
        }));
    } else {
      // Regular filtered query using code-based filtering to avoid DB special cases
      const allSoftware = await serverSoftwareOperations.getActiveServerSoftware()
      const applyAccess = (s: any) => {
        const ar = s.access_restrictions
        if (!ar) return true
        if (typeof ar.min_user_role === 'number' && user.role > ar.min_user_role) return false
        if (ar.requires_verification === true && !(user.verified || false)) return false
        if (Array.isArray(ar.whitelist_users) && ar.whitelist_users.length > 0) {
          if (!ar.whitelist_users.includes(user.id)) return false
        }
        return true
      }
      const byProps = (s: any) => {
        if (filters.stability && s.stability !== filters.stability) return false
        if (filters.featured !== undefined && !!s.featured !== !!filters.featured) return false
        if (filters.recommended !== undefined && !!s.recommended !== !!filters.recommended) return false
        return true
      }
      const serverSoftwareRaw = allSoftware
        .filter(s => s.server_type_id === filters.server_type_id)
        .filter(byProps)
        .filter(applyAccess)
      serverSoftware = serverSoftwareRaw.map((s) => ({
        id: s.id,
        name: s.name,
        short_description: s.short_description,
        stability: s.stability,
        icon: s.icon,
        recommended: s.recommended,
        latest: s.latest,
        version: s.version_info?.version || 'Unknown',
        // Compute effective min requirements using server type base + overrides
        ...(() => { const eff = (ServerSoftwareHelpers as any).getResourceRequirements
          ? (ServerSoftwareHelpers as any).getResourceRequirements(s, serverType.resource_requirements)
          : { min_memory: s.resource_overrides?.min_memory || 0, min_disk: s.resource_overrides?.min_disk || 0, min_cpu: s.resource_overrides?.min_cpu || 0 }
        ; return { min_resources: { memory: eff.min_memory, disk: eff.min_disk, cpu: eff.min_cpu } } })(),
        docker_image: s.docker_config?.image || '',
        startup_command: s.docker_config?.startup_command || ''
      }))
    }

    // Get statistics if requested (based on returned dataset)
    let stats = null;
    if (filters.include_stats) {
      const list = Array.isArray(serverSoftware) ? serverSoftware : []
      const stability_types = { stable: 0, beta: 0, alpha: 0, experimental: 0 } as any
      for (const item of list as any[]) {
        const key = String(item.stability).toLowerCase()
        if (key in stability_types) stability_types[key]++
      }
      stats = {
        total_software: list.length,
        active_software: list.length,
        stability_types,
        featured_count: 0, // not part of mapped shape; can be added if needed
        recommended_count: (list as any[]).filter((s: any) => !!s.recommended).length,
      }
    }

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
    };

    const payload = {
      success: true,
      message: 'Server software retrieved successfully',
      server_type: {
        id: serverType.id,
        name: serverType.name,
        category: serverType.category
      },
      server_software: serverSoftware,
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
    console.error('GET /api/servers/software error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving server software'
    }, { status: 500 });
  }
}
