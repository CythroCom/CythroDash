/**
 * CythroDash - Admin Individual User API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminGetUsersController } from '@/hooks/managers/controller/Admin/getUsers';
import { AdminUpdateUserController } from '@/hooks/managers/controller/Admin/updateUser';
import { AdminDeleteUserController } from '@/hooks/managers/controller/Admin/deleteUser';
import { z } from 'zod';

// Input validation schema for PATCH request
const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  display_name: z.string().max(100).optional(),
  role: z.number().int().min(0).max(1).optional(),
  verified: z.boolean().optional(),
  banned: z.boolean().optional(),
  two_factor_enabled: z.boolean().optional(),
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
 * GET /api/admin/users/[id]
 * Get individual user details
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
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid user ID'
      }, { status: 400 });
    }

    // Get user data using the dedicated getUserById method
    const result = await AdminGetUsersController.getUserById(
      userId,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message || 'User not found'
      }, { status: 404 });
    }

    // Return the user data
    return NextResponse.json({
      success: true,
      message: 'User retrieved successfully',
      users: result.users, // Keep array format for consistency with store
      user: result.users?.[0] // Also provide single user for convenience
    });

  } catch (error) {
    console.error('GET /api/admin/users/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving user'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user information
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
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid user ID'
      }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid input data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const updateData = validation.data;

    // Use updateUser controller
    const result = await AdminUpdateUserController.updateUser(
      userId,
      updateData,
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
      message: 'User updated successfully',
      user: result.user
    });

  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while updating user'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user permanently
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
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid user ID'
      }, { status: 400 });
    }

    // Prevent deleting yourself
    if (userId === authResult.user.id) {
      return NextResponse.json({
        success: false,
        message: 'Cannot delete your own account'
      }, { status: 400 });
    }

    // Use deleteUser controller
    const result = await AdminDeleteUserController.deleteUser(
      userId,
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
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('DELETE /api/admin/users/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while deleting user'
    }, { status: 500 });
  }
}
