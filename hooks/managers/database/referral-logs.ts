/**
 * CythroDash - Referral Logs Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import {
  CythroDashReferralLog,
  CythroDashReferralAnalytics,
  ReferralLogType,
  LogSecurityInfo,
  ReferralLogHelpers,
  REFERRAL_LOGS_COLLECTION,
  REFERRAL_ANALYTICS_COLLECTION,
  REFERRAL_LOGS_INDEXES,
  REFERRAL_ANALYTICS_INDEXES
} from '../../../database/tables/cythro_dash_referral_logs';

// Rate limiting for log creation
const logAttempts = new Map<string, { count: number; lastAttempt: number }>();

function checkLogRateLimit(key: string, maxAttempts: number = 100, windowMs: number = 60 * 1000): boolean {
  const now = Date.now();
  const attempts = logAttempts.get(key);
  
  if (!attempts) {
    logAttempts.set(key, { count: 1, lastAttempt: now });
    return true;
  }

  // Reset if window has passed
  if (now - attempts.lastAttempt > windowMs) {
    logAttempts.set(key, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if within limits
  if (attempts.count >= maxAttempts) {
    return false;
  }

  // Increment count
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

// Database collection management for referral logs
class CythroDashReferralLogsCollection {
  private collection!: Collection<CythroDashReferralLog>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashReferralLog>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    const db = await connectToDatabase();
    this.collection = db.collection<CythroDashReferralLog>(REFERRAL_LOGS_COLLECTION);
    
    // Create indexes for better performance
    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    try {
      for (const index of REFERRAL_LOGS_INDEXES) {
        try {
          await this.collection.createIndex(index.key as any, {
            name: index.name
          });
        } catch (error) {
          console.log(`Index ${index.name} already exists or failed to create`);
        }
      }
      console.log('Referral logs indexes created successfully');
    } catch (error) {
      console.error('Error creating referral logs indexes:', error);
    }
  }
}

// Removed auth logs collection - focusing only on referral logging

// Database collection management for analytics
class CythroDashReferralAnalyticsCollection {
  private collection!: Collection<CythroDashReferralAnalytics>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashReferralAnalytics>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    const db = await connectToDatabase();
    this.collection = db.collection<CythroDashReferralAnalytics>(REFERRAL_ANALYTICS_COLLECTION);
    
    // Create indexes for better performance
    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    try {
      for (const index of REFERRAL_ANALYTICS_INDEXES) {
        try {
          await this.collection.createIndex(index.key as any, {
            name: index.name
          });
        } catch (error) {
          console.log(`Index ${index.name} already exists or failed to create`);
        }
      }
      console.log('Referral analytics indexes created successfully');
    } catch (error) {
      console.error('Error creating referral analytics indexes:', error);
    }
  }
}

// Singleton instances
const referralLogsCollection = new CythroDashReferralLogsCollection();
const analyticsCollection = new CythroDashReferralAnalyticsCollection();

// Logging operations class
class LoggingOperations {
  // Log referral activity
  async logReferralActivity(
    logType: ReferralLogType,
    securityInfo: LogSecurityInfo,
    activityData: any,
    additionalData?: Partial<CythroDashReferralLog>
  ): Promise<boolean> {
    try {
      // Rate limiting check
      const rateLimitKey = `referral_${securityInfo.ip_address}_${logType}`;
      if (!checkLogRateLimit(rateLimitKey, 50, 60 * 1000)) {
        console.warn(`Rate limit exceeded for referral logging: ${rateLimitKey}`);
        return false;
      }

      const collection = await referralLogsCollection.getCollection();
      
      // Calculate risk score and device fingerprint
      const riskScore = ReferralLogHelpers.calculateLogRiskScore(securityInfo);
      const deviceFingerprint = ReferralLogHelpers.generateLogDeviceFingerprint(securityInfo);
      
      const logEntry = ReferralLogHelpers.createReferralLog(
        logType,
        {
          ...securityInfo,
          risk_score: riskScore,
          is_suspicious: riskScore > 50,
          device_fingerprint: deviceFingerprint
        },
        activityData,
        riskScore > 80 ? 'blocked' : 'success',
        additionalData
      );

      await collection.insertOne(logEntry);

      // Auto-block IP if risk score exceeds threshold
      try {
        if (riskScore >= (Number(process.env.SECURITY_AUTO_BLOCK_RISK_THRESHOLD) || 85)) {
          const { blockedIPsOperations } = await import('@/hooks/managers/database/blocked-ips')
          await blockedIPsOperations.blockIP({
            ip_address: securityInfo.ip_address || 'unknown',
            reason: `Automatic block via referral risk score ${riskScore}`,
            block_type: 'automatic',
            expires_at: new Date(Date.now() + ((Number(process.env.SECURITY_AUTO_BLOCK_DURATION_HOURS) || 24) * 60 * 60 * 1000)),
            metadata: { source: 'referral', notes: 'Auto-block from referral risk scoring' }
          })
        }
      } catch (e) {
        console.warn('Auto-block referral IP failed:', e)
      }

      return true;
    } catch (error) {
      console.error('Error logging referral activity:', error);
      return false;
    }
  }

  // Removed authentication logging - focusing only on referral logging

  // Get referral logs for a user
  async getUserReferralLogs(
    userId: number,
    logType?: ReferralLogType,
    limit: number = 50,
    offset: number = 0
  ): Promise<CythroDashReferralLog[]> {
    try {
      const collection = await referralLogsCollection.getCollection();
      
      const filter: Filter<CythroDashReferralLog> = {
        $or: [
          { referrer_id: userId },
          { referred_user_id: userId },
          { user_id: userId }
        ]
      };
      
      if (logType) {
        filter.log_type = logType;
      }

      return await collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Error getting user referral logs:', error);
      return [];
    }
  }

  // Removed authentication logs retrieval - focusing only on referral logging

  // Get analytics data
  async getAnalytics(
    userId?: number,
    periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
    startDate?: Date,
    endDate?: Date
  ): Promise<CythroDashReferralAnalytics[]> {
    try {
      const collection = await analyticsCollection.getCollection();
      
      const filter: Filter<CythroDashReferralAnalytics> = {
        period_type: periodType
      };
      
      if (userId) {
        filter.user_id = userId;
      }
      
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
      }

      return await collection
        .find(filter)
        .sort({ date: -1 })
        .limit(100)
        .toArray();
    } catch (error) {
      console.error('Error getting analytics:', error);
      return [];
    }
  }

  // Update analytics (should be called periodically)
  async updateAnalytics(date?: Date): Promise<boolean> {
    try {
      const analyticsDate = ReferralLogHelpers.getAnalyticsDate(date);
      const collection = await analyticsCollection.getCollection();
      const logsCollection = await referralLogsCollection.getCollection();
      
      // Calculate daily analytics
      const startOfDay = new Date(analyticsDate);
      const endOfDay = new Date(analyticsDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Aggregate referral metrics for the day
      const dailyMetrics = await logsCollection.aggregate([
        {
          $match: {
            timestamp: { $gte: startOfDay, $lt: endOfDay }
          }
        },
        {
          $group: {
            _id: null,
            total_clicks: {
              $sum: { $cond: [{ $eq: ['$log_type', 'click'] }, 1, 0] }
            },
            total_signups: {
              $sum: { $cond: [{ $eq: ['$log_type', 'signup'] }, 1, 0] }
            },
            total_claims: {
              $sum: { $cond: [{ $eq: ['$log_type', 'claim'] }, 1, 0] }
            },
            total_earnings: {
              $sum: { $ifNull: ['$activity_data.total_reward', 0] }
            },
            suspicious_activities: {
              $sum: { $cond: ['$security_info.is_suspicious', 1, 0] }
            }
          }
        }
      ]).toArray();

      const metrics = dailyMetrics[0] || {
        total_clicks: 0,
        total_signups: 0,
        total_claims: 0,
        total_earnings: 0,
        suspicious_activities: 0
      };

      // Create analytics entry
      const analyticsEntry: Omit<CythroDashReferralAnalytics, '_id'> = {
        date: analyticsDate,
        period_type: 'daily',
        metrics: {
          total_clicks: metrics.total_clicks,
          unique_clicks: metrics.total_clicks, // TODO: Calculate unique clicks
          suspicious_clicks: metrics.suspicious_activities,
          blocked_clicks: 0, // TODO: Calculate blocked clicks
          total_signups: metrics.total_signups,
          verified_signups: metrics.total_signups,
          failed_signups: 0,
          click_to_signup_rate: ReferralLogHelpers.calculateConversionRate(
            metrics.total_signups,
            metrics.total_clicks
          ),
          average_time_to_convert: 0, // TODO: Calculate average conversion time
          total_earnings: metrics.total_earnings,
          click_earnings: 0, // TODO: Calculate click earnings
          signup_earnings: metrics.total_earnings,
          tier_bonuses: 0, // TODO: Calculate tier bonuses
          claimed_earnings: 0, // TODO: Calculate claimed earnings
          tier_distribution: {
            bronze: 0,
            silver: 0,
            gold: 0,
            diamond: 0
          }
        },
        last_updated: new Date(),
        created_at: new Date()
      };

      // Upsert analytics entry
      await collection.replaceOne(
        { date: analyticsDate, period_type: 'daily', user_id: { $exists: false } },
        analyticsEntry,
        { upsert: true }
      );

      return true;
    } catch (error) {
      console.error('Error updating analytics:', error);
      return false;
    }
  }
}

// Export singleton instance
export const loggingOperations = new LoggingOperations();
