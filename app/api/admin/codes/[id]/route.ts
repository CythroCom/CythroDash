/**
 * CythroDash - Admin Individual Code API
 * 
 * Admin endpoints for managing individual redeem codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { codeOperations } from '@/hooks/managers/database/codes';

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
        error: 'Authentication required'
      };
    }

    // Basic session token validation
    if (typeof sessionToken !== 'string' || sessionToken.length < 10) {
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
        console.error('Error parsing user data header:', parseError);
      }
    }

    return {
      success: false,
      error: 'User data not found in request headers'
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Input validation schema for updates
const updateCodeSchema = z.object({
  coins_value: z.number().int().min(1).max(10000).optional(),
  max_uses: z.number().int().min(0).max(1000000).optional(),
  expiry_date: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  is_active: z.boolean().optional(),
  description: z.string().max(500).optional(),
  internal_notes: z.string().max(1000).optional(),
  allowed_user_ids: z.array(z.number().int()).optional(),
  restricted_to_new_users: z.boolean().optional(),
});

/**
 * GET /api/admin/codes/[id]
 * Get individual code details with statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
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

    // Await params before accessing properties
    const resolvedParams = await params;
    const codeId = parseInt(resolvedParams.id);
    
    if (isNaN(codeId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid code ID'
      }, { status: 400 });
    }

    // Get code details
    const code = await codeOperations.getCodeById(codeId);
    if (!code) {
      return NextResponse.json({
        success: false,
        message: 'Code not found'
      }, { status: 404 });
    }

    // Get code statistics
    const statsResult = await codeOperations.getCodeStatistics(codeId);

    console.log('Retrieved code details:', {
      code_id: codeId,
      admin: authResult.user.username
    });

    return NextResponse.json({
      success: true,
      message: 'Code retrieved successfully',
      code,
      statistics: statsResult.success ? statsResult.stats : null
    });

  } catch (error) {
    console.error('Get code details error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve code details',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * PUT /api/admin/codes/[id]
 * Update a redeem code
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
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

    // Await params before accessing properties
    const resolvedParams = await params;
    const codeId = parseInt(resolvedParams.id);
    
    if (isNaN(codeId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid code ID'
      }, { status: 400 });
    }

    const requestData = await request.json();
    console.log('Update code request:', { 
      code_id: codeId,
      updates: Object.keys(requestData),
      admin: authResult.user.username 
    });

    // Validate input
    const inputValidation = updateCodeSchema.safeParse(requestData);
    if (!inputValidation.success) {
      console.log('Code update validation failed:', inputValidation.error.errors);
      return NextResponse.json({
        success: false,
        message: 'Invalid input data',
        errors: inputValidation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 });
    }

    const validatedData = inputValidation.data;

    // Update code
    const result = await codeOperations.updateCode(codeId, validatedData);

    if (result.success) {
      console.log('Code updated successfully:', {
        code_id: codeId,
        admin: authResult.user.username
      });
      
      return NextResponse.json({
        success: true,
        message: result.message,
        code: result.code
      });
    } else {
      console.log('Code update failed:', {
        code_id: codeId,
        admin: authResult.user.username,
        error: result.error,
        message: result.message
      });
      
      let statusCode = 400;
      if (result.error === 'CODE_NOT_FOUND') statusCode = 404;

      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('Code update error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update code',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/codes/[id]
 * Delete a redeem code
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
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

    // Await params before accessing properties
    const resolvedParams = await params;
    const codeId = parseInt(resolvedParams.id);
    
    if (isNaN(codeId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid code ID'
      }, { status: 400 });
    }

    console.log('Delete code request:', { 
      code_id: codeId,
      admin: authResult.user.username 
    });

    // Delete code
    const result = await codeOperations.deleteCode(codeId);

    if (result.success) {
      console.log('Code deleted successfully:', {
        code_id: codeId,
        admin: authResult.user.username
      });
      
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      console.log('Code deletion failed:', {
        code_id: codeId,
        admin: authResult.user.username,
        error: result.error,
        message: result.message
      });
      
      let statusCode = 400;
      if (result.error === 'CODE_NOT_FOUND') statusCode = 404;

      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('Code deletion error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete code',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
