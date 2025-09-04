/**
 * CythroDash - Admin Plan Locations API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanController } from '@/hooks/managers/controller/Admin/PlanController';
import { z } from 'zod';

// Input validation schema for POST request (add location)
const addLocationSchema = z.object({
  location_id: z.string().min(1),
});

// Input validation schema for DELETE request (remove location)
const removeLocationSchema = z.object({
  location_id: z.string().min(1),
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
 * POST /api/admin/plans/[id]/locations
 * Add a location to a plan
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
    const planId = resolvedParams.id;
    
    if (!planId || planId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid plan ID'
      }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = addLocationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { location_id } = validation.data;

    // Add location to plan using the controller
    const result = await PlanController.addLocationToPlan(
      planId,
      location_id,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('POST /api/admin/plans/[id]/locations error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while adding location to plan'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/plans/[id]/locations
 * Remove a location from a plan
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

    // Parse and validate request body
    const body = await request.json();
    const validation = removeLocationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { location_id } = validation.data;

    // Remove location from plan using the controller
    const result = await PlanController.removeLocationFromPlan(
      planId,
      location_id,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('DELETE /api/admin/plans/[id]/locations error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while removing location from plan'
    }, { status: 500 });
  }
}
