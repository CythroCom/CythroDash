/**
 * CythroDash - Daily Login Bonus Database Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { 
  CythroDashDailyLogin, 
  DailyLoginStats, 
  DailyLoginAnalytics,
  DailyLoginStatus,
  DailyLoginUtils,
  DAILY_LOGINS_INDEXES
} from '@/database/tables/cythro_dash_daily_logins';

// Response interfaces
export interface DailyLoginResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface TodayLoginCheck {
  hasLoggedIn: boolean;
  canClaim: boolean;
  alreadyClaimed: boolean;
  coinsAwarded?: number;
  expiresAt?: Date;
  loginRecord?: CythroDashDailyLogin;
}

export class DailyLoginController {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;

  /**
   * Initialize database connection
   */
  private static async initializeDatabase(): Promise<void> {
    if (this.db) return;

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('DATABASE environment variable is not set');
    }

    this.client = new MongoClient(mongoUri);
    await this.client.connect();
    this.db = this.client.db();

    // Ensure indexes exist
    await this.ensureIndexes();
  }

  /**
   * Ensure database indexes exist
   */
  private static async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    const collection = this.db.collection('cythro_dash_daily_logins');

    for (const index of DAILY_LOGINS_INDEXES) {
      try {
        await collection.createIndex(index.key as any, {
          name: index.name,
          unique: index.unique || false,
          sparse: index.sparse || false
        });
      } catch (error) {
        console.error(`Failed to create index ${index.name}:`, error);
      }
    }
  }

  /**
   * Get daily logins collection
   */
  private static async getCollection(): Promise<Collection<CythroDashDailyLogin>> {
    await this.initializeDatabase();
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.collection<CythroDashDailyLogin>('cythro_dash_daily_logins');
  }

  /**
   * Check if user has logged in today and can claim bonus
   */
  static async checkTodayLogin(userId: number): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();
      const today = DailyLoginUtils.getCurrentDate();

      const loginRecord = await collection.findOne({
        user_id: userId,
        login_date: today
      });

      const result: TodayLoginCheck = {
        hasLoggedIn: !!loginRecord,
        canClaim: false,
        alreadyClaimed: false,
        loginRecord: loginRecord || undefined
      };

      if (loginRecord) {
        result.coinsAwarded = loginRecord.coins_awarded;
        result.expiresAt = loginRecord.expires_at;
        result.alreadyClaimed = loginRecord.status === DailyLoginStatus.CLAIMED;
        result.canClaim = loginRecord.status === DailyLoginStatus.PENDING && 
                         new Date() < loginRecord.expires_at;
      }

      return {
        success: true,
        message: 'Daily login status retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('Error checking today login:', error);
      return {
        success: false,
        message: 'Failed to check daily login status',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record daily login and create bonus opportunity
   */
  static async recordDailyLogin(
    userId: number, 
    coinsAwarded: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();
      const today = DailyLoginUtils.getCurrentDate();
      const now = new Date();

      // Check if already logged in today
      const existingLogin = await collection.findOne({
        user_id: userId,
        login_date: today
      });

      if (existingLogin) {
        return {
          success: false,
          message: 'Daily login already recorded for today',
          data: existingLogin
        };
      }

      // Create new daily login record
      const loginRecord: CythroDashDailyLogin = {
        user_id: userId,
        login_date: today,
        login_timestamp: now,
        coins_awarded: coinsAwarded,
        status: DailyLoginStatus.PENDING,
        expires_at: DailyLoginUtils.getExpirationTime(),
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: now,
        updated_at: now
      };

      const result = await collection.insertOne(loginRecord);

      return {
        success: true,
        message: 'Daily login recorded successfully',
        data: { ...loginRecord, _id: result.insertedId }
      };
    } catch (error) {
      console.error('Error recording daily login:', error);
      return {
        success: false,
        message: 'Failed to record daily login',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claim daily login bonus
   */
  static async claimDailyBonus(userId: number): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();
      const today = DailyLoginUtils.getCurrentDate();
      const now = new Date();

      // Find today's login record
      const loginRecord = await collection.findOne({
        user_id: userId,
        login_date: today,
        status: DailyLoginStatus.PENDING
      });

      if (!loginRecord) {
        return {
          success: false,
          message: 'No claimable daily login bonus found for today'
        };
      }

      // Check if expired
      if (now > loginRecord.expires_at) {
        await collection.updateOne(
          { _id: loginRecord._id },
          { 
            $set: { 
              status: DailyLoginStatus.EXPIRED,
              updated_at: now
            }
          }
        );

        return {
          success: false,
          message: 'Daily login bonus has expired'
        };
      }

      // Update status to claimed
      await collection.updateOne(
        { _id: loginRecord._id },
        { 
          $set: { 
            status: DailyLoginStatus.CLAIMED,
            claimed_at: now,
            updated_at: now
          }
        }
      );

      return {
        success: true,
        message: 'Daily login bonus claimed successfully',
        data: {
          coins_awarded: loginRecord.coins_awarded,
          claimed_at: now
        }
      };
    } catch (error) {
      console.error('Error claiming daily bonus:', error);
      return {
        success: false,
        message: 'Failed to claim daily login bonus',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's daily login statistics
   */
  static async getDailyLoginStats(userId: number): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();

      // Get all user's login records
      const loginRecords = await collection.find(
        { user_id: userId },
        { sort: { login_date: -1 } }
      ).toArray();

      if (loginRecords.length === 0) {
        const emptyStats: DailyLoginStats = {
          user_id: userId,
          total_logins: 0,
          current_streak: 0,
          longest_streak: 0,
          total_coins_earned: 0
        };

        return {
          success: true,
          message: 'Daily login statistics retrieved successfully',
          data: emptyStats
        };
      }

      // Calculate statistics
      const totalLogins = loginRecords.length;
      const totalCoinsEarned = loginRecords
        .filter(record => record.status === DailyLoginStatus.CLAIMED)
        .reduce((sum, record) => sum + record.coins_awarded, 0);

      const loginDates = loginRecords.map(record => record.login_date);
      const currentStreak = DailyLoginUtils.calculateStreak(loginDates);
      
      // Calculate longest streak (simplified - could be optimized)
      let longestStreak = 0;
      for (let i = 0; i < loginDates.length; i++) {
        const streak = DailyLoginUtils.calculateStreak(loginDates.slice(i));
        longestStreak = Math.max(longestStreak, streak);
      }

      const stats: DailyLoginStats = {
        user_id: userId,
        total_logins: totalLogins,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_coins_earned: totalCoinsEarned,
        last_login_date: loginRecords[0]?.login_date,
        first_login_date: loginRecords[loginRecords.length - 1]?.login_date
      };

      return {
        success: true,
        message: 'Daily login statistics retrieved successfully',
        data: stats
      };
    } catch (error) {
      console.error('Error getting daily login stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve daily login statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's recent daily login history
   */
  static async getDailyLoginHistory(
    userId: number,
    limit: number = 30,
    offset: number = 0
  ): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();

      const loginRecords = await collection.find(
        { user_id: userId },
        {
          sort: { login_date: -1 },
          skip: offset,
          limit: limit
        }
      ).toArray();

      const total = await collection.countDocuments({ user_id: userId });

      return {
        success: true,
        message: 'Daily login history retrieved successfully',
        data: {
          logins: loginRecords,
          total: total,
          limit: limit,
          offset: offset
        }
      };
    } catch (error) {
      console.error('Error getting daily login history:', error);
      return {
        success: false,
        message: 'Failed to retrieve daily login history',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get daily login analytics for admin
   */
  static async getDailyLoginAnalytics(
    startDate: string,
    endDate: string
  ): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();

      const analytics = await collection.aggregate([
        {
          $match: {
            login_date: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$login_date',
            total_logins: { $sum: 1 },
            unique_users: { $addToSet: '$user_id' },
            total_coins_awarded: { $sum: '$coins_awarded' },
            claimed_count: {
              $sum: {
                $cond: [{ $eq: ['$status', DailyLoginStatus.CLAIMED] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            date: '$_id',
            total_logins: 1,
            unique_users: { $size: '$unique_users' },
            total_coins_awarded: 1,
            claim_rate: {
              $multiply: [
                { $divide: ['$claimed_count', '$total_logins'] },
                100
              ]
            }
          }
        },
        { $sort: { date: 1 } }
      ]).toArray();

      return {
        success: true,
        message: 'Daily login analytics retrieved successfully',
        data: analytics
      };
    } catch (error) {
      console.error('Error getting daily login analytics:', error);
      return {
        success: false,
        message: 'Failed to retrieve daily login analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clean up expired login bonuses
   */
  static async cleanupExpiredBonuses(): Promise<DailyLoginResponse> {
    try {
      const collection = await this.getCollection();
      const now = new Date();

      const result = await collection.updateMany(
        {
          status: DailyLoginStatus.PENDING,
          expires_at: { $lt: now }
        },
        {
          $set: {
            status: DailyLoginStatus.EXPIRED,
            updated_at: now
          }
        }
      );

      return {
        success: true,
        message: `Cleaned up ${result.modifiedCount} expired login bonuses`,
        data: { expired_count: result.modifiedCount }
      };
    } catch (error) {
      console.error('Error cleaning up expired bonuses:', error);
      return {
        success: false,
        message: 'Failed to cleanup expired bonuses',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Close database connection
   */
  static async closeConnection(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
