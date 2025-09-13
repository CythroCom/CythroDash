import { NextRequest, NextResponse } from 'next/server';

// Global interval to prevent multiple instances
let cronInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'start') {
      if (cronInterval) {
        return NextResponse.json({
          success: false,
          message: 'Auto CRON is already running'
        });
      }

      // Start the automatic CRON job
      console.log('🚀 Starting automatic CRON scheduler...');
      
      // Run immediately
      await runCronJob();
      
      // Then run every minute
      cronInterval = setInterval(async () => {
        await runCronJob();
      }, 60 * 1000); // 60 seconds

      return NextResponse.json({
        success: true,
        message: 'Auto CRON started - running every 60 seconds'
      });
      
    } else if (action === 'stop') {
      if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
        console.log('🛑 Auto CRON stopped');
      }
      
      return NextResponse.json({
        success: true,
        message: 'Auto CRON stopped'
      });
      
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Use "start" or "stop"'
      }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || 'Failed to control auto CRON'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    running: cronInterval !== null,
    message: cronInterval ? 'Auto CRON is running' : 'Auto CRON is stopped'
  });
}

async function runCronJob(): Promise<void> {
  if (isRunning) {
    console.log('⏳ CRON job already running, skipping...');
    return;
  }

  try {
    isRunning = true;
    const startTime = Date.now();
    
    console.log(`\n🔄 [${new Date().toISOString()}] Auto CRON: Running server lifecycle job...`);

    // Import and run the lifecycle controller directly
    const { ServerLifecycleController } = await import('@/hooks/managers/controller/User/server-lifecycle');
    
    const now = new Date();
    
    // 1. Backfill missing expiry dates
    const backfilled = await ServerLifecycleController.backfillExpiry();
    
    // 2. Process billing cycles and suspend servers with insufficient balance
    const billing = await ServerLifecycleController.processBillingCycles(now);
    
    // 3. Suspend servers that have expired
    const suspend = await ServerLifecycleController.suspendExpired(now);
    
    // 4. Delete servers after grace period
    const deleteResult = await ServerLifecycleController.deleteAfterGrace(now);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Auto CRON completed in ${duration}ms:`, {
      backfilled,
      billing: `${billing.processed} processed, ${billing.suspended} suspended`,
      suspend: `${suspend.processed} suspended`,
      delete: `${deleteResult.processed} deleted`
    });

    // Log significant actions
    if (billing.suspended > 0) {
      console.log(`🚨 ${billing.suspended} servers suspended due to billing issues`);
    }
    if (suspend.processed > 0) {
      console.log(`⏰ ${suspend.processed} expired servers suspended`);
    }
    if (deleteResult.processed > 0) {
      console.log(`🗑️ ${deleteResult.processed} servers deleted after grace period`);
    }

  } catch (error) {
    console.error('❌ Auto CRON job failed:', error);
  } finally {
    isRunning = false;
  }
}
