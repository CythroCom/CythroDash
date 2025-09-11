/**
 * CythroDash - Security Logs Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userLogsOperations } from '../../database/user-logs';
import { LogCategory } from '@/types/errors-and-logs';
import {
  CythroDashUserLog,
  CreateUserLogData,
  UpdateUserLogData,
  UserLogQuery,
  UserLogStats,
  SecurityLogAction,
  SecurityLogSeverity,
  SecurityLogStatus
} from '../../../../database/tables/cythro_dash_users_logs';

// Request interfaces
export interface CreateLogRequest {
  user_id: number;
  action: SecurityLogAction;
  severity?: SecurityLogSeverity;
  description: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  session_id?: string;
  is_suspicious?: boolean;
  requires_attention?: boolean;
}

export interface GetUserLogsRequest {
  user_id: number;
  limit?: number;
  offset?: number;
  action?: SecurityLogAction | SecurityLogAction[];
  severity?: SecurityLogSeverity | SecurityLogSeverity[];
  status?: SecurityLogStatus | SecurityLogStatus[];
  date_from?: Date;
  date_to?: Date;
}

export interface UpdateLogRequest {
  log_id: number;
  status?: SecurityLogStatus;
  severity?: SecurityLogSeverity;
  resolved_by?: number;
  requires_attention?: boolean;
}

// Response interfaces
export interface SecurityLogResponse {
  success: boolean;
  message?: string;
  log?: CythroDashUserLog;
  logs?: CythroDashUserLog[];
  stats?: UserLogStats;
  errors?: Array<{ field: string; message: string }>;
}

// Security Logs Controller
export class SecurityLogsController {

  /**
   * Create a new security log entry
   */
  static async createLog(request: CreateLogRequest): Promise<SecurityLogResponse> {
    try {
      console.log(`Creating security log for user ${request.user_id}: ${request.action}`);

      // Validate request
      const validation = this.validateCreateLogRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Determine severity if not provided
      const severity = request.severity || this.determineSeverity(request.action);

      // Parse user agent for device information
      const deviceInfo = this.parseUserAgent(request.user_agent);

      // Create log data
      const logData: CreateUserLogData = {
        user_id: request.user_id,
        action: request.action,
        severity: severity,
        description: request.description,
        details: request.details,
        ip_address: request.ip_address,
        user_agent: request.user_agent,
        request_id: request.request_id,
        session_id: request.session_id,
        device_type: deviceInfo.device_type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        is_suspicious: request.is_suspicious || this.isSuspiciousAction(request.action),
        requires_attention: request.requires_attention || this.requiresAttention(request.action, severity)
      };

      // Create the log
      const log = await userLogsOperations.createLog(logData);

      console.log(`Security log created successfully: ${log.id}`);

      return {
        success: true,
        message: 'Security log created successfully',
        log: log
      };

    } catch (error) {
      console.error('Error creating security log:', error);
      return {
        success: false,
        message: 'Failed to create security log',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }

  /**
   * Get security logs for a user
   */
  static async getUserLogs(request: GetUserLogsRequest): Promise<SecurityLogResponse> {
    try {
      console.log(`Getting security logs for user ${request.user_id}`);

      // Build query
      const query: UserLogQuery = {
        user_id: request.user_id,
        limit: request.limit || 50,
        offset: request.offset || 0,
        action: request.action,
        severity: request.severity,
        status: request.status,
        date_from: request.date_from,
        date_to: request.date_to,
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      // Get logs
      const logs = await userLogsOperations.queryLogs(query);

      console.log(`Retrieved ${logs.length} security logs for user ${request.user_id}`);

      return {
        success: true,
        message: 'Security logs retrieved successfully',
        logs: logs
      };

    } catch (error) {
      console.error('Error getting user security logs:', error);
      return {
        success: false,
        message: 'Failed to retrieve security logs',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }

  /**
   * Get user security statistics
   */
  static async getUserStats(userId: number, days: number = 30): Promise<SecurityLogResponse> {
    try {
      console.log(`Getting security stats for user ${userId} (${days} days)`);

      const stats = await userLogsOperations.getUserLogStats(userId, days);

      return {
        success: true,
        message: 'Security statistics retrieved successfully',
        stats: stats
      };

    } catch (error) {
      console.error('Error getting user security stats:', error);
      return {
        success: false,
        message: 'Failed to retrieve security statistics',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }

  /**
   * Update a security log
   */
  static async updateLog(request: UpdateLogRequest): Promise<SecurityLogResponse> {
    try {
      console.log(`Updating security log ${request.log_id}`);

      const updateData: UpdateUserLogData = {
        status: request.status,
        severity: request.severity,
        resolved_by: request.resolved_by,
        requires_attention: request.requires_attention
      };

      if (request.status === SecurityLogStatus.RESOLVED) {
        updateData.resolved_at = new Date();
      }

      const updatedLog = await userLogsOperations.updateLog(request.log_id, updateData);

      if (!updatedLog) {
        return {
          success: false,
          message: 'Security log not found',
          errors: [{ field: 'log_id', message: 'Security log not found' }]
        };
      }

      return {
        success: true,
        message: 'Security log updated successfully',
        log: updatedLog
      };

    } catch (error) {
      console.error('Error updating security log:', error);
      return {
        success: false,
        message: 'Failed to update security log',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }

  /**
   * Log user authentication events
   */
  static async logAuthEvent(
    userId: number,
    action: SecurityLogAction,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: any
  ): Promise<void> {
    const severity = success ? SecurityLogSeverity.LOW : SecurityLogSeverity.MEDIUM;
    const description = this.getAuthEventDescription(action, success);

    await this.createLog({
      user_id: userId,
      action: action,
      severity: severity,
      description: description,
      details: { ...(details || {}), category: LogCategory.ACCOUNT },
      ip_address: ipAddress,
      user_agent: userAgent,
      is_suspicious: !success
    });
  }

  /**
   * Log password change events
   */
  static async logPasswordChange(
    userId: number,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    pterodactylSynced?: boolean
  ): Promise<void> {
    await this.createLog({
      user_id: userId,
      action: SecurityLogAction.PASSWORD_CHANGED,
      severity: SecurityLogSeverity.MEDIUM,
      description: success ? 'Password changed successfully' : 'Password change failed',
      details: { pterodactyl_synced: pterodactylSynced, category: LogCategory.ACCOUNT },
      ip_address: ipAddress,
      user_agent: userAgent,
      requires_attention: !success
    });
  }

  /**
   * Log profile update events
   */
  static async logProfileUpdate(
    userId: number,
    changes: string[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      user_id: userId,
      action: SecurityLogAction.PROFILE_UPDATED,
      severity: SecurityLogSeverity.LOW,
      description: `Profile updated: ${changes.join(', ')}`,
      details: { changed_fields: changes, category: LogCategory.ACCOUNT },
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  // Private helper methods
  private static validateCreateLogRequest(request: CreateLogRequest): { isValid: boolean; errors: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    if (!request.user_id || request.user_id <= 0) {
      errors.push({ field: 'user_id', message: 'Valid user ID is required' });
    }

    if (!request.action) {
      errors.push({ field: 'action', message: 'Action is required' });
    }

    if (!request.description || request.description.trim().length === 0) {
      errors.push({ field: 'description', message: 'Description is required' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static determineSeverity(action: SecurityLogAction): SecurityLogSeverity {
    const highSeverityActions = [
      SecurityLogAction.ACCOUNT_LOCKED,
      SecurityLogAction.ACCOUNT_BANNED,
      SecurityLogAction.MULTIPLE_FAILED_LOGINS,
      SecurityLogAction.SUSPICIOUS_LOGIN_LOCATION
    ];

    const mediumSeverityActions = [
      SecurityLogAction.PASSWORD_CHANGED,
      SecurityLogAction.EMAIL_CHANGED,
      SecurityLogAction.TWO_FACTOR_DISABLED,
      SecurityLogAction.LOGIN_FAILED
    ];

    if (highSeverityActions.includes(action)) {
      return SecurityLogSeverity.HIGH;
    } else if (mediumSeverityActions.includes(action)) {
      return SecurityLogSeverity.MEDIUM;
    } else {
      return SecurityLogSeverity.LOW;
    }
  }

  private static isSuspiciousAction(action: SecurityLogAction): boolean {
    const suspiciousActions = [
      SecurityLogAction.MULTIPLE_FAILED_LOGINS,
      SecurityLogAction.SUSPICIOUS_LOGIN_LOCATION,
      SecurityLogAction.UNUSUAL_ACTIVITY
    ];

    return suspiciousActions.includes(action);
  }

  private static requiresAttention(action: SecurityLogAction, severity: SecurityLogSeverity): boolean {
    return severity === SecurityLogSeverity.HIGH || severity === SecurityLogSeverity.CRITICAL;
  }

  private static parseUserAgent(userAgent?: string): { device_type?: string; browser?: string; os?: string } {
    if (!userAgent) return {};

    // Simple user agent parsing (you might want to use a library like 'ua-parser-js' for better parsing)
    const result: { device_type?: string; browser?: string; os?: string } = {};

    // Device type detection
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      result.device_type = 'mobile';
    } else if (/Tablet|iPad/.test(userAgent)) {
      result.device_type = 'tablet';
    } else {
      result.device_type = 'desktop';
    }

    // Browser detection
    if (/Chrome/.test(userAgent)) {
      result.browser = 'Chrome';
    } else if (/Firefox/.test(userAgent)) {
      result.browser = 'Firefox';
    } else if (/Safari/.test(userAgent)) {
      result.browser = 'Safari';
    } else if (/Edge/.test(userAgent)) {
      result.browser = 'Edge';
    }

    // OS detection
    if (/Windows/.test(userAgent)) {
      result.os = 'Windows';
    } else if (/Mac OS/.test(userAgent)) {
      result.os = 'macOS';
    } else if (/Linux/.test(userAgent)) {
      result.os = 'Linux';
    } else if (/Android/.test(userAgent)) {
      result.os = 'Android';
    } else if (/iOS/.test(userAgent)) {
      result.os = 'iOS';
    }

    return result;
  }

  private static getAuthEventDescription(action: SecurityLogAction, success: boolean): string {
    switch (action) {
      case SecurityLogAction.LOGIN_SUCCESS:
        return 'User logged in successfully';
      case SecurityLogAction.LOGIN_FAILED:
        return 'Login attempt failed';
      case SecurityLogAction.LOGOUT:
        return 'User logged out';
      case SecurityLogAction.SESSION_EXPIRED:
        return 'User session expired';
      default:
        return success ? 'Authentication event succeeded' : 'Authentication event failed';
    }
  }
}
