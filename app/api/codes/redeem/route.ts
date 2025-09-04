/**
 * CythroDash - Redeem Codes API
 * 
 * User endpoint for redeeming codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { codeOperations } from '@/hooks/managers/database/codes';

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

// Input validation schema
const redeemCodeSchema = z.object({
  code: z.string().min(4).max(32).regex(/^[A-Z0-9-_]+$/i, 'Code can only contain letters, numbers, hyphens, and underscores'),
});

/**
 * POST /api/codes/redeem
 * Redeem a code for coins
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

    const requestData = await request.json();
    console.log('Redeem code request:', { code: requestData.code, user: authResult.user.username });

    // Validate input
    const inputValidation = redeemCodeSchema.safeParse(requestData);
    if (!inputValidation.success) {
      console.log('Code validation failed:', inputValidation.error.errors);
      return NextResponse.json({
        success: false,
        message: 'Invalid code format',
        errors: inputValidation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 });
    }

    const validatedData = inputValidation.data;
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Redeem code
    const result = await codeOperations.redeemCode({
      code: validatedData.code.toUpperCase(), // Normalize to uppercase
      user_id: authResult.user.id,
      username: authResult.user.username,
      ip_address: clientIP,
      user_agent: userAgent
    });

    if (result.success) {
      console.log('Code redeemed successfully:', {
        code: validatedData.code,
        user: authResult.user.username,
        coins: result.coins_awarded
      });
      
      return NextResponse.json({
        success: true,
        message: result.message,
        coins_awarded: result.coins_awarded
      });
    } else {
      console.log('Code redemption failed:', {
        code: validatedData.code,
        user: authResult.user.username,
        error: result.error,
        message: result.message
      });
      
      // Return appropriate status codes based on error type
      let statusCode = 400;
      if (result.error === 'CODE_NOT_FOUND') statusCode = 404;
      else if (result.error === 'RATE_LIMITED_IP' || result.error === 'RATE_LIMITED_USER') statusCode = 429;
      else if (result.error === 'USER_NOT_ALLOWED') statusCode = 403;

      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('Code redemption error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to redeem code',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/codes/redeem
 * Get user's redemption history
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate query parameters
    if (limit < 1 || limit > 100 || offset < 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters'
      }, { status: 400 });
    }

    // Get user redemptions
    const result = await codeOperations.getUserRedemptions(
      authResult.user.id,
      limit,
      offset
    );

    console.log('Retrieved user redemptions:', {
      user_id: authResult.user.id,
      count: result.redemptions.length,
      total: result.total
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      redemptions: result.redemptions,
      total: result.total,
      limit,
      offset
    });

  } catch (error) {
    console.error('Get redemptions error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to retrieve redemptions',
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
