/**
 * CythroDash - Referral Logs Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Log types for different referral activities
export enum ReferralLogType {
  CLICK = 'click',
  SIGNUP = 'signup',
  CLAIM = 'claim',
  TIER_UPGRADE = 'tier_upgrade'
}

// Removed authentication log types - focusing only on referral logging

// Device and security information
export interface LogSecurityInfo {
  ip_address: string;
  user_agent: string;
  device_fingerprint?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  browser?: string;
  os?: string;
  device_type?: 'desktop' | 'mobile' | 'tablet';
  risk_score: number;
  is_suspicious: boolean;
  country?: string;
  city?: string;
}

// Referral activity logs
export interface CythroDashReferralLog {
  _id?: ObjectId;
  
  // Core log information
  log_type: ReferralLogType;
  timestamp: Date;
  
  // User information
  referrer_id?: number; // User who owns the referral code
  referred_user_id?: number; // User who was referred (for signups)
  user_id?: number; // General user ID for other actions
  
  // Referral details
  referral_code?: string;
  click_id?: string; // Link to original click
  
  // Security and tracking
  security_info: LogSecurityInfo;
  
  // Activity details
  activity_data: {
    // For clicks
    click_reward?: number;
    
    // For signups
    signup_reward?: number;
    tier_bonus?: number;
    tier_name?: string;
    total_reward?: number;
    
    // For claims
    claimed_amount?: number;
    claim_type?: 'clicks' | 'signups' | 'all';
    
    // For tier upgrades
    old_tier?: string;
    new_tier?: string;
    new_bonus_percentage?: number;
  };
  
  // Status and validation
  status: 'success' | 'failed' | 'blocked' | 'pending';
  error_message?: string;
  validation_notes?: string;
  
  // Metadata
  session_id?: string;
  created_at: Date;
}

// Removed CythroDashAuthLog interface - focusing only on referral logging

// Analytics aggregation interface
export interface CythroDashReferralAnalytics {
  _id?: ObjectId;
  
  // Time period
  date: Date; // Date for daily aggregation
  period_type: 'daily' | 'weekly' | 'monthly';
  
  // User-specific analytics (if user_id is provided)
  user_id?: number;
  
  // Referral metrics
  metrics: {
    // Click metrics
    total_clicks: number;
    unique_clicks: number;
    suspicious_clicks: number;
    blocked_clicks: number;
    
    // Signup metrics
    total_signups: number;
    verified_signups: number;
    failed_signups: number;
    
    // Conversion metrics
    click_to_signup_rate: number;
    average_time_to_convert: number; // in minutes
    
    // Earnings metrics
    total_earnings: number;
    click_earnings: number;
    signup_earnings: number;
    tier_bonuses: number;
    claimed_earnings: number;
    
    // Tier distribution
    tier_distribution: {
      bronze: number;
      silver: number;
      gold: number;
      diamond: number;
    };
    
    // Top performers (for global analytics)
    top_referrers?: Array<{
      user_id: number;
      username: string;
      total_signups: number;
      total_earnings: number;
    }>;
    
    // Popular referral codes
    top_referral_codes?: Array<{
      referral_code: string;
      owner_id: number;
      clicks: number;
      signups: number;
      conversion_rate: number;
    }>;
  };
  
  // Metadata
  last_updated: Date;
  created_at: Date;
}

// Helper functions for logging and analytics
export const ReferralLogHelpers = {
  // Create referral activity log
  createReferralLog: (
    logType: ReferralLogType,
    securityInfo: LogSecurityInfo,
    activityData: any,
    status: 'success' | 'failed' | 'blocked' | 'pending' = 'success',
    additionalData?: Partial<CythroDashReferralLog>
  ): Omit<CythroDashReferralLog, '_id'> => {
    return {
      log_type: logType,
      timestamp: new Date(),
      security_info: securityInfo,
      activity_data: activityData,
      status,
      created_at: new Date(),
      ...additionalData
    };
  },

  // Removed authentication logging helper - focusing only on referral logging

  // Calculate risk score for logging
  calculateLogRiskScore: (securityInfo: Partial<LogSecurityInfo>): number => {
    let riskScore = 0;
    
    // Missing user agent
    if (!securityInfo.user_agent || securityInfo.user_agent.length < 20) {
      riskScore += 25;
    }
    
    // Missing device information
    if (!securityInfo.screen_resolution) riskScore += 10;
    if (!securityInfo.timezone) riskScore += 10;
    if (!securityInfo.language) riskScore += 10;
    
    // Suspicious patterns
    if (securityInfo.user_agent?.includes('bot') || securityInfo.user_agent?.includes('crawler')) {
      riskScore += 50;
    }
    
    return Math.min(riskScore, 100);
  },

  // Generate device fingerprint for logging
  generateLogDeviceFingerprint: (securityInfo: LogSecurityInfo): string => {
    const data = `${securityInfo.user_agent}_${securityInfo.screen_resolution}_${securityInfo.timezone}_${securityInfo.language}_${securityInfo.ip_address}`;
    return Buffer.from(data).toString('base64').substring(0, 32);
  },

  // Get current date for analytics aggregation
  getAnalyticsDate: (date?: Date): Date => {
    const d = date || new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },

  // Calculate conversion rate
  calculateConversionRate: (signups: number, clicks: number): number => {
    return clicks > 0 ? Math.round((signups / clicks) * 100 * 100) / 100 : 0;
  }
};

// Export collection names for consistency
export const REFERRAL_LOGS_COLLECTION = 'cythro_dash_referral_logs';
export const REFERRAL_ANALYTICS_COLLECTION = 'cythro_dash_referral_analytics';

// Database indexes for optimal performance
export const REFERRAL_LOGS_INDEXES = [
  { key: { log_type: 1 }, name: 'log_type_index' },
  { key: { timestamp: -1 }, name: 'timestamp_desc_index' },
  { key: { referrer_id: 1 }, name: 'referrer_id_index' },
  { key: { referred_user_id: 1 }, name: 'referred_user_id_index' },
  { key: { referral_code: 1 }, name: 'referral_code_index' },
  { key: { 'security_info.ip_address': 1 }, name: 'ip_address_index' },
  { key: { status: 1 }, name: 'status_index' },
  { key: { created_at: -1 }, name: 'created_at_desc_index' },
  { key: { referrer_id: 1, timestamp: -1 }, name: 'referrer_activity_index' },
  { key: { log_type: 1, timestamp: -1 }, name: 'log_type_time_index' }
];

// Removed AUTH_LOGS_INDEXES - focusing only on referral logging

export const REFERRAL_ANALYTICS_INDEXES = [
  { key: { date: -1 }, name: 'date_desc_index' },
  { key: { period_type: 1 }, name: 'period_type_index' },
  { key: { user_id: 1 }, name: 'user_id_index' },
  { key: { user_id: 1, date: -1 }, name: 'user_date_index' },
  { key: { period_type: 1, date: -1 }, name: 'period_date_index' },
  { key: { last_updated: -1 }, name: 'last_updated_desc_index' }
];
