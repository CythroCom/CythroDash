import { NextRequest, NextResponse } from 'next/server';
import { CronScheduler } from '@/lib/cron-scheduler';

export async function GET(request: NextRequest) {
  try {
    const scheduler = CronScheduler.getInstance();
    const status = scheduler.getStatus();
    
    return NextResponse.json({
      success: true,
      status,
      message: status.active ? 'CRON scheduler is running' : 'CRON scheduler is stopped'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || 'Failed to get scheduler status'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    const scheduler = CronScheduler.getInstance();
    
    if (action === 'start') {
      await scheduler.start();
      return NextResponse.json({
        success: true,
        message: 'CRON scheduler started'
      });
    } else if (action === 'stop') {
      scheduler.stop();
      return NextResponse.json({
        success: true,
        message: 'CRON scheduler stopped'
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
      message: error?.message || 'Failed to control scheduler'
    }, { status: 500 });
  }
}
