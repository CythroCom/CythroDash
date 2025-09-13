/**
 * CythroDash - Server Renewal API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverOperations } from '@/hooks/managers/database/servers';
import { userOperations } from '@/hooks/managers/database/user';
import { planOperations } from '@/hooks/managers/database/plan';
import { ServerStatus, BillingStatus } from '@/database/tables/cythro_dash_servers';
import { panelServerUnsuspend } from '@/hooks/managers/pterodactyl/servers';
import { addCycle } from '@/lib/billing-cycle';

// Input validation schema for POST request
const renewServerSchema = z.object({
  confirm: z.boolean().refine(val => val === true, 'Confirmation required')
});

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  
  // Clean up old entries
  for (const [ip, data] of rateLimitMap.entries()) {
    if (data.resetTime < now) {
      rateLimitMap.delete(ip);
    }
  }
  
  const current = rateLimitMap.get(clientIP) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
  
  if (current.resetTime < now) {
    current.count = 0;
    current.resetTime = now + RATE_LIMIT_WINDOW_MS;
  }
  
  current.count++;
  rateLimitMap.set(clientIP, current);
  
  return {
    allowed: current.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - current.count),
    resetTime: current.resetTime
  };
}

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

    // Get user data from header (temporary until session validation is implemented)
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return {
        success: false,
        error: 'User data header missing'
      };
    }

    try {
      const userData = JSON.parse(decodeURIComponent(userDataHeader));
      if (!userData.id) {
        return {
          success: false,
          error: 'Invalid user data'
        };
      }

      return {
        success: true,
        user: userData
      };
    } catch (parseError) {
      return {
        success: false,
        error: 'Invalid user data format'
      };
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * POST /api/servers/[id]/renew
 * Renew a suspended server by paying the overdue amount
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
        }
      });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED'
      }, { status: 401 });
    }

    const user = authResult.user;
    const serverId = (await params).id;

    // Validate request body
    let validatedData;
    try {
      const body = await request.json();
      validatedData = renewServerSchema.parse(body);
    } catch (validationError) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        error: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    // Get server details from database
    const server = await serverOperations.getServerById(serverId);
    if (!server) {
      return NextResponse.json({
        success: false,
        message: 'Server not found',
        error: 'SERVER_NOT_FOUND'
      }, { status: 404 });
    }

    // Check if user owns the server
    if (server.user_id !== user.id && user.role !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Access denied',
        error: 'ACCESS_DENIED'
      }, { status: 403 });
    }

    // Check if server is suspended and can be renewed
    if (server.status !== ServerStatus.SUSPENDED) {
      return NextResponse.json({
        success: false,
        message: 'Server is not suspended',
        error: 'SERVER_NOT_SUSPENDED'
      }, { status: 400 });
    }

    // Check if server has overdue amount
    const overdueAmount = server.billing?.overdue_amount || 0;
    if (overdueAmount <= 0) {
      return NextResponse.json({
        success: false,
        message: 'No overdue amount to pay',
        error: 'NO_OVERDUE_AMOUNT'
      }, { status: 400 });
    }

    // Check if user has sufficient coins
    const currentUser = await userOperations.getUserById(user.id);
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    if (currentUser.coins < overdueAmount) {
      return NextResponse.json({
        success: false,
        message: `Insufficient coins. Required: ${overdueAmount}, Available: ${currentUser.coins}`,
        error: 'INSUFFICIENT_COINS',
        required_amount: overdueAmount,
        available_amount: currentUser.coins
      }, { status: 400 });
    }

    // Get plan details to calculate new expiry date
    const plan = await planOperations.getPlanById(server.billing.plan_id);
    if (!plan) {
      return NextResponse.json({
        success: false,
        message: 'Server plan not found',
        error: 'PLAN_NOT_FOUND'
      }, { status: 500 });
    }

    try {
      // Charge user for overdue amount
      const chargeSuccess = await userOperations.updateCoins(
        user.id, 
        -overdueAmount, 
        `Server ${serverId} renewal`
      );

      if (!chargeSuccess) {
        return NextResponse.json({
          success: false,
          message: 'Failed to charge user',
          error: 'CHARGE_FAILED'
        }, { status: 500 });
      }

      // Calculate new expiry date based on plan billing cycle
      const cycleStr = (plan as any).billing_cycle_value || (plan as any).billing_cycle || '1month';
      const now = new Date();
      const newExpiryDate = addCycle(now, String(cycleStr));
      const newNextBillingDate = addCycle(now, String(cycleStr));

      // Update server status and billing info
      const updateSuccess = await serverOperations.updateServer(serverId, {
        status: ServerStatus.ACTIVE,
        billing_status: BillingStatus.ACTIVE,
        expiry_date: newExpiryDate,
        auto_delete_at: undefined, // Clear auto-delete
        billing: {
          ...server.billing,
          overdue_amount: 0, // Clear overdue amount
          next_billing_date: newNextBillingDate,
          last_billing_date: now,
          total_cost: server.billing.total_cost + overdueAmount
        },
        suspension_info: undefined // Clear suspension info
      } as any);

      if (!updateSuccess) {
        // Rollback the charge if server update fails
        await userOperations.updateCoins(
          user.id, 
          overdueAmount, 
          `Server ${serverId} renewal rollback`
        );
        
        return NextResponse.json({
          success: false,
          message: 'Failed to update server',
          error: 'UPDATE_FAILED'
        }, { status: 500 });
      }

      // Unsuspend server in Pterodactyl panel
      if (server.pterodactyl_server_id) {
        try {
          await panelServerUnsuspend(server.pterodactyl_server_id);
        } catch (pterodactylError) {
          console.warn(`Failed to unsuspend server ${serverId} in panel:`, pterodactylError);
          // Don't fail the renewal if panel unsuspend fails
        }
      }

      // Set rate limit headers
      const responseHeaders = {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
      };

      return NextResponse.json({
        success: true,
        message: 'Server renewed successfully',
        renewal_details: {
          amount_charged: overdueAmount,
          new_expiry_date: newExpiryDate.toISOString(),
          next_billing_date: newNextBillingDate.toISOString()
        }
      }, { 
        status: 200,
        headers: responseHeaders
      });

    } catch (error) {
      console.error('Error renewing server:', error);
      return NextResponse.json({
        success: false,
        message: 'Internal server error',
        error: 'INTERNAL_ERROR'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Server renewal error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
