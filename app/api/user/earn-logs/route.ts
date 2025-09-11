/**
 * CythroDash - User Earn Logs API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return authResult.response!;
    }

    const user = authResult.user;
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));

    // Get rewards ledger entries for this user - filter for earning activities only
    const { rewardsLedgerOperations } = await import('@/hooks/managers/database/rewards-ledger');
    const result = await rewardsLedgerOperations.query({
      user_id: user.id,
      page,
      limit
    });

    // Filter to only show task rewards and earning activities
    const filteredEntries = result.entries.filter(entry => {
      // Only show positive deltas (earnings) and specific categories
      if (entry.delta <= 0) return false;

      // Include only earning-related categories
      const earningCategories = ['promotion', 'daily_login', 'referral', 'redeem_code'];
      return earningCategories.includes(entry.source_category);
    });

    // Transform filtered entries to a consistent format for the UI
    const logs = filteredEntries.map(entry => ({
      id: entry.id,
      time: entry.created_at,
      title: getLogTitle(entry.source_category, entry.source_action, entry.delta),
      description: entry.message || getLogDescription(entry.source_category, entry.reference_id),
      amount: entry.delta,
      category: entry.source_category,
      action: entry.source_action,
      reference_id: entry.reference_id,
      balance_before: entry.balance_before,
      balance_after: entry.balance_after
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          current_page: page,
          total_items: filteredEntries.length,
          items_per_page: limit,
          total_pages: Math.ceil(filteredEntries.length / limit)
        }
      }
    });

  } catch (error) {
    console.error('Earn logs API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch earn logs',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

function getLogTitle(category: string, action: string, delta: number): string {
  const isEarn = delta > 0;
  
  switch (category) {
    case 'daily_login':
      return 'Daily Login Bonus';
    case 'referral':
      return isEarn ? 'Referral Reward' : 'Referral Payout';
    case 'promotion':
      return 'Task Reward';
    case 'redeem_code':
      return 'Code Redeemed';
    case 'transfer':
      return isEarn ? 'Coins Received' : 'Coins Sent';
    case 'admin_adjustment':
      return isEarn ? 'Admin Credit' : 'Admin Debit';
    default:
      return isEarn ? 'Coins Earned' : 'Coins Spent';
  }
}

function getLogDescription(category: string, referenceId?: string | number): string {
  switch (category) {
    case 'daily_login':
      return 'Daily login bonus claimed';
    case 'referral':
      return referenceId ? `Referral: ${referenceId}` : 'Referral program reward';
    case 'promotion':
      return 'Task completion reward';
    case 'redeem_code':
      return referenceId ? `Code: ${referenceId}` : 'Redemption code used';
    case 'transfer':
      return referenceId ? `Transfer ID: ${referenceId}` : 'Coin transfer';
    case 'admin_adjustment':
      return 'Administrative adjustment';
    default:
      return 'Earning activity';
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
