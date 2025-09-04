/**
 * CythroDash - Admin Individual Location API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LocationController, UpdateLocationRequest } from '@/hooks/managers/controller/Admin/LocationController';
import { LocationStatus, LocationVisibility } from '@/database/tables/cythro_dash_locations';
import { z } from 'zod';

// Input validation schema for PATCH request
const updateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  short_code: z.string().min(1).max(10).optional(),
  country: z.string().max(50).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  pterodactyl_location_id: z.number().int().min(1).optional(),
  associated_nodes: z.array(z.number().int().min(1)).optional(),
  status: z.nativeEnum(LocationStatus).optional(),
  visibility: z.nativeEnum(LocationVisibility).optional(),
  priority: z.number().int().min(0).optional(),
  max_servers_per_user: z.number().int().min(1).optional(),
  allowed_server_types: z.array(z.string()).optional(),
  features: z.object({
    ddos_protection: z.boolean().optional(),
    backup_storage: z.boolean().optional(),
    high_availability: z.boolean().optional(),
    ssd_storage: z.boolean().optional(),
  }).optional(),
  network: z.object({
    ipv4_available: z.boolean().optional(),
    ipv6_available: z.boolean().optional(),
    port_range_start: z.number().int().min(1).max(65535).optional(),
    port_range_end: z.number().int().min(1).max(65535).optional(),
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
 * GET /api/admin/locations/[id]
 * Get individual location details
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
    const locationId = resolvedParams.id;
    
    if (!locationId || locationId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid location ID'
      }, { status: 400 });
    }

    // Get location data using the controller
    const result = await LocationController.getLocationById(
      locationId,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message || 'Location not found'
      }, { status: 404 });
    }

    // Return the location data
    return NextResponse.json({
      success: true,
      message: 'Location retrieved successfully',
      location: result.location
    });

  } catch (error) {
    console.error('GET /api/admin/locations/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving location'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/locations/[id]
 * Update location information
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
    const locationId = resolvedParams.id;
    
    if (!locationId || locationId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid location ID'
      }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateLocationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const updateLocationRequest: UpdateLocationRequest = validation.data;

    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Update location using the controller
    const result = await LocationController.updateLocation(
      locationId,
      updateLocationRequest,
      authResult.user.id,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('PATCH /api/admin/locations/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while updating location'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/locations/[id]
 * Delete (disable) a location
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

    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Delete location using the controller
    const result = await LocationController.deleteLocation(
      locationId,
      authResult.user.id,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('DELETE /api/admin/locations/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while deleting location'
    }, { status: 500 });
  }
}
