/**
 * CythroDash - Redeem Codes Database Operations
 * 
 * Handles redeem code creation, management, and redemption operations
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { 
  CythroDashCode, 
  CythroDashCodeRedemption,
  codesCollectionName,
  codeRedemptionsCollectionName,
  defaultCodeValues,
  defaultRedemptionValues,
  CodeStatus,
  codeValidation,
  codeHelpers,
  CODES_INDEXES,
  CODE_REDEMPTIONS_INDEXES
} from '@/database/tables/cythro_dash_codes';
import { userOperations } from './user';

class CodeOperations {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    if (this.client && this.db) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found');

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db();
    
    // Create indexes on first connection
    await this.createIndexes();
  }

  async getCollection(): Promise<Collection<CythroDashCode>> {
    await this.connect();
    return this.db!.collection<CythroDashCode>(codesCollectionName);
  }

  async getRedemptionsCollection(): Promise<Collection<CythroDashCodeRedemption>> {
    await this.connect();
    return this.db!.collection<CythroDashCodeRedemption>(codeRedemptionsCollectionName);
  }

  private async createIndexes(): Promise<void> {
    try {
      const codesCollection = await this.getCollection();
      const redemptionsCollection = await this.getRedemptionsCollection();

      // Create codes indexes
      for (const index of CODES_INDEXES) {
        await codesCollection.createIndex(index.key as any, {
          name: index.name,
          unique: index.unique || false
        });
      }

      // Create redemptions indexes
      for (const index of CODE_REDEMPTIONS_INDEXES) {
        await redemptionsCollection.createIndex(index.key as any, {
          name: index.name,
          unique: index.unique || false
        });
      }

      console.log('Redeem codes database indexes created successfully');
    } catch (error) {
      console.error('Error creating redeem codes database indexes:', error);
    }
  }

  // Create a new redeem code (Admin only)
  async createCode(codeData: {
    code?: string; // If not provided, will generate random
    coins_value: number;
    max_uses: number;
    expiry_date?: Date;
    created_by_admin_id: number;
    description?: string;
    internal_notes?: string;
    allowed_user_ids?: number[];
    restricted_to_new_users?: boolean;
  }): Promise<{ success: boolean; code?: CythroDashCode; message: string; error?: string }> {
    try {
      // Validate coins value
      if (!codeHelpers.isValidCoinsValue(codeData.coins_value)) {
        return {
          success: false,
          message: `Coins value must be between ${codeValidation.minCoinsValue} and ${codeValidation.maxCoinsValue}`,
          error: 'INVALID_COINS_VALUE'
        };
      }

      // Generate code if not provided
      let codeString = codeData.code;
      if (!codeString) {
        codeString = codeHelpers.generateRandomCode();
      }

      // Validate code format
      if (!codeHelpers.isValidCodeFormat(codeString)) {
        return {
          success: false,
          message: 'Invalid code format. Use only letters, numbers, hyphens, and underscores.',
          error: 'INVALID_CODE_FORMAT'
        };
      }

      // Check if code already exists
      const collection = await this.getCollection();
      const existingCode = await collection.findOne({ code: codeString });
      if (existingCode) {
        return {
          success: false,
          message: 'A code with this value already exists',
          error: 'CODE_EXISTS'
        };
      }

      // Create code record
      const code: CythroDashCode = {
        ...defaultCodeValues,
        id: codeHelpers.generateCodeId(),
        code: codeString,
        coins_value: codeData.coins_value,
        max_uses: codeData.max_uses,
        expiry_date: codeData.expiry_date,
        created_by_admin_id: codeData.created_by_admin_id,
        description: codeData.description,
        internal_notes: codeData.internal_notes,
        allowed_user_ids: codeData.allowed_user_ids,
        restricted_to_new_users: codeData.restricted_to_new_users || false,
        created_at: new Date(),
        updated_at: new Date()
      } as CythroDashCode;

      // Insert code into database
      await collection.insertOne(code);

      console.log(`Code created: ${code.code} (${code.coins_value} coins) by admin ${codeData.created_by_admin_id}`);

      return {
        success: true,
        code,
        message: `Code ${code.code} created successfully`
      };

    } catch (error) {
      console.error('Create code error:', error);
      return {
        success: false,
        message: 'Failed to create code',
        error: 'CREATE_ERROR'
      };
    }
  }

  // Redeem a code (User action)
  async redeemCode(redemptionData: {
    code: string;
    user_id: number;
    username: string;
    ip_address: string;
    user_agent: string;
  }): Promise<{ success: boolean; coins_awarded?: number; message: string; error?: string }> {
    try {
      // Validate code format
      if (!codeHelpers.isValidCodeFormat(redemptionData.code)) {
        return {
          success: false,
          message: 'Invalid code format',
          error: 'INVALID_FORMAT'
        };
      }

      // Get the code
      const collection = await this.getCollection();
      const code = await collection.findOne({ code: redemptionData.code });

      if (!code) {
        return {
          success: false,
          message: 'Code not found',
          error: 'CODE_NOT_FOUND'
        };
      }

      // Check if code can be redeemed
      if (!codeHelpers.canRedeemCode(code)) {
        let reason = 'Code cannot be redeemed';
        if (!code.is_active) reason = 'Code is inactive';
        else if (codeHelpers.isCodeExpired(code)) reason = 'Code has expired';
        else if (codeHelpers.isCodeDepleted(code)) reason = 'Code has reached maximum uses';

        return {
          success: false,
          message: reason,
          error: 'CODE_UNAVAILABLE'
        };
      }

      // Check user restrictions
      if (code.allowed_user_ids && !code.allowed_user_ids.includes(redemptionData.user_id)) {
        return {
          success: false,
          message: 'You are not authorized to use this code',
          error: 'USER_NOT_ALLOWED'
        };
      }

      // Check if user already redeemed this code (for single-use codes)
      const redemptionsCollection = await this.getRedemptionsCollection();
      const existingRedemption = await redemptionsCollection.findOne({
        code_id: code.id,
        user_id: redemptionData.user_id,
        status: 'completed'
      });

      if (existingRedemption && code.max_uses === 1) {
        return {
          success: false,
          message: 'You have already redeemed this code',
          error: 'ALREADY_REDEEMED'
        };
      }

      // Rate limiting checks
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [hourlyRedemptions, dailyRedemptions] = await Promise.all([
        redemptionsCollection.countDocuments({
          ip_address: redemptionData.ip_address,
          redeemed_at: { $gte: oneHourAgo },
          status: 'completed'
        }),
        redemptionsCollection.countDocuments({
          user_id: redemptionData.user_id,
          redeemed_at: { $gte: oneDayAgo },
          status: 'completed'
        })
      ]);

      if (hourlyRedemptions >= codeValidation.maxRedemptionsPerIPPerHour) {
        return {
          success: false,
          message: 'Too many redemptions from this IP address. Please try again later.',
          error: 'RATE_LIMITED_IP'
        };
      }

      if (dailyRedemptions >= codeValidation.maxRedemptionsPerUserPerDay) {
        return {
          success: false,
          message: 'Daily redemption limit reached. Please try again tomorrow.',
          error: 'RATE_LIMITED_USER'
        };
      }

      // Get user for balance tracking
      const user = await userOperations.getUserById(redemptionData.user_id);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check new user restriction
      if (code.restricted_to_new_users) {
        const userAge = now.getTime() - user.created_at.getTime();
        const maxNewUserAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (userAge > maxNewUserAge) {
          return {
            success: false,
            message: 'This code is only available for new users',
            error: 'NOT_NEW_USER'
          };
        }
      }

      // Create redemption record
      const redemption: CythroDashCodeRedemption = {
        ...defaultRedemptionValues,
        id: codeHelpers.generateRedemptionId(),
        code_id: code.id,
        code: code.code,
        user_id: redemptionData.user_id,
        username: redemptionData.username,
        coins_awarded: code.coins_value,
        redeemed_at: now,
        ip_address: redemptionData.ip_address,
        user_agent: redemptionData.user_agent,
        user_balance_before: user.coins,
        user_balance_after: user.coins + code.coins_value,
        status: 'completed',
        created_at: now,
        updated_at: now
      } as CythroDashCodeRedemption;

      // Execute redemption (update user balance, increment code usage, create redemption record)
      await redemptionsCollection.insertOne(redemption);

      // Update user coins
      const updateSuccess = await userOperations.updateUserCoins(
        redemptionData.user_id,
        code.coins_value,
        `Redeemed code: ${code.code}`
      );
      try {
        const { rewardsLedgerOperations } = await import('@/hooks/managers/database/rewards-ledger')
        await rewardsLedgerOperations.add({
          user_id: redemptionData.user_id,
          delta: code.coins_value,
          balance_before: redemption.user_balance_before,
          balance_after: redemption.user_balance_after,
          source_category: 'redeem_code',
          source_action: 'earn',
          reference_id: redemption.id,
          message: `Redeemed ${code.code}`,
        })
      } catch {}

      if (!updateSuccess) {
        // Rollback redemption record
        await redemptionsCollection.updateOne(
          { id: redemption.id },
          { $set: { status: 'failed', error_message: 'Failed to update user balance' } }
        );

        return {
          success: false,
          message: 'Failed to update user balance',
          error: 'BALANCE_UPDATE_FAILED'
        };
      }

      // Update code usage count and status
      const newUsageCount = code.current_uses + 1;
      const newStatus = codeHelpers.updateCodeStatus({
        ...code,
        current_uses: newUsageCount
      });

      await collection.updateOne(
        { id: code.id },
        {
          $set: {
            current_uses: newUsageCount,
            status: newStatus,
            last_used_at: now,
            updated_at: now,
            ...(code.current_uses === 0 ? { first_used_at: now } : {})
          }
        }
      );

      console.log(`Code redeemed: ${code.code} by user ${redemptionData.username} (${code.coins_value} coins)`);

      return {
        success: true,
        coins_awarded: code.coins_value,
        message: `Successfully redeemed ${code.coins_value} coins!`
      };

    } catch (error) {
      console.error('Redeem code error:', error);
      return {
        success: false,
        message: 'Failed to redeem code',
        error: 'REDEMPTION_ERROR'
      };
    }
  }

  // Get all codes (Admin only)
  async getAllCodes(limit: number = 50, offset: number = 0, filters?: {
    status?: CodeStatus;
    created_by?: number;
    search?: string;
  }): Promise<{
    success: boolean;
    codes: CythroDashCode[];
    total: number;
    message: string;
  }> {
    try {
      const collection = await this.getCollection();

      // Build query
      const query: any = {};
      if (filters?.status) query.status = filters.status;
      if (filters?.created_by) query.created_by_admin_id = filters.created_by;
      if (filters?.search) {
        query.$or = [
          { code: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const [codes, total] = await Promise.all([
        collection
          .find(query)
          .sort({ created_at: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        collection.countDocuments(query)
      ]);

      return {
        success: true,
        codes,
        total,
        message: `Retrieved ${codes.length} codes`
      };

    } catch (error) {
      console.error('Get all codes error:', error);
      return {
        success: false,
        codes: [],
        total: 0,
        message: 'Failed to retrieve codes'
      };
    }
  }

  // Get code by ID (Admin only)
  async getCodeById(id: number): Promise<CythroDashCode | null> {
    try {
      const collection = await this.getCollection();
      return await collection.findOne({ id });
    } catch (error) {
      console.error('Get code by ID error:', error);
      return null;
    }
  }

  // Update code (Admin only)
  async updateCode(id: number, updateData: {
    coins_value?: number;
    max_uses?: number;
    expiry_date?: Date;
    is_active?: boolean;
    description?: string;
    internal_notes?: string;
    allowed_user_ids?: number[];
    restricted_to_new_users?: boolean;
  }): Promise<{ success: boolean; code?: CythroDashCode; message: string; error?: string }> {
    try {
      const collection = await this.getCollection();

      // Get existing code
      const existingCode = await collection.findOne({ id });
      if (!existingCode) {
        return {
          success: false,
          message: 'Code not found',
          error: 'CODE_NOT_FOUND'
        };
      }

      // Validate coins value if provided
      if (updateData.coins_value && !codeHelpers.isValidCoinsValue(updateData.coins_value)) {
        return {
          success: false,
          message: `Coins value must be between ${codeValidation.minCoinsValue} and ${codeValidation.maxCoinsValue}`,
          error: 'INVALID_COINS_VALUE'
        };
      }

      // Update code status if necessary
      const updatedCode = { ...existingCode, ...updateData };
      const newStatus = codeHelpers.updateCodeStatus(updatedCode);

      const updateDoc = {
        ...updateData,
        status: newStatus,
        updated_at: new Date()
      };

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedCodeRecord = await collection.findOne({ id });

      console.log(`Code updated: ${existingCode.code} (ID: ${id})`);

      return {
        success: true,
        code: updatedCodeRecord!,
        message: 'Code updated successfully'
      };

    } catch (error) {
      console.error('Update code error:', error);
      return {
        success: false,
        message: 'Failed to update code',
        error: 'UPDATE_ERROR'
      };
    }
  }

  // Delete code (Admin only)
  async deleteCode(id: number): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const collection = await this.getCollection();

      // Check if code exists
      const existingCode = await collection.findOne({ id });
      if (!existingCode) {
        return {
          success: false,
          message: 'Code not found',
          error: 'CODE_NOT_FOUND'
        };
      }

      // Check if code has been used
      const redemptionsCollection = await this.getRedemptionsCollection();
      const redemptionCount = await redemptionsCollection.countDocuments({
        code_id: id,
        status: 'completed'
      });

      if (redemptionCount > 0) {
        return {
          success: false,
          message: 'Cannot delete code that has been redeemed. Deactivate it instead.',
          error: 'CODE_HAS_REDEMPTIONS'
        };
      }

      // Delete the code
      await collection.deleteOne({ id });

      console.log(`Code deleted: ${existingCode.code} (ID: ${id})`);

      return {
        success: true,
        message: 'Code deleted successfully'
      };

    } catch (error) {
      console.error('Delete code error:', error);
      return {
        success: false,
        message: 'Failed to delete code',
        error: 'DELETE_ERROR'
      };
    }
  }

  // Get user redemptions
  async getUserRedemptions(userId: number, limit: number = 20, offset: number = 0): Promise<{
    success: boolean;
    redemptions: CythroDashCodeRedemption[];
    total: number;
    message: string;
  }> {
    try {
      const redemptionsCollection = await this.getRedemptionsCollection();

      const [redemptions, total] = await Promise.all([
        redemptionsCollection
          .find({ user_id: userId })
          .sort({ redeemed_at: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        redemptionsCollection.countDocuments({ user_id: userId })
      ]);

      return {
        success: true,
        redemptions,
        total,
        message: `Retrieved ${redemptions.length} redemptions`
      };

    } catch (error) {
      console.error('Get user redemptions error:', error);
      return {
        success: false,
        redemptions: [],
        total: 0,
        message: 'Failed to retrieve redemptions'
      };
    }
  }

  // Get code statistics (Admin only)
  async getCodeStatistics(codeId: number): Promise<{
    success: boolean;
    stats?: {
      total_redemptions: number;
      unique_users: number;
      total_coins_awarded: number;
      first_redemption?: Date;
      last_redemption?: Date;
      redemptions_by_day: Array<{ date: string; count: number }>;
    };
    message: string;
  }> {
    try {
      const redemptionsCollection = await this.getRedemptionsCollection();

      const [basicStats, redemptionsByDay] = await Promise.all([
        redemptionsCollection.aggregate([
          { $match: { code_id: codeId, status: 'completed' } },
          {
            $group: {
              _id: null,
              total_redemptions: { $sum: 1 },
              unique_users: { $addToSet: '$user_id' },
              total_coins_awarded: { $sum: '$coins_awarded' },
              first_redemption: { $min: '$redeemed_at' },
              last_redemption: { $max: '$redeemed_at' }
            }
          },
          {
            $project: {
              total_redemptions: 1,
              unique_users: { $size: '$unique_users' },
              total_coins_awarded: 1,
              first_redemption: 1,
              last_redemption: 1
            }
          }
        ]).toArray(),

        redemptionsCollection.aggregate([
          { $match: { code_id: codeId, status: 'completed' } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$redeemed_at' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          { $project: { date: '$_id', count: 1, _id: 0 } }
        ]).toArray()
      ]);

      const stats = basicStats[0] || {
        total_redemptions: 0,
        unique_users: 0,
        total_coins_awarded: 0,
        first_redemption: undefined,
        last_redemption: undefined
      };

      const formattedRedemptionsByDay = redemptionsByDay.map((item: any) => ({
        date: item.date,
        count: item.count
      }));

      return {
        success: true,
        stats: {
          total_redemptions: stats.total_redemptions,
          unique_users: stats.unique_users,
          total_coins_awarded: stats.total_coins_awarded,
          first_redemption: stats.first_redemption,
          last_redemption: stats.last_redemption,
          redemptions_by_day: formattedRedemptionsByDay
        },
        message: 'Statistics retrieved successfully'
      };

    } catch (error) {
      console.error('Get code statistics error:', error);
      return {
        success: false,
        message: 'Failed to retrieve statistics'
      };
    }
  }
}

export const codeOperations = new CodeOperations();
export default codeOperations;
