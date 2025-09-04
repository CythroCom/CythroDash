import { NextRequest, NextResponse } from 'next/server';
import { ServerLifecycleController } from '@/hooks/managers/controller/User/server-lifecycle';

function checkCronAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.CYTHRO_CRON_SECRET;
  const header = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
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
    const auth = checkCronAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const now = new Date();

    // Backfill any missing expiry_date to avoid special cases
    const backfilled = await ServerLifecycleController.backfillExpiry(1000);

    const suspend = await ServerLifecycleController.suspendExpired(now);
    const del = await ServerLifecycleController.deleteAfterGrace(now);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      backfilled,
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

