/**
 * CythroDash - Admin Plans API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanController, GetPlansRequest, CreatePlanRequest } from '@/hooks/managers/controller/Admin/PlanController';
import { PlanStatus, BillingCycle } from '@/database/tables/cythro_dash_plans';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache'
import { compressedJson } from '@/lib/compress'

// Input validation schema for GET request
const getPlansSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  billing_cycle: z.nativeEnum(BillingCycle).optional(),
  location_id: z.string().optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  popular: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  premium: z.coerce.boolean().optional(),
  sort_by: z.enum(['name', 'price', 'display_order', 'created_at', 'status']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  include_stats: z.coerce.boolean().optional(),
  include_promotions: z.coerce.boolean().optional(),
});

// Input validation schema for POST request
const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tagline: z.string().max(200).optional(),
  resources: z.object({
    memory: z.number().int().min(1),
    disk: z.number().int().min(1),
    cpu: z.number().min(0.1),
    swap: z.number().int().min(0),
    io: z.number().int().min(100).max(1000),
    databases: z.number().int().min(0),
    allocations: z.number().int().min(1),
    backups: z.number().int().min(0),
    threads: z.string().optional(),
    oom_disabled: z.boolean().optional(),
  }),
  price: z.number().min(0),
  billing_cycle: z.nativeEnum(BillingCycle),
  billing_cycle_value: z.string().regex(/^([1-9][0-9]*)\s*(m|h|d|w|month|y)$/).optional(),
  setup_fee: z.number().min(0).optional(),
  available_locations: z.array(z.string()),
  status: z.nativeEnum(PlanStatus).optional(),
  popular: z.boolean().optional(),
  premium: z.boolean().optional(),
  featured: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  color_scheme: z.string().optional(),
  features: z.object({
    priority_support: z.boolean(),
    ddos_protection: z.boolean(),
    automatic_backups: z.boolean(),
    custom_jar_upload: z.boolean(),
    ftp_access: z.boolean(),
    mysql_databases: z.boolean(),
    subdomain_included: z.boolean(),
    custom_startup: z.boolean(),
  }),
  restrictions: z.object({
    min_user_role: z.number().int().min(0).optional(),
    max_servers_per_user: z.number().int().min(1).optional(),
    allowed_server_types: z.array(z.string()).optional(),
    blocked_server_types: z.array(z.string()).optional(),
    requires_verification: z.boolean().optional(),
  }).optional(),
  quotas: z.object({
    max_concurrent_servers: z.number().int().min(1).optional(),
    bandwidth_limit: z.number().int().min(0).optional(),
    storage_limit: z.number().int().min(0).optional(),
    api_requests_limit: z.number().int().min(0).optional(),
  }).optional(),
  promotion: z.object({
    discount_percentage: z.number().min(0).max(100).optional(),
    discount_amount: z.number().min(0).optional(),
    valid_until: z.string().datetime().optional(),
    promo_code: z.string().optional(),
  }).optional(),
});

// Authentication function following the established pattern
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('session_token')?.value;

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

/**
 * GET /api/admin/plans
 * Retrieve plans with filtering, pagination, and sorting
 */
export async function GET(request: NextRequest) {
  try {
    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return compressedJson(request, { success: false, message: 'Authentication required' }, 401)
    }

    // Check admin permissions (role 0 = admin)
    if (authResult.user.role !== 0) {
      return compressedJson(request, { success: false, message: 'Admin access required' }, 403)
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validation = getPlansSchema.safeParse(queryParams);
    if (!validation.success) {
      return compressedJson(request, { success: false, message: 'Invalid query parameters', errors: validation.error.errors }, 400)
    }

    const getPlansRequest: GetPlansRequest = validation.data;

    // Cache lookup
    const t0 = Date.now()
    const bypass = shouldBypassCache(request.url)
    const cacheKey = makeKey(['admin_plans', authResult.user.id, JSON.stringify(getPlansRequest)])
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

    // Get plans using the controller
    const result = await PlanController.getPlans(
      getPlansRequest,
      authResult.user.id
    );

    if (!result.success) {
      return compressedJson(request, result, 400)
    }

    const etag = makeETagFromObject(result)
    if (!bypass) setCache(cacheKey, result, 20_000, { ETag: etag }, etag)
    return compressedJson(request, result, 200, { ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` })

  } catch (error) {
    console.error('GET /api/admin/plans error:', error);
    return compressedJson(request, { success: false, message: 'An unexpected error occurred while retrieving plans' }, 500)
  }
}

/**
 * POST /api/admin/plans
 * Create a new plan
 */
export async function POST(request: NextRequest) {
  try {
    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    // Check admin permissions (role 0 = admin)
    if (authResult.user.role !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Admin access required'
      }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();

    const validation = createPlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    // Convert promotion.valid_until string to Date if present
    const createPlanRequest: CreatePlanRequest = {
      ...validation.data,
      promotion: validation.data.promotion ? {
        ...validation.data.promotion,
        valid_until: validation.data.promotion.valid_until ? new Date(validation.data.promotion.valid_until) : undefined
      } : undefined
    };

    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Create plan using the controller
    const result = await PlanController.createPlan(
      createPlanRequest,
      authResult.user.id,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('POST /api/admin/plans error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while creating plan'
    }, { status: 500 });
  }
}
