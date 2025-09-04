/**
 * CythroDash - User Security Logs Database Operations
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, MongoClient, UpdateFilter } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import {
  CythroDashUserLog,
  CreateUserLogData,
  UpdateUserLogData,
  UserLogQuery,
  UserLogStats,
  SecurityLogAction,
  SecurityLogSeverity,
  SecurityLogStatus,
  USER_LOGS_COLLECTION,
  USER_LOGS_INDEXES
} from '../../../database/tables/cythro_dash_users_logs';

// Auto-increment counter for log IDs
let logIdCounter = 0;

// Database collection management
class CythroDashUserLogsCollection {
  private collection!: Collection<CythroDashUserLog>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashUserLog>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    try {
      const  db  = await connectToDatabase();
      this.collection = db.collection<CythroDashUserLog>(USER_LOGS_COLLECTION);

      // Create indexes for optimal performance
      for (const index of USER_LOGS_INDEXES) {
        try {
          await this.collection.createIndex(index.key as any, { name: index.name });
        } catch (error) {
          // Index might already exist, continue
          console.log(`Index ${index.name} already exists or failed to create`);
        }
      }

      // Initialize counter
      const lastLog = await this.collection.findOne({}, { sort: { id: -1 } });
      logIdCounter = lastLog ? lastLog.id : 0;

      this.initialized = true;
      console.log('User logs collection initialized successfully');
    } catch (error) {
      console.error('Failed to initialize user logs collection:', error);
      throw error;
    }
  }

  getNextId(): number {
    return ++logIdCounter;
  }
}

// User logs operations class
class UserLogsOperations {
  private collection = new CythroDashUserLogsCollection();

  // Create a new security log
  async createLog(logData: CreateUserLogData): Promise<CythroDashUserLog> {
    const collection = await this.collection.getCollection();
    
    const newLog: CythroDashUserLog = {
      id: this.collection.getNextId(),
      user_id: logData.user_id,
      action: logData.action,
      severity: logData.severity,
      status: SecurityLogStatus.ACTIVE,
      description: logData.description,
      details: logData.details,
      ip_address: logData.ip_address,
      user_agent: logData.user_agent,
      request_id: logData.request_id,
      country: logData.country,
      region: logData.region,
      city: logData.city,
      device_type: logData.device_type,
      browser: logData.browser,
      os: logData.os,
      session_id: logData.session_id,
      pterodactyl_synced: logData.pterodactyl_synced || false,
      created_at: new Date(),
      updated_at: new Date(),
      is_suspicious: logData.is_suspicious || false,
      requires_attention: logData.requires_attention || false,
      notification_sent: false
    };

    await collection.insertOne(newLog);
    return newLog;
  }

  // Get logs by user ID
  async getLogsByUserId(userId: number, limit: number = 50, offset: number = 0): Promise<CythroDashUserLog[]> {
    const collection = await this.collection.getCollection();
    
    return await collection
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  // Get log by ID
  async getLogById(id: number): Promise<CythroDashUserLog | null> {
    const collection = await this.collection.getCollection();
    return await collection.findOne({ id });
  }

  // Query logs with filters
  async queryLogs(query: UserLogQuery): Promise<CythroDashUserLog[]> {
    const collection = await this.collection.getCollection();
    
    const filter: any = {};
    
    if (query.user_id) filter.user_id = query.user_id;
    if (query.action) {
      filter.action = Array.isArray(query.action) ? { $in: query.action } : query.action;
    }
    if (query.severity) {
      filter.severity = Array.isArray(query.severity) ? { $in: query.severity } : query.severity;
    }
    if (query.status) {
      filter.status = Array.isArray(query.status) ? { $in: query.status } : query.status;
    }
    if (query.is_suspicious !== undefined) filter.is_suspicious = query.is_suspicious;
    if (query.requires_attention !== undefined) filter.requires_attention = query.requires_attention;
    if (query.ip_address) filter.ip_address = query.ip_address;
    
    if (query.date_from || query.date_to) {
      filter.created_at = {};
      if (query.date_from) filter.created_at.$gte = query.date_from;
      if (query.date_to) filter.created_at.$lte = query.date_to;
    }

    const sortField = query.sort_by || 'created_at';
    const sortOrder = query.sort_order === 'asc' ? 1 : -1;
    
    return await collection
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(query.offset || 0)
      .limit(query.limit || 50)
      .toArray();
  }

  // Update a log
  async updateLog(id: number, updateData: UpdateUserLogData): Promise<CythroDashUserLog | null> {
    const collection = await this.collection.getCollection();
    
    const updateDoc: UpdateFilter<CythroDashUserLog> = {
      $set: {
        ...updateData,
        updated_at: new Date()
      }
    };

    await collection.updateOne({ id }, updateDoc);
    return await this.getLogById(id);
  }

  // Mark log as resolved
  async resolveLog(id: number, resolvedBy?: number): Promise<boolean> {
    const collection = await this.collection.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          status: SecurityLogStatus.RESOLVED,
          resolved_at: new Date(),
          resolved_by: resolvedBy,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get user log statistics
  async getUserLogStats(userId: number, days: number = 30): Promise<UserLogStats> {
    const collection = await this.collection.getCollection();
    
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    
    const pipeline = [
      { $match: { user_id: userId, created_at: { $gte: dateFrom } } },
      {
        $group: {
          _id: null,
          total_logs: { $sum: 1 },
          suspicious_activities: { $sum: { $cond: ['$is_suspicious', 1, 0] } },
          unresolved_issues: { $sum: { $cond: [{ $ne: ['$status', SecurityLogStatus.RESOLVED] }, 1, 0] } },
          logs_by_severity: {
            $push: '$severity'
          },
          logs_by_action: {
            $push: '$action'
          }
        }
      }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    
    if (result.length === 0) {
      return {
        total_logs: 0,
        logs_by_severity: {} as Record<SecurityLogSeverity, number>,
        logs_by_action: {} as Record<SecurityLogAction, number>,
        suspicious_activities: 0,
        unresolved_issues: 0,
        recent_activity: 0
      };
    }

    const stats = result[0];
    
    // Count recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentCount = await collection.countDocuments({
      user_id: userId,
      created_at: { $gte: yesterday }
    });

    return {
      total_logs: stats.total_logs,
      logs_by_severity: this.countArrayItems(stats.logs_by_severity),
      logs_by_action: this.countArrayItems(stats.logs_by_action),
      suspicious_activities: stats.suspicious_activities,
      unresolved_issues: stats.unresolved_issues,
      recent_activity: recentCount
    };
  }

  // Helper method to count array items
  private countArrayItems(items: any[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  }

  // Delete old logs (cleanup)
  async deleteOldLogs(daysToKeep: number = 365): Promise<number> {
    const collection = await this.collection.getCollection();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await collection.deleteMany({
      created_at: { $lt: cutoffDate },
      status: SecurityLogStatus.RESOLVED,
      requires_attention: false
    });

    return result.deletedCount || 0;
  }

  // Get suspicious activities
  async getSuspiciousActivities(limit: number = 100): Promise<CythroDashUserLog[]> {
    const collection = await this.collection.getCollection();
    
    return await collection
      .find({ is_suspicious: true, status: { $ne: SecurityLogStatus.RESOLVED } })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  // Get logs requiring attention
  async getLogsRequiringAttention(limit: number = 100): Promise<CythroDashUserLog[]> {
    const collection = await this.collection.getCollection();
    
    return await collection
      .find({ requires_attention: true, status: { $ne: SecurityLogStatus.RESOLVED } })
      .sort({ severity: -1, created_at: -1 })
      .limit(limit)
      .toArray();
  }
}

// Export singleton instance
export const userLogsOperations = new UserLogsOperations();
