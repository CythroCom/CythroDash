/**
 * CythroDash - Admin Plan Validation API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanController } from '@/hooks/managers/controller/Admin/PlanController';

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
 * GET /api/admin/plans/[id]/validate?location_id=xxx
 * Validate plan for a specific location
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

    // Get location_id from query parameters
    const url = new URL(request.url);
    const locationId = url.searchParams.get('location_id');
    
    if (!locationId || locationId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Location ID is required'
      }, { status: 400 });
    }

    // Validate plan using the controller
    const result = await PlanController.validatePlan(
      planId,
      locationId,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: 'Failed to validate plan'
      }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('GET /api/admin/plans/[id]/validate error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while validating plan'
    }, { status: 500 });
  }
}
