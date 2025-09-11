/**
 * CythroDash - Admin Users API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminGetUsersController, GetUsersRequest } from '@/hooks/managers/controller/Admin/getUsers';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache'
import { requireAdmin } from '@/lib/auth/middleware'

// Input validation schema for GET request
const getUsersSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
  role: z.coerce.number().optional(),
  verified: z.coerce.boolean().optional(),
  banned: z.coerce.boolean().optional(),
  deleted: z.coerce.boolean().optional(),
  has_two_factor: z.coerce.boolean().optional(),
  created_after: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  created_before: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  last_login_after: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  last_login_before: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  sort_by: z.enum(['id', 'username', 'email', 'created_at', 'last_login', 'coins', 'total_servers_created']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  include_stats: z.coerce.boolean().optional(),
  include_oauth: z.coerce.boolean().optional(),
  include_referrals: z.coerce.boolean().optional(),
});


/**
 * GET /api/admin/users
 * Retrieve users with filtering, pagination, and sorting
 */
export async function GET(request: NextRequest) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getUsersSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const getUsersRequest: GetUsersRequest = validation.data;

    // Simple TTL cache for admin users list
    const t0 = Date.now()
    const bypass = shouldBypassCache(request.url)
    const cacheKey = makeKey(['admin_users', admin.user!.id, JSON.stringify(getUsersRequest)])
    if (!bypass) {
      const cached = getCache<any>(cacheKey)
      const ifNoneMatch = request.headers.get('if-none-match') || ''
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value)
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { status: 304, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } })
        }
        return NextResponse.json(cached.value, { status: 200, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } })
      }
    }

    // Get users using the controller
    const result = await AdminGetUsersController.getUsers(
      getUsersRequest,
      admin.user!.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Store in cache with short TTL
    const etag = makeETagFromObject(result)
    if (!bypass) setCache(cacheKey, result, 20_000, { ETag: etag }, etag)
    return NextResponse.json(result, { status: 200, headers: { ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` } });

  } catch (error) {
    console.error('Error in admin users API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}


