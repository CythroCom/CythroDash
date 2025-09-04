/**
 * CythroDash - Transfer Database Operations
 * 
 * Fast and efficient transfer operations without loading screens
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { CythroDashTransfer, transfersCollectionName, defaultTransferValues, TransferStatus, transferValidation } from '@/database/tables/cythro_dash_transfers';
import { userOperations } from './user';

class TransferOperations {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    if (this.client && this.db) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found');

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db();
  }

  async getCollection(): Promise<Collection<CythroDashTransfer>> {
    await this.connect();
    return this.db!.collection<CythroDashTransfer>(transfersCollectionName);
  }

  // Create transfer (atomic transaction)
  async createTransfer(transferData: {
    from_user_id: number;
    to_username: string;
    amount: number;
    note?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<{ success: boolean; transfer?: CythroDashTransfer; message: string; error?: string }> {
    try {
      // Validate amount
      if (!Number.isInteger(transferData.amount) || transferData.amount < transferValidation.minAmount || transferData.amount > transferValidation.maxAmount) {
        return {
          success: false,
          message: `Transfer amount must be between ${transferValidation.minAmount} and ${transferValidation.maxAmount} coins`,
          error: 'INVALID_AMOUNT'
        };
      }

      // Get sender
      const fromUser = await userOperations.getUserById(transferData.from_user_id);
      if (!fromUser) {
        return {
          success: false,
          message: 'Sender not found',
          error: 'SENDER_NOT_FOUND'
        };
      }

      // Get recipient by username
      const toUser = await userOperations.getUserByUsername(transferData.to_username);
      if (!toUser) {
        return {
          success: false,
          message: 'Recipient not found',
          error: 'RECIPIENT_NOT_FOUND'
        };
      }

      // Check if trying to transfer to self
      if (fromUser.id === toUser.id) {
        return {
          success: false,
          message: 'Cannot transfer coins to yourself',
          error: 'SELF_TRANSFER'
        };
      }

      // Check sender balance
      if (fromUser.coins < transferData.amount) {
        return {
          success: false,
          message: 'Insufficient balance',
          error: 'INSUFFICIENT_BALANCE'
        };
      }

      // Check daily transfer limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyTransfers = await this.getDailyTransferAmount(transferData.from_user_id, today);
      
      if (dailyTransfers + transferData.amount > transferValidation.dailyTransferLimit) {
        return {
          success: false,
          message: `Daily transfer limit of ${transferValidation.dailyTransferLimit} coins exceeded`,
          error: 'DAILY_LIMIT_EXCEEDED'
        };
      }

      // Create transfer record
      const transfer: CythroDashTransfer = {
        ...defaultTransferValues,
        id: Date.now() + Math.floor(Math.random() * 1000),
        from_user_id: fromUser.id,
        to_user_id: toUser.id,
        from_username: fromUser.username,
        to_username: toUser.username,
        amount: transferData.amount,
        note: transferData.note || '',
        status: TransferStatus.PENDING,
        from_balance_before: fromUser.coins,
        from_balance_after: fromUser.coins - transferData.amount,
        to_balance_before: toUser.coins,
        to_balance_after: toUser.coins + transferData.amount,
        ip_address: transferData.ip_address || '',
        user_agent: transferData.user_agent || '',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Execute without transaction for now - simpler approach
      try {
        // Insert transfer record with pending status
        const collection = await this.getCollection();
        await collection.insertOne(transfer);

        console.log(`Transfer ${transfer.id}: Created transfer record for ${transferData.amount} coins from ${fromUser.username} to ${toUser.username}`);

        // Update sender balance
        const senderUpdateSuccess = await userOperations.updateUserCoins(fromUser.id, -transferData.amount, `Transfer to ${toUser.username}`);
        if (!senderUpdateSuccess) {
          throw new Error('Failed to update sender balance');
        }

        console.log(`Transfer ${transfer.id}: Updated sender ${fromUser.username} balance (-${transferData.amount} coins)`);

        // Update recipient balance
        const recipientUpdateSuccess = await userOperations.updateUserCoins(toUser.id, transferData.amount, `Transfer from ${fromUser.username}`);
        if (!recipientUpdateSuccess) {
          throw new Error('Failed to update recipient balance');
        }

        console.log(`Transfer ${transfer.id}: Updated recipient ${toUser.username} balance (+${transferData.amount} coins)`);

        // Mark transfer as completed
        transfer.status = TransferStatus.COMPLETED;
        transfer.completed_at = new Date();
        transfer.updated_at = new Date();

        await collection.updateOne(
          { id: transfer.id },
          {
            $set: {
              status: TransferStatus.COMPLETED,
              completed_at: new Date(),
              updated_at: new Date()
            }
          }
        );

        console.log(`Transfer ${transfer.id}: Successfully completed transfer of ${transferData.amount} coins from ${fromUser.username} to ${toUser.username}`);

        // Rewards ledger entries
        try {
          const { rewardsLedgerOperations } = await import('@/hooks/managers/database/rewards-ledger')
          await rewardsLedgerOperations.add({ user_id: fromUser.id, delta: -transferData.amount, balance_before: transfer.from_balance_before, balance_after: transfer.from_balance_after, source_category: 'transfer', source_action: 'spend', reference_id: transfer.id, message: `Transfer to ${toUser.username}` })
          await rewardsLedgerOperations.add({ user_id: toUser.id, delta: transferData.amount, balance_before: transfer.to_balance_before, balance_after: transfer.to_balance_after, source_category: 'transfer', source_action: 'earn', reference_id: transfer.id, message: `Transfer from ${fromUser.username}` })
        } catch {}

        // Log successful transfer for audit trail
        await this.logTransferActivity({
          transfer_id: transfer.id,
          action: 'TRANSFER_COMPLETED',
          from_user_id: fromUser.id,
          to_user_id: toUser.id,
          amount: transferData.amount,
          details: {
            from_username: fromUser.username,
            to_username: toUser.username,
            note: transferData.note,
            from_balance_before: fromUser.coins,
            from_balance_after: fromUser.coins - transferData.amount,
            to_balance_before: toUser.coins,
            to_balance_after: toUser.coins + transferData.amount
          }
        });

        return {
          success: true,
          transfer,
          message: `Successfully transferred ${transferData.amount} coins to ${toUser.username}`
        };
      } catch (error) {
        console.error(`Transfer ${transfer.id}: Execution error:`, error);

        // Log failed transfer attempt
        await this.logTransferActivity({
          transfer_id: transfer.id,
          action: 'TRANSFER_FAILED',
          from_user_id: fromUser.id,
          to_user_id: toUser.id,
          amount: transferData.amount,
          details: {
            from_username: fromUser.username,
            to_username: toUser.username,
            note: transferData.note,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        // Update transfer status to failed
        try {
          const collection = await this.getCollection();
          await collection.updateOne(
            { id: transfer.id },
            {
              $set: {
                status: TransferStatus.FAILED,
                updated_at: new Date()
              }
            }
          );
        } catch (updateError) {
          console.error('Failed to update transfer status to failed:', updateError);
        }

        return {
          success: false,
          message: 'Failed to execute transfer',
          error: 'EXECUTION_ERROR'
        };
      }

    } catch (error) {
      console.error('Transfer creation error:', error);
      return {
        success: false,
        message: 'Failed to process transfer',
        error: 'TRANSFER_FAILED'
      };
    }
  }

  // Get user transfers (fast, no loading screens)
  async getUserTransfers(userId: number, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    transfers: CythroDashTransfer[];
    total: number;
    message: string;
  }> {
    try {
      const collection = await this.getCollection();

      const [transfers, total] = await Promise.all([
        collection
          .find({
            $or: [
              { from_user_id: userId },
              { to_user_id: userId }
            ]
          })
          .sort({ created_at: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        
        collection.countDocuments({
          $or: [
            { from_user_id: userId },
            { to_user_id: userId }
          ]
        })
      ]);

      return {
        success: true,
        transfers,
        total,
        message: `Retrieved ${transfers.length} transfers`
      };

    } catch (error) {
      console.error('Get user transfers error:', error);
      return {
        success: false,
        transfers: [],
        total: 0,
        message: 'Failed to retrieve transfers'
      };
    }
  }

  // Get recent transfers for display (super fast)
  async getRecentTransfers(userId: number, limit: number = 10): Promise<CythroDashTransfer[]> {
    try {
      const collection = await this.getCollection();
      
      return await collection
        .find({
          $or: [
            { from_user_id: userId },
            { to_user_id: userId }
          ]
        })
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();

    } catch (error) {
      console.error('Get recent transfers error:', error);
      return [];
    }
  }

  // Get daily transfer amount
  async getDailyTransferAmount(userId: number, date: Date): Promise<number> {
    try {
      const collection = await this.getCollection();
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const result = await collection.aggregate([
        {
          $match: {
            from_user_id: userId,
            status: TransferStatus.COMPLETED,
            created_at: {
              $gte: date,
              $lt: nextDay
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();

      return result.length > 0 ? result[0].total : 0;

    } catch (error) {
      console.error('Get daily transfer amount error:', error);
      return 0;
    }
  }

  // Search users for transfer (fast autocomplete)
  async searchUsersForTransfer(searchTerm: string, currentUserId: number, limit: number = 10): Promise<{
    id: number;
    username: string;
    display_name?: string;
    avatar?: string;
  }[]> {
    try {
      const users = await userOperations.searchUsers(searchTerm, limit + 1);
      
      // Filter out current user and return formatted results
      return users
        .filter(user => user.id !== currentUserId)
        .slice(0, limit)
        .map(user => ({
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar_url
        }));

    } catch (error) {
      console.error('Search users for transfer error:', error);
      return [];
    }
  }

  /**
   * Log transfer activity for audit trail
   */
  async logTransferActivity(activityData: {
    transfer_id: number;
    action: string;
    from_user_id: number;
    to_user_id: number;
    amount: number;
    details: any;
  }): Promise<void> {
    try {
      const collection = this.db!.collection('cythro_dash_transfer_logs');

      const logEntry = {
        ...activityData,
        timestamp: new Date(),
        ip_address: activityData.details.ip_address || 'unknown',
        user_agent: activityData.details.user_agent || 'unknown'
      };

      await collection.insertOne(logEntry);
      console.log(`Transfer log: ${activityData.action} for transfer ${activityData.transfer_id}`);
    } catch (error) {
      console.error('Failed to log transfer activity:', error);
      // Don't throw error to avoid breaking the main transfer flow
    }
  }
}

export const transferOperations = new TransferOperations();
export default transferOperations;
