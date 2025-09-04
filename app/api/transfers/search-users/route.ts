/**
 * CythroDash - Transfer User Search API
 *
 * Fast user search for transfer autocomplete
 */

import { NextRequest, NextResponse } from 'next/server';
import { transferOperations } from '@/hooks/managers/database/transfers';
import { getPublicFlag } from '@/lib/public-settings'

async function maintenanceEnabled() {
  try { return await getPublicFlag('NEXT_PUBLIC_MAINTENANCE_MODE', process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') } catch { return process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' }
}

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


/**
 * GET /api/transfers/search-users
 * Search users for transfer (fast autocomplete)
 */
export async function GET(request: NextRequest) {

  try {
    // Feature gate: transfers
    const transfersEnabled = await getPublicFlag('NEXT_PUBLIC_TRANSFERS', process.env.NEXT_PUBLIC_TRANSFERS === 'true')
    if (!transfersEnabled) {
      return NextResponse.json({ success: true, users: [], message: 'Transfers disabled' })
    }
    // Authenticate user
    const authResult = await authenticateRequest(request);
    // Maintenance mode: return empty list
    if (await maintenanceEnabled()) {
      return NextResponse.json({ success: true, users: [], message: 'Maintenance mode enabled' })
    }

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        users: [],
        message: 'Query too short'
      });
    }

    // Search users
    const users = await transferOperations.searchUsersForTransfer(
      query,
      authResult.user.id,
      limit
    );

    return NextResponse.json({
      success: true,
      users,
      message: `Found ${users.length} users`
    });

  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to search users',
      error: 'SEARCH_ERROR'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-data',
    },
  });
}
