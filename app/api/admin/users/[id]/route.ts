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
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache'
import { requireAdmin } from '@/lib/auth/middleware'

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
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    // Await params before accessing properties
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid user ID'
      }, { status: 400 });
    }

    // TTL cache for user details
    const t0 = Date.now()
    const bypass = shouldBypassCache(request.url)
    const cacheKey = makeKey(['admin_user_detail', admin.user!.id, userId])
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

    // Get user data using the dedicated getUserById method
    const result = await AdminGetUsersController.getUserById(
      userId,
      admin.user!.id
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message || 'User not found'
      }, { status: 404 });
    }

    const payload = {
      success: true,
      message: 'User retrieved successfully',
      users: result.users,
      user: result.users?.[0]
    }

    const etag = makeETagFromObject(payload)
    if (!bypass) setCache(cacheKey, payload, 20_000, { ETag: etag }, etag)

    // Return the user data
    return NextResponse.json(payload, { status: 200, headers: { ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` } });

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
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

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
      admin.user!.id,
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
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

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
    if (userId === admin.user!.id) {
      return NextResponse.json({
        success: false,
        message: 'Cannot delete your own account'
      }, { status: 400 });
    }

    // Use deleteUser controller
    const result = await AdminDeleteUserController.deleteUser(
      userId,
      admin.user!.id,
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
