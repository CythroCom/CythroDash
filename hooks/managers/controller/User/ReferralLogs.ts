/**
 * CythroDash - Referral Logs Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { loggingOperations } from '../../database/referral-logs';
import {
  ReferralLogType,
  LogSecurityInfo,
  CythroDashReferralLog,
  CythroDashReferralAnalytics
} from '../../../../database/tables/cythro_dash_referral_logs';

// Request interfaces
export interface LogReferralActivityRequest {
  log_type: ReferralLogType;
  user_id?: number;
  referrer_id?: number;
  referred_user_id?: number;
  referral_code?: string;
  click_id?: string;
  activity_data: any;
  ip_address: string;
  user_agent: string;
  device_info?: any;
  session_id?: string;
}

// Removed authentication logging request interface - focusing only on referral logging

export interface GetLogsRequest {
  user_id: number;
  log_type?: ReferralLogType;
  limit?: number;
  offset?: number;
}

export interface GetAnalyticsRequest {
  user_id?: number;
  period_type?: 'daily' | 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
}

// Response interfaces
export interface LogResponse {
  success: boolean;
  message?: string;
  data?: any;
  errors?: Array<{ field: string; message: string }>;
}

export interface LogsResponse extends LogResponse {
  data?: {
    logs: CythroDashReferralLog[];
    total_count: number;
    has_more: boolean;
  };
}

export interface AnalyticsResponse extends LogResponse {
  data?: {
    analytics: CythroDashReferralAnalytics[];
    summary: {
      total_clicks: number;
      total_signups: number;
      total_earnings: number;
      conversion_rate: number;
      top_referrers: Array<{
        user_id: number;
        username: string;
        total_signups: number;
        total_earnings: number;
      }>;
    };
  };
}

// Referral Logs controller class
export class ReferralLogsController {
  /**
   * Log referral activity
   */
  static async logReferralActivity(request: LogReferralActivityRequest): Promise<LogResponse> {
    try {
      // Validate required fields
      if (!request.log_type || !request.ip_address || !request.user_agent) {
        return {
          success: false,
          message: 'Missing required fields',
          errors: [
            { field: 'log_type', message: 'Log type is required' },
            { field: 'ip_address', message: 'IP address is required' },
            { field: 'user_agent', message: 'User agent is required' }
          ]
        };
      }

      // Prepare security info
      const securityInfo: LogSecurityInfo = {
        ip_address: request.ip_address,
        user_agent: request.user_agent,
        screen_resolution: request.device_info?.screen_resolution,
        timezone: request.device_info?.timezone,
        language: request.device_info?.language,
        platform: request.device_info?.platform,
        browser: request.device_info?.browser,
        os: request.device_info?.os,
        device_type: request.device_info?.device_type,
        risk_score: 0, // Will be calculated in database layer
        is_suspicious: false // Will be calculated in database layer
      };

      // Prepare additional data
      const additionalData: Partial<CythroDashReferralLog> = {
        referrer_id: request.referrer_id,
        referred_user_id: request.referred_user_id,
        user_id: request.user_id,
        referral_code: request.referral_code,
        click_id: request.click_id,
        session_id: request.session_id
      };

      // Log the activity
      const success = await loggingOperations.logReferralActivity(
        request.log_type,
        securityInfo,
        request.activity_data,
        additionalData
      );

      if (success) {
        return {
          success: true,
          message: 'Referral activity logged successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to log referral activity'
        };
      }

    } catch (error) {
      console.error('Referral activity logging error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while logging activity',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }

  // Removed authentication activity logging - focusing only on referral logging

  /**
   * Get user referral logs
   */
  static async getUserReferralLogs(request: GetLogsRequest): Promise<LogsResponse> {
    try {
      const limit = Math.min(request.limit || 50, 100); // Max 100 logs per request
      const offset = request.offset || 0;

      const logs = await loggingOperations.getUserReferralLogs(
        request.user_id,
        request.log_type as ReferralLogType,
        limit + 1, // Get one extra to check if there are more
        offset
      );

      const hasMore = logs.length > limit;
      const actualLogs = hasMore ? logs.slice(0, limit) : logs;

      return {
        success: true,
        message: 'Referral logs retrieved successfully',
        data: {
          logs: actualLogs,
          total_count: actualLogs.length,
          has_more: hasMore
        }
      };

    } catch (error) {
      console.error('Get referral logs error:', error);
      return {
        success: false,
        message: 'Failed to retrieve referral logs',
        errors: [{ field: 'general', message: 'An unexpected error occurred' }]
      };
    }
  }

  // Removed authentication logs retrieval - focusing only on referral logging

  /**
   * Get referral analytics
   */
  static async getReferralAnalytics(request: GetAnalyticsRequest): Promise<AnalyticsResponse> {
    try {
      const startDate = request.start_date ? new Date(request.start_date) : undefined;
      const endDate = request.end_date ? new Date(request.end_date) : undefined;

      const analytics = await loggingOperations.getAnalytics(
        request.user_id,
        request.period_type || 'daily',
        startDate,
        endDate
      );

      // Calculate summary statistics
      const summary = {
        total_clicks: analytics.reduce((sum, a) => sum + a.metrics.total_clicks, 0),
        total_signups: analytics.reduce((sum, a) => sum + a.metrics.total_signups, 0),
        total_earnings: analytics.reduce((sum, a) => sum + a.metrics.total_earnings, 0),
        conversion_rate: 0,
        top_referrers: [] as any[]
      };

      summary.conversion_rate = summary.total_clicks > 0 
        ? Math.round((summary.total_signups / summary.total_clicks) * 100 * 100) / 100 
        : 0;

      return {
        success: true,
        message: 'Referral analytics retrieved successfully',
        data: {
          analytics,
          summary
        }
      };

    } catch (error) {
      console.error('Get referral analytics error:', error);
      return {
        success: false,
        message: 'Failed to retrieve referral analytics',
        errors: [{ field: 'general', message: 'An unexpected error occurred' }]
      };
    }
  }

  /**
   * Update analytics (admin function)
   */
  static async updateAnalytics(): Promise<LogResponse> {
    try {
      const success = await loggingOperations.updateAnalytics();

      if (success) {
        return {
          success: true,
          message: 'Analytics updated successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to update analytics'
        };
      }

    } catch (error) {
      console.error('Update analytics error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while updating analytics',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }
}
