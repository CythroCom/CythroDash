/**
 * CythroDash - Admin Disable User API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminDisableUserController } from '@/hooks/managers/controller/Admin/disableUser';
import { z } from 'zod';

// Input validation schema for POST request
const disableUserSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  ban_duration_hours: z.number().int().min(1).optional(),
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
 * POST /api/admin/users/[id]/disable
 * Disable/ban a user
 */
export async function POST(
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
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid user ID'
      }, { status: 400 });
    }

    // Prevent disabling yourself
    if (userId === authResult.user.id) {
      return NextResponse.json({
        success: false,
        message: 'Cannot disable your own account'
      }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validation = disableUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid input data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { reason, ban_duration_hours } = validation.data;

    // Use banUser controller (disableUser is actually banUser in the controller)
    const result = await AdminDisableUserController.banUser(
      userId,
      reason || 'Disabled by administrator',
      authResult.user.id,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'User disabled successfully'
    });

  } catch (error) {
    console.error('POST /api/admin/users/[id]/disable error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while disabling user'
    }, { status: 500 });
  }
}
