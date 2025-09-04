/**
 * CythroDash - Admin Codes API
 * 
 * Admin endpoints for managing redeem codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { codeOperations } from '@/hooks/managers/database/codes';
import { CodeStatus } from '@/database/tables/cythro_dash_codes';

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

// Input validation schemas
const createCodeSchema = z.object({
  code: z.string().min(4).max(32).regex(/^[A-Z0-9-_]+$/i, 'Code can only contain letters, numbers, hyphens, and underscores').optional(),
  coins_value: z.number().int().min(1).max(10000),
  max_uses: z.number().int().min(0).max(1000000),
  expiry_date: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  description: z.string().max(500).optional(),
  internal_notes: z.string().max(1000).optional(),
  allowed_user_ids: z.array(z.number().int()).optional(),
  restricted_to_new_users: z.boolean().optional(),
});

const getCodesSchema = z.object({
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().int().min(1).max(100)).optional(),
  offset: z.string().transform(val => parseInt(val)).pipe(z.number().int().min(0)).optional(),
  status: z.nativeEnum(CodeStatus).optional(),
  created_by: z.string().transform(val => parseInt(val)).pipe(z.number().int()).optional(),
  search: z.string().max(100).optional(),
});

/**
 * GET /api/admin/codes
 * Get all codes with filtering and pagination
 */
export async function GET(request: NextRequest) {
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

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const validation = getCodesSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const { limit = 50, offset = 0, status, created_by, search } = validation.data;

    // Get codes
    const result = await codeOperations.getAllCodes(limit, offset, {
      status,
      created_by,
      search
    });

    console.log('Retrieved admin codes:', {
      admin_id: authResult.user.id,
      count: result.codes.length,
      total: result.total,
      filters: { status, created_by, search }
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      codes: result.codes,
      total: result.total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Get admin codes error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve codes',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/codes
 * Create a new redeem code
 */
export async function POST(request: NextRequest) {
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

    const requestData = await request.json();
    console.log('Create code request:', { 
      ...requestData, 
      admin: authResult.user.username 
    });

    // Validate input
    const inputValidation = createCodeSchema.safeParse(requestData);
    if (!inputValidation.success) {
      console.log('Code creation validation failed:', inputValidation.error.errors);
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

    // Create code
    const result = await codeOperations.createCode({
      code: validatedData.code?.toUpperCase(), // Normalize to uppercase if provided
      coins_value: validatedData.coins_value,
      max_uses: validatedData.max_uses,
      expiry_date: validatedData.expiry_date,
      created_by_admin_id: authResult.user.id,
      description: validatedData.description,
      internal_notes: validatedData.internal_notes,
      allowed_user_ids: validatedData.allowed_user_ids,
      restricted_to_new_users: validatedData.restricted_to_new_users
    });

    if (result.success) {
      console.log('Code created successfully:', {
        code: result.code?.code,
        admin: authResult.user.username,
        coins_value: result.code?.coins_value
      });
      
      return NextResponse.json({
        success: true,
        message: result.message,
        code: result.code
      });
    } else {
      console.log('Code creation failed:', {
        admin: authResult.user.username,
        error: result.error,
        message: result.message
      });
      
      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Code creation error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create code',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
