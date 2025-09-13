import { NextRequest, NextResponse } from 'next/server';
import { ServerLifecycleController } from '@/hooks/managers/controller/User/server-lifecycle';

async function checkCronAuth(request: NextRequest) {
  const { getConfig } = await import('@/database/config-manager.js')
  const secret = await (getConfig as any)('security.cron_secret', process.env.CRON_SECRET || process.env.CYTHRO_CRON_SECRET || 'default-cron-secret-change-me')
  const header = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '')

  // For development, allow a default secret
  if (process.env.NODE_ENV === 'development' && !header) {
    console.warn('CRON job called without authentication in development mode - allowing for testing');
    return { ok: true };
  }

  if (!secret) {
    return { ok: false, status: 500, message: 'CRON secret not configured' };
  }
  if (!header || header !== secret) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkCronAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const now = new Date();

    // Backfill any missing expiry_date to avoid special cases
    const backfilled = await ServerLifecycleController.backfillExpiry(1000);

    // Process billing first, then suspend expired and delete after grace
    const billing = await ServerLifecycleController.processBillingCycles(now);
    const suspend = await ServerLifecycleController.suspendExpired(now);
    const del = await ServerLifecycleController.deleteAfterGrace(now);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      backfilled,
      billing,
      suspend,
      delete: del
    });
  } catch (error: any) {
    console.error('Cron server-lifecycle error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

