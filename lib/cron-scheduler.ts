/**
 * Development CRON Scheduler
 * Automatically runs server lifecycle management every minute in development
 */

let isRunning = false;

export class CronScheduler {
  private static instance: CronScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isActive = false;

  static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  async start(): Promise<void> {
    if (this.isActive) {
      console.log('CRON scheduler already running');
      return;
    }

    console.log('🚀 Starting automatic CRON scheduler for server lifecycle management...');
    this.isActive = true;

    // Run immediately on start
    await this.runCronJob();

    // Then run every minute
    this.intervalId = setInterval(async () => {
      await this.runCronJob();
    }, 60 * 1000); // 60 seconds

    console.log('✅ CRON scheduler started - running every 60 seconds');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    console.log('🛑 CRON scheduler stopped');
  }

  private async runCronJob(): Promise<void> {
    if (isRunning) {
      console.log('⏳ CRON job already running, skipping this cycle');
      return;
    }

    try {
      isRunning = true;
      const startTime = Date.now();
      
      console.log(`\n🔄 [${new Date().toISOString()}] Running server lifecycle CRON job...`);

      // Call the CRON endpoint internally
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/cron/server-lifecycle`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // No auth header needed in development mode
        },
      });

      if (!response.ok) {
        throw new Error(`CRON job failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      console.log(`✅ CRON job completed in ${duration}ms:`, {
        backfilled: result.backfilled,
        billing: result.billing,
        suspend: result.suspend,
        delete: result.delete
      });

      // Log any significant actions
      if (result.billing?.suspended > 0) {
        console.log(`🚨 ${result.billing.suspended} servers suspended due to billing issues`);
      }
      if (result.suspend?.processed > 0) {
        console.log(`⏰ ${result.suspend.processed} expired servers suspended`);
      }
      if (result.delete?.processed > 0) {
        console.log(`🗑️ ${result.delete.processed} servers deleted after grace period`);
      }

    } catch (error) {
      console.error('❌ CRON job failed:', error);
    } finally {
      isRunning = false;
    }
  }

  getStatus(): { active: boolean; running: boolean } {
    return {
      active: this.isActive,
      running: isRunning
    };
  }
}

// Global functions for backward compatibility
export function startCronScheduler(): Promise<void> {
  return CronScheduler.getInstance().start();
}

export function stopCronScheduler(): void {
  CronScheduler.getInstance().stop();
}

export function getCronStatus(): { active: boolean; running: boolean } {
  return CronScheduler.getInstance().getStatus();
}
