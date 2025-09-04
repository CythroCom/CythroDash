/**
 * CythroDash - Transfer API
 *
 * Fast transfer operations without loading screens
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transferOperations } from '@/hooks/managers/database/transfers';
import { getPublicFlag } from '@/lib/public-settings'

// Authentication function
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: 'No session token found'
      };
    }

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

// Get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

// Maintenance mode enforcement
async function maintenanceEnabled() {
  try { return await getPublicFlag('NEXT_PUBLIC_MAINTENANCE_MODE', process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') } catch { return process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' }
}

// Input validation schemas
const createTransferSchema = z.object({
  to_username: z.string().min(1).max(50),
  amount: z.number().int().min(1).max(10000),
  note: z.string().max(200).optional(),
});

const getTransfersSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * POST /api/transfers
 * Create a new transfer
 */
export async function POST(request: NextRequest) {
  try {
    // Feature gate: transfers
    const transfersEnabled = await getPublicFlag('NEXT_PUBLIC_TRANSFERS', process.env.NEXT_PUBLIC_TRANSFERS === 'true')
    if (!transfersEnabled) {
      return NextResponse.json({ success: false, message: 'Transfers are disabled' }, { status: 403 })
    }
    // Maintenance mode: block POSTs
    if (await maintenanceEnabled()) {
      return NextResponse.json({ success: false, message: 'Maintenance mode enabled' }, { status: 503 })
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const requestData = await request.json();
    console.log('Create transfer request:', { ...requestData, amount: requestData.amount });

    // Validate input
    const inputValidation = createTransferSchema.safeParse(requestData);
    if (!inputValidation.success) {
      console.log('Transfer validation failed:', inputValidation.error.errors);
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
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Create transfer
    const result = await transferOperations.createTransfer({
      from_user_id: authResult.user.id,
      to_username: validatedData.to_username,
      amount: validatedData.amount,
      note: validatedData.note,
      ip_address: clientIP,
      user_agent: userAgent
    });

    if (result.success) {
      console.log('Transfer created successfully:', result.transfer?.id);
      return NextResponse.json({
        success: true,
        message: result.message,
        transfer: result.transfer
      });
    } else {
      console.log('Transfer creation failed:', result.error);
      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Transfer creation error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create transfer',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/transfers
 * Get user transfers
 */
export async function GET(request: NextRequest) {
  try {
    // Feature gate: transfers
    const transfersEnabled = await getPublicFlag('NEXT_PUBLIC_TRANSFERS', process.env.NEXT_PUBLIC_TRANSFERS === 'true')
    if (!transfersEnabled) {
      return NextResponse.json({ success: true, message: 'Transfers disabled', transfers: [], total: 0, limit: 0, offset: 0 })
    }
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate query parameters
    const queryValidation = getTransfersSchema.safeParse({ limit, offset });
    if (!queryValidation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: queryValidation.error.errors
      }, { status: 400 });
    }

    // Get transfers
    const result = await transferOperations.getUserTransfers(
      authResult.user.id,
      limit,
      offset
    );

    console.log('Retrieved transfers:', {
      user_id: authResult.user.id,
      count: result.transfers.length,
      total: result.total
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      transfers: result.transfers,
      total: result.total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Get transfers error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve transfers',
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
