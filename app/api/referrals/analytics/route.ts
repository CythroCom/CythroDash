/**
 * CythroDash - Referral Analytics API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReferralLogsController } from '@/hooks/managers/controller/User/ReferralLogs';
import { z } from 'zod';

// Input validation schema
const analyticsSchema = z.object({
  user_id: z.number().optional(),
  period_type: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  start_date: z.string().optional(),
  end_date: z.string().optional()
});

// Simple authentication function
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

export async function GET(request: NextRequest) {
  try {
    // Validate user session
    const sessionResult = await authenticateRequest(request);
    
    if (!sessionResult.success || !sessionResult.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      user_id: url.searchParams.get('user_id') ? parseInt(url.searchParams.get('user_id')!) : undefined,
      period_type: url.searchParams.get('period_type') || 'daily',
      start_date: url.searchParams.get('start_date'),
      end_date: url.searchParams.get('end_date')
    };

    // Validate input
    const inputValidation = analyticsSchema.safeParse(queryParams);
    
    if (!inputValidation.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid query parameters',
          errors: inputValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const { user_id, period_type, start_date, end_date } = inputValidation.data;

    // If user_id is not provided, use the authenticated user's ID
    const targetUserId = user_id || sessionResult.user.id;

    // Only allow users to view their own analytics unless they're admin
    if (targetUserId !== sessionResult.user.id && sessionResult.user.role !== 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Insufficient permissions to view analytics for other users',
          error: 'FORBIDDEN'
        },
        { status: 403 }
      );
    }

    // Get analytics data
    const analyticsResult = await ReferralLogsController.getReferralAnalytics({
      user_id: targetUserId,
      period_type: period_type as 'daily' | 'weekly' | 'monthly',
      start_date,
      end_date
    });

    if (analyticsResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: analyticsResult.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: analyticsResult.message || 'Failed to retrieve analytics',
          errors: analyticsResult.errors || []
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Analytics API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate user session
    const sessionResult = await authenticateRequest(request);
    
    if (!sessionResult.success || !sessionResult.user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    // Only allow admins to update analytics
    if (sessionResult.user.role !== 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Insufficient permissions to update analytics',
          error: 'FORBIDDEN'
        },
        { status: 403 }
      );
    }

    // Update analytics
    const updateResult = await ReferralLogsController.updateAnalytics();

    if (updateResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Analytics updated successfully'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: updateResult.message || 'Failed to update analytics',
          errors: updateResult.errors || []
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Analytics update API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
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
