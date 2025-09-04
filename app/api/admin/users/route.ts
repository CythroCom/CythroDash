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

/**
 * GET /api/admin/users
 * Retrieve users with filtering, pagination, and sorting
 */
export async function GET(request: NextRequest) {
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

    // Get users using the controller
    const result = await AdminGetUsersController.getUsers(
      getUsersRequest,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error in admin users API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/users/[id]
 * Retrieve a specific user by ID
 */
export async function getUserById(request: NextRequest, { params }: { params: { id: string } }) {
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

    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid user ID'
      }, { status: 400 });
    }

    // Get user using the controller
    const result = await AdminGetUsersController.getUserById(
      userId,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error in admin get user by ID API:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

