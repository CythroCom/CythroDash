import { NextRequest, NextResponse } from 'next/server';
import { serverOperations } from '@/hooks/managers/database/servers';

export async function GET(request: NextRequest) {
  try {
    // Get all servers for debugging
    const servers = await serverOperations.getServers();

    const now = new Date();
    const debugInfo = {
      timestamp: now.toISOString(),
      serverCount: servers.length,
      servers: servers.map(server => ({
        id: server.id,
        name: server.name,
        status: server.status,
        billing_status: server.billing_status,
        expiry_date: server.expiry_date,
        next_billing_date: server.billing?.next_billing_date,
        billing_cycle: server.billing?.billing_cycle,
        created_at: server.created_at,
        auto_delete_at: server.auto_delete_at,
        overdue_amount: server.billing?.overdue_amount,
        isExpired: server.expiry_date ? new Date(server.expiry_date) <= now : false,
        isBillingDue: server.billing?.next_billing_date ? new Date(server.billing.next_billing_date) <= now : false,
        minutesSinceCreation: server.created_at ? Math.floor((now.getTime() - new Date(server.created_at).getTime()) / (1000 * 60)) : null
      }))
    };

    return NextResponse.json(debugInfo);
  } catch (error: any) {
    console.error('Debug servers error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error?.message || 'Internal error',
      error: error?.stack 
    }, { status: 500 });
  }
}
