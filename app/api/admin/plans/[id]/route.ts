/**
 * CythroDash - Admin Individual Plan API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanController, UpdatePlanRequest } from '@/hooks/managers/controller/Admin/PlanController';
import { PlanStatus, BillingCycle } from '@/database/tables/cythro_dash_plans';
import { z } from 'zod';

// Input validation schema for PATCH request
const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tagline: z.string().max(200).optional(),
  resources: z.object({
    memory: z.number().int().min(1).optional(),
    disk: z.number().int().min(1).optional(),
    cpu: z.number().min(0.1).optional(),
    swap: z.number().int().min(0).optional(),
    io: z.number().int().min(100).max(1000).optional(),
    databases: z.number().int().min(0).optional(),
    allocations: z.number().int().min(1).optional(),
    backups: z.number().int().min(0).optional(),
    threads: z.string().optional(),
    oom_disabled: z.boolean().optional(),
  }).optional(),
  price: z.number().min(0).optional(),
  billing_cycle: z.nativeEnum(BillingCycle).optional(),
  billing_cycle_value: z.string().regex(/^([1-9][0-9]*)\s*(m|h|d|month|y)$/).optional(),
  setup_fee: z.number().min(0).optional(),
  available_locations: z.array(z.string()).optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  popular: z.boolean().optional(),
  premium: z.boolean().optional(),
  featured: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  color_scheme: z.string().optional(),
  features: z.object({
    priority_support: z.boolean().optional(),
    ddos_protection: z.boolean().optional(),
    automatic_backups: z.boolean().optional(),
    custom_jar_upload: z.boolean().optional(),
    ftp_access: z.boolean().optional(),
    mysql_databases: z.boolean().optional(),
    subdomain_included: z.boolean().optional(),
    custom_startup: z.boolean().optional(),
  }).optional(),
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
 * GET /api/admin/plans/[id]
 * Get individual plan details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    // Check admin role
    if (authResult.user.role !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Admin access required'
      }, { status: 403 });
    }

    // Await params before accessing properties
    const resolvedParams = await params;
    const planId = resolvedParams.id;
    
    if (!planId || planId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid plan ID'
      }, { status: 400 });
    }

    // Get plan data using the controller
    const result = await PlanController.getPlanById(
      planId,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message || 'Plan not found'
      }, { status: 404 });
    }

    // Return the plan data
    return NextResponse.json({
      success: true,
      message: 'Plan retrieved successfully',
      plan: result.plan
    });

  } catch (error) {
    console.error('GET /api/admin/plans/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving plan'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/plans/[id]
 * Update plan information
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    // Check admin role
    if (authResult.user.role !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Admin access required'
      }, { status: 403 });
    }

    // Await params before accessing properties
    const resolvedParams = await params;
    const planId = resolvedParams.id;
    
    if (!planId || planId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid plan ID'
      }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();

    const validation = updatePlanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    // Convert promotion.valid_until string to Date if present and ensure proper typing
    const updatePlanRequest: UpdatePlanRequest = {
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

    // Update plan using the controller
    const result = await PlanController.updatePlan(
      planId,
      updatePlanRequest,
      authResult.user.id,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('PATCH /api/admin/plans/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while updating plan'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/plans/[id]
 * Delete (disable) a plan
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    // Check admin role
    if (authResult.user.role !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Admin access required'
      }, { status: 403 });
    }

    // Await params before accessing properties
    const resolvedParams = await params;
    const planId = resolvedParams.id;
    
    if (!planId || planId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid plan ID'
      }, { status: 400 });
    }

    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Delete plan using the controller
    const result = await PlanController.deletePlan(
      planId,
      authResult.user.id,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('DELETE /api/admin/plans/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while deleting plan'
    }, { status: 500 });
  }
}
