#!/usr/bin/env node

/**
 * Simple CRON scheduler for development
 * Runs server lifecycle management every minute
 */

const http = require('http');

let isRunning = false;

async function callCronJob() {
  if (isRunning) {
    console.log('⏳ CRON job already running, skipping...');
    return;
  }

  try {
    isRunning = true;
    const startTime = Date.now();
    
    console.log(`\n🔄 [${new Date().toISOString()}] Running server lifecycle CRON job...`);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/cron/server-lifecycle',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });

    if (response.status !== 200) {
      throw new Error(`CRON job failed: ${response.status}`);
    }

    const result = JSON.parse(response.data);
    const duration = Date.now() - startTime;

    console.log(`✅ CRON job completed in ${duration}ms:`, {
      backfilled: result.backfilled,
      billing: result.billing,
      suspend: result.suspend,
      delete: result.delete
    });

    // Log significant actions
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
    console.error('❌ CRON job failed:', error.message);
  } finally {
    isRunning = false;
  }
}

console.log('🚀 Starting automatic CRON scheduler for server lifecycle management...');
console.log('📅 Running every 60 seconds');
console.log('🛑 Press Ctrl+C to stop\n');

// Run immediately
callCronJob();

// Then run every minute
const interval = setInterval(callCronJob, 60 * 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping CRON scheduler...');
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping CRON scheduler...');
  clearInterval(interval);
  process.exit(0);
});
