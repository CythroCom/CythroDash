/**
 * CythroDash - Social Verifications Database Operations
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { 
  CythroDashSocialVerification, 
  VerificationStatus, 
  SocialPlatform, 
  VerificationAction 
} from '@/database/tables/cythro_dash_social_verifications';

// MongoDB connection
let client: MongoClient | null = null;
let db: Db | null = null;

async function getDatabase(): Promise<Db> {
  if (!client || !db) {
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('DATABASE environment variable is not set');
    }

    client = new MongoClient(connectionString);
    await client.connect();
    db = client.db();
  }
  return db;
}

// Collection wrapper
const socialVerificationsCollection = {
  async getCollection(): Promise<Collection<CythroDashSocialVerification>> {
    const database = await getDatabase();
    return database.collection<CythroDashSocialVerification>('cythro_dash_social_verifications');
  }
};

export const socialVerificationOperations = {
  
  /**
   * Create a new social verification
   */
  async createVerification(verification: Omit<CythroDashSocialVerification, '_id'>): Promise<CythroDashSocialVerification> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const result = await collection.insertOne(verification);
    
    return {
      ...verification,
      _id: result.insertedId
    };
  },

  /**
   * Get verification by ID
   */
  async getVerificationById(id: string): Promise<CythroDashSocialVerification | null> {
    const collection = await socialVerificationsCollection.getCollection();
    
    return await collection.findOne({ _id: new ObjectId(id) });
  },

  /**
   * Get verification by user and platform
   */
  async getVerificationByUserAndPlatform(
    userId: number, 
    platform: SocialPlatform, 
    action: VerificationAction,
    targetId?: string
  ): Promise<CythroDashSocialVerification | null> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const query: any = {
      user_id: userId,
      platform,
      action
    };

    if (targetId) {
      query.target_id = targetId;
    }

    return await collection.findOne(query);
  },

  /**
   * Get all verifications for a user
   */
  async getUserVerifications(userId: number): Promise<CythroDashSocialVerification[]> {
    const collection = await socialVerificationsCollection.getCollection();
    
    return await collection.find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  },

  /**
   * Get verifications by status
   */
  async getVerificationsByStatus(status: VerificationStatus): Promise<CythroDashSocialVerification[]> {
    const collection = await socialVerificationsCollection.getCollection();
    
    return await collection.find({ status }).toArray();
  },

  /**
   * Update verification
   */
  async updateVerification(
    id: string, 
    updates: Partial<CythroDashSocialVerification>
  ): Promise<CythroDashSocialVerification> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updated_at: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Verification not found');
    }

    return result;
  },

  /**
   * Update verification status
   */
  async updateVerificationStatus(
    id: string, 
    status: VerificationStatus, 
    errorMessage?: string
  ): Promise<CythroDashSocialVerification> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const updates: any = {
      status,
      updated_at: new Date()
    };

    if (status === VerificationStatus.VERIFIED) {
      updates.verified_at = new Date();
      updates.error_message = undefined;
      updates.error_code = undefined;
    } else if (status === VerificationStatus.FAILED && errorMessage) {
      updates.error_message = errorMessage;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Verification not found');
    }

    return result;
  },

  /**
   * Get verifications that need rechecking
   */
  async getVerificationsNeedingRecheck(intervalHours: number = 24): Promise<CythroDashSocialVerification[]> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const cutoffTime = new Date(Date.now() - (intervalHours * 60 * 60 * 1000));
    
    return await collection.find({
      status: VerificationStatus.VERIFIED,
      $or: [
        { last_check: { $lt: cutoffTime } },
        { last_check: { $exists: false } }
      ]
    }).toArray();
  },

  /**
   * Get unclaimed verified verifications for a user
   */
  async getUnclaimedVerifications(userId: number): Promise<CythroDashSocialVerification[]> {
    const collection = await socialVerificationsCollection.getCollection();
    
    return await collection.find({
      user_id: userId,
      status: VerificationStatus.VERIFIED,
      claimed: false
    }).toArray();
  },

  /**
   * Get verification statistics for a user
   */
  async getUserVerificationStats(userId: number): Promise<{
    total_verifications: number;
    verified_count: number;
    pending_count: number;
    failed_count: number;
    total_coins_earned: number;
    unclaimed_coins: number;
  }> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const verifications = await collection.find({ user_id: userId }).toArray();
    
    const stats = {
      total_verifications: verifications.length,
      verified_count: verifications.filter(v => v.status === VerificationStatus.VERIFIED).length,
      pending_count: verifications.filter(v => v.status === VerificationStatus.PENDING).length,
      failed_count: verifications.filter(v => v.status === VerificationStatus.FAILED).length,
      total_coins_earned: verifications.filter(v => v.claimed).reduce((sum, v) => sum + v.coins_reward, 0),
      unclaimed_coins: verifications.filter(v => v.status === VerificationStatus.VERIFIED && !v.claimed).reduce((sum, v) => sum + v.coins_reward, 0)
    };

    return stats;
  },

  /**
   * Delete verification
   */
  async deleteVerification(id: string): Promise<boolean> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  },

  /**
   * Get platform statistics
   */
  async getPlatformStats(): Promise<{
    platform: SocialPlatform;
    total_verifications: number;
    verified_count: number;
    total_rewards_claimed: number;
  }[]> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const stats = await collection.aggregate([
      {
        $group: {
          _id: '$platform',
          total_verifications: { $sum: 1 },
          verified_count: {
            $sum: {
              $cond: [{ $eq: ['$status', VerificationStatus.VERIFIED] }, 1, 0]
            }
          },
          total_rewards_claimed: {
            $sum: {
              $cond: ['$claimed', '$coins_reward', 0]
            }
          }
        }
      }
    ]).toArray();

    return stats.map(stat => ({
      platform: stat._id,
      total_verifications: stat.total_verifications,
      verified_count: stat.verified_count,
      total_rewards_claimed: stat.total_rewards_claimed
    }));
  },

  /**
   * Clean up expired verifications
   */
  async cleanupExpiredVerifications(): Promise<number> {
    const collection = await socialVerificationsCollection.getCollection();
    
    const result = await collection.updateMany(
      {
        expires_at: { $lt: new Date() },
        status: { $ne: VerificationStatus.EXPIRED }
      },
      {
        $set: {
          status: VerificationStatus.EXPIRED,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount;
  }
};
