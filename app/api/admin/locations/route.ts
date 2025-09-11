/**
 * CythroDash - Admin Locations API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocationController, GetLocationsRequest, CreateLocationRequest } from '@/hooks/managers/controller/Admin/LocationController';
import { LocationStatus, LocationVisibility } from '@/database/tables/cythro_dash_locations';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache'
import { compressedJson } from '@/lib/compress'
import { requireAdmin } from '@/lib/auth/middleware'

// Input validation schema for GET request
const getLocationsSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.nativeEnum(LocationStatus).optional(),
  visibility: z.nativeEnum(LocationVisibility).optional(),
  sort_by: z.enum(['name', 'short_code', 'priority', 'created_at', 'status']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  include_capacity: z.coerce.boolean().optional(),
  include_nodes: z.coerce.boolean().optional(),
});

// Input validation schema for POST request
const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  short_code: z.string().min(1).max(10),
  country: z.string().max(50).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  pterodactyl_location_id: z.number().int().min(1),
  associated_nodes: z.array(z.number().int().min(1)).optional(),
  status: z.nativeEnum(LocationStatus).optional(),
  visibility: z.nativeEnum(LocationVisibility).optional(),
  priority: z.number().int().min(0).optional(),
  max_servers_per_user: z.number().int().min(1).optional(),
  allowed_server_types: z.array(z.string()).optional(),
  features: z.object({
    ddos_protection: z.boolean().optional(),
    backup_storage: z.boolean().optional(),
    high_availability: z.boolean().optional(),
    ssd_storage: z.boolean().optional(),
  }).optional(),
  network: z.object({
    ipv4_available: z.boolean().optional(),
    ipv6_available: z.boolean().optional(),
    port_range_start: z.number().int().min(1).max(65535).optional(),
    port_range_end: z.number().int().min(1).max(65535).optional(),
  }).optional(),
});



/**
 * GET /api/admin/locations
 * Retrieve locations with filtering, pagination, and sorting
 */
export async function GET(request: NextRequest) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request)
    if (!admin.success) return admin.response!

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validation = getLocationsSchema.safeParse(queryParams);
    if (!validation.success) {
      return compressedJson(request, { success: false, message: 'Invalid query parameters', errors: validation.error.errors }, 400)
    }

    const getLocationsRequest: GetLocationsRequest = validation.data;

    // Cache lookup
    const t0 = Date.now()
    const bypass = shouldBypassCache(request.url)
    const cacheKey = makeKey(['admin_locations', admin.user!.id, JSON.stringify(getLocationsRequest)])
    if (!bypass) {
      const cached = getCache<any>(cacheKey)
      const ifNoneMatch = request.headers.get('if-none-match') || ''
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value)
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { status: 304, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } })
        }
        return compressedJson(request, cached.value, 200, { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` })
      }
    }

    // Get locations using the controller
    const result = await LocationController.getLocations(
      getLocationsRequest,
      admin.user!.id
    );

    if (!result.success) {
      return compressedJson(request, result, 400)
    }

    // Store in cache with short TTL
    const etag = makeETagFromObject(result)
    if (!bypass) setCache(cacheKey, result, 20_000, { ETag: etag }, etag)
    return compressedJson(request, result, 200, { ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` })

  } catch (error) {
    console.error('GET /api/admin/locations error:', error);
    return compressedJson(request, { success: false, message: 'An unexpected error occurred while retrieving locations' }, 500)
  }
}

/**
 * POST /api/admin/locations
 * Create a new location
 */
export async function POST(request: NextRequest) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    // Parse and validate request body
    const body = await request.json();
    const validation = createLocationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const createLocationRequest: CreateLocationRequest = validation.data;

    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Create location using the controller
    const result = await LocationController.createLocation(
      createLocationRequest,
      admin.user!.id,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('POST /api/admin/locations error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while creating location'
    }, { status: 500 });
  }
}
