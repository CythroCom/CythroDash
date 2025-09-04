/**
 * CythroDash - Admin Location Nodes API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocationController } from '@/hooks/managers/controller/Admin/LocationController';
import { z } from 'zod';

// Input validation schema for POST request (add node)
const addNodeSchema = z.object({
  node_id: z.number().int().min(1),
});

// Input validation schema for DELETE request (remove node)
const removeNodeSchema = z.object({
  node_id: z.number().int().min(1),
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
 * POST /api/admin/locations/[id]/nodes
 * Add a node to a location
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
    const locationId = resolvedParams.id;
    
    if (!locationId || locationId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid location ID'
      }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = addNodeSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { node_id } = validation.data;

    // Add node to location using the controller
    const result = await LocationController.addNodeToLocation(
      locationId,
      node_id,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('POST /api/admin/locations/[id]/nodes error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while adding node to location'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/locations/[id]/nodes
 * Remove a node from a location
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
    const locationId = resolvedParams.id;
    
    if (!locationId || locationId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid location ID'
      }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = removeNodeSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { node_id } = validation.data;

    // Remove node from location using the controller
    const result = await LocationController.removeNodeFromLocation(
      locationId,
      node_id,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('DELETE /api/admin/locations/[id]/nodes error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while removing node from location'
    }, { status: 500 });
  }
}
