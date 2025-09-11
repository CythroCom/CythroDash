/**
 * CythroDash - Admin Servers API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverOperations, ServerFilters } from '@/hooks/managers/database/servers';
import { ServerStatus, BillingStatus, PowerState } from '@/database/tables/cythro_dash_servers';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache';
import { compressedJson } from '@/lib/compress';
import { requireAdmin } from '@/lib/auth/middleware';

// Input validation schema for GET request
const getServersSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.nativeEnum(ServerStatus).optional(),
  billing_status: z.nativeEnum(BillingStatus).optional(),
  power_state: z.nativeEnum(PowerState).optional(),
  server_type_id: z.string().optional(),
  location_id: z.string().optional(),
  user_id: z.coerce.number().optional(),
  sort_by: z.enum(['name', 'created_at', 'updated_at', 'status', 'user_id']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  include_stats: z.coerce.boolean().optional(),
});

// Input validation schema for POST request (server creation)
const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  user_id: z.number().int().min(1),
  server_type_id: z.string().min(1),
  software_id: z.string().min(1),
  location_id: z.string().min(1),
  plan_id: z.string().min(1),
  environment_variables: z.record(z.string()).optional(),
  startup_command: z.string().optional(),
  docker_image: z.string().optional(),
});



/**
 * GET /api/admin/servers
 * Retrieve servers with filtering, pagination, and sorting
 */
export async function GET(request: NextRequest) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validation = getServersSchema.safeParse(queryParams);
    if (!validation.success) {
      return compressedJson(request, { 
        success: false, 
        message: 'Invalid query parameters', 
        errors: validation.error.errors 
      }, 400);
    }

    const filters = validation.data;

    // Cache lookup
    const t0 = Date.now();
    const bypass = shouldBypassCache(request.url);
    const cacheKey = makeKey(['admin_servers', admin.user!.id, JSON.stringify(filters)]);
    if (!bypass) {
      const cached = getCache<any>(cacheKey);
      const ifNoneMatch = request.headers.get('if-none-match') || '';
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value);
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { 
            status: 304, 
            headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } 
          });
        }
        return compressedJson(request, cached.value, 200, { 
          ETag: etag, 
          'X-Cache': 'HIT', 
          'X-Response-Time': `${Date.now()-t0}ms` 
        });
      }
    }

    // Build server filters
    const serverFilters: ServerFilters = {};
    if (filters.user_id) serverFilters.user_id = filters.user_id;
    if (filters.status) serverFilters.status = filters.status;
    if (filters.billing_status) serverFilters.billing_status = filters.billing_status;
    if (filters.power_state) serverFilters.power_state = filters.power_state;
    if (filters.server_type_id) serverFilters.server_type_id = filters.server_type_id;
    if (filters.location_id) serverFilters.location_id = filters.location_id;
    if (filters.search) serverFilters.search = filters.search;

    // Get servers from database
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const skip = (page - 1) * limit;

    const servers = await serverOperations.getServers(serverFilters, limit, skip);
    
    // Get total count for pagination
    const totalServers = await serverOperations.getServers(serverFilters);
    const totalCount = totalServers.length;

    // Calculate stats if requested
    let stats = null;
    if (filters.include_stats) {
      const allServers = await serverOperations.getServers({});
      stats = {
        total_servers: allServers.length,
        active_servers: allServers.filter(s => s.status === ServerStatus.ACTIVE).length,
        suspended_servers: allServers.filter(s => s.status === ServerStatus.SUSPENDED).length,
        creating_servers: allServers.filter(s => s.status === ServerStatus.CREATING).length,
        error_servers: allServers.filter(s => s.status === ServerStatus.ERROR).length,
        online_servers: allServers.filter(s => s.power_state === PowerState.ONLINE).length,
        offline_servers: allServers.filter(s => s.power_state === PowerState.OFFLINE).length,
      };
    }

    const result = {
      success: true,
      message: 'Servers retrieved successfully',
      servers,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        total_items: totalCount,
        items_per_page: limit
      },
      stats
    };

    // Store in cache with short TTL
    const etag = makeETagFromObject(result);
    if (!bypass) setCache(cacheKey, result, 15_000, { ETag: etag }, etag); // 15 seconds TTL
    return compressedJson(request, result, 200, { 
      ETag: etag, 
      'X-Cache': bypass ? 'BYPASS' : 'MISS', 
      'X-Response-Time': `${Date.now()-t0}ms` 
    });

  } catch (error) {
    console.error('GET /api/admin/servers error:', error);
    return compressedJson(request, { 
      success: false, 
      message: 'An unexpected error occurred while retrieving servers' 
    }, 500);
  }
}

/**
 * POST /api/admin/servers
 * Create a new server (admin-initiated)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

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

    const serverData = validation.data;

    // Use the existing ServersController to create the server
    const { ServersController } = await import('@/hooks/managers/controller/User/Servers');
    
    const result = await ServersController.createServer(serverData.user_id, {
      name: serverData.name,
      description: serverData.description,
      server_type_id: serverData.server_type_id,
      software_id: serverData.software_id,
      location_id: serverData.location_id,
      plan_id: serverData.plan_id,
      environment_variables: serverData.environment_variables,
      startup_command: serverData.startup_command,
      docker_image: serverData.docker_image,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('POST /api/admin/servers error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while creating server'
    }, { status: 500 });
  }
}
