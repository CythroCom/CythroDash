/**
 * CythroDash - Referrals Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Referral action types
export enum ReferralAction {
  CLICK = 'click',
  SIGNUP = 'signup',
  CLAIM = 'claim'
}

// Referral status
export enum ReferralStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CLAIMED = 'claimed',
  EXPIRED = 'expired',
  BLOCKED = 'blocked'
}

// Referral tier system
export enum ReferralTier {
  BRONZE = 'bronze',
  SILVER = 'silver', 
  GOLD = 'gold',
  DIAMOND = 'diamond'
}

// Device information interface
export interface DeviceInfo {
  user_agent: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  browser?: string;
  os?: string;
  device_type?: 'desktop' | 'mobile' | 'tablet';
  fingerprint?: string; // Unique device fingerprint
}

// Security tracking interface
export interface SecurityInfo {
  ip_address: string;
  device_info: DeviceInfo;
  session_id?: string;
  is_suspicious: boolean;
  risk_score: number; // 0-100, higher = more risky
  blocked_reason?: string;
  verification_required?: boolean;
}

// Referral click tracking
export interface CythroDashReferralClick {
  _id?: ObjectId;
  
  // Core referral information
  referrer_id: number; // User ID who owns the referral code
  referral_code: string; // The referral code used
  
  // Click tracking
  click_id: string; // Unique click identifier
  clicked_at: Date;
  
  // Security and device tracking
  security_info: SecurityInfo;
  
  // Conversion tracking
  converted: boolean; // Whether this click led to a signup
  converted_at?: Date;
  converted_user_id?: number; // User ID if conversion happened
  
  // Rewards
  click_reward: number; // Coins awarded for click (usually 15)
  signup_reward?: number; // Coins awarded for signup (usually 30)
  tier_bonus?: number; // Additional bonus based on tier
  total_reward: number; // Total coins earned from this referral
  
  // Status
  status: ReferralStatus;
  claimed: boolean;
  claimed_at?: Date;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  expires_at: Date; // Click expires after certain time
}

// Referral signup tracking (separate from clicks for better analytics)
export interface CythroDashReferralSignup {
  _id?: ObjectId;
  
  // Core information
  referrer_id: number; // User who referred
  referred_user_id: number; // User who signed up
  referral_code: string;
  click_id?: string; // Link to original click if available
  
  // Signup details
  signed_up_at: Date;
  
  // Security verification
  security_info: SecurityInfo;
  verified: boolean; // Whether signup passed security checks
  verification_notes?: string;
  
  // Rewards
  signup_reward: number; // Base signup reward (usually 30)
  tier_bonus: number; // Bonus based on referrer's tier
  total_reward: number; // Total coins earned
  
  // Status
  status: ReferralStatus;
  claimed: boolean;
  claimed_at?: Date;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

// Referral statistics for users
export interface CythroDashReferralStats {
  _id?: ObjectId;
  
  // User information
  user_id: number;
  
  // Click statistics
  total_clicks: number;
  unique_clicks: number; // Unique IP/device combinations
  clicks_today: number;
  clicks_this_week: number;
  clicks_this_month: number;
  
  // Signup statistics
  total_signups: number;
  signups_today: number;
  signups_this_week: number;
  signups_this_month: number;
  
  // Conversion rates
  click_to_signup_rate: number; // Percentage
  
  // Earnings
  total_earnings: number;
  pending_earnings: number;
  claimed_earnings: number;
  earnings_today: number;
  earnings_this_week: number;
  earnings_this_month: number;
  
  // Tier information
  current_tier: ReferralTier;
  tier_progress: number; // Progress to next tier (0-100)
  tier_bonus_percentage: number; // Current tier bonus
  
  // Security metrics
  suspicious_clicks: number;
  blocked_clicks: number;
  fraud_score: number; // 0-100, higher = more suspicious
  
  // Metadata
  last_updated: Date;
  created_at: Date;
}

// Helper functions for referral management
export const ReferralHelpers = {
  // Generate unique click ID
  generateClickId: (): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `click_${timestamp}_${randomStr}`;
  },

  // Calculate tier based on signup count
  calculateTier: (signupCount: number): ReferralTier => {
    if (signupCount >= 50) return ReferralTier.DIAMOND;
    if (signupCount >= 15) return ReferralTier.GOLD;
    if (signupCount >= 5) return ReferralTier.SILVER;
    return ReferralTier.BRONZE;
  },

  // Get tier bonus percentage
  getTierBonus: (tier: ReferralTier): number => {
    switch (tier) {
      case ReferralTier.BRONZE: return 10;
      case ReferralTier.SILVER: return 25;
      case ReferralTier.GOLD: return 50;
      case ReferralTier.DIAMOND: return 100;
      default: return 10;
    }
  },

  // Calculate tier progress
  calculateTierProgress: (signupCount: number, currentTier: ReferralTier): number => {
    switch (currentTier) {
      case ReferralTier.BRONZE:
        return Math.min((signupCount / 5) * 100, 100);
      case ReferralTier.SILVER:
        return Math.min(((signupCount - 5) / 10) * 100, 100);
      case ReferralTier.GOLD:
        return Math.min(((signupCount - 15) / 35) * 100, 100);
      case ReferralTier.DIAMOND:
        return 100;
      default:
        return 0;
    }
  },

  // Check if referral program is enabled (DB-first with env fallback)
  isReferralProgramEnabled: (): boolean => {
    try {
      // avoid async here; use env in DB failure case; APIs should validate feature server-side as needed
      // @ts-ignore
      const envVal = process?.env?.NEXT_PUBLIC_REFERRAL_PROGRAM
      return String(envVal || 'false') === 'true'
    } catch { return false }
  },

  // Get default click reward
  getDefaultClickReward: (): number => {
    return 15; // 15 coins per click
  },

  // Get default signup reward
  getDefaultSignupReward: (): number => {
    return 30; // 30 coins per signup
  },

  // Calculate risk score based on various factors
  calculateRiskScore: (securityInfo: SecurityInfo, previousClicks: number = 0): number => {
    let riskScore = 0;
    
    // High frequency from same IP
    if (previousClicks > 10) riskScore += 30;
    else if (previousClicks > 5) riskScore += 15;
    
    // Suspicious user agent patterns
    if (!securityInfo.device_info.user_agent || securityInfo.device_info.user_agent.length < 20) {
      riskScore += 25;
    }
    
    // Missing device information
    if (!securityInfo.device_info.screen_resolution) riskScore += 10;
    if (!securityInfo.device_info.timezone) riskScore += 10;
    if (!securityInfo.device_info.language) riskScore += 10;
    
    return Math.min(riskScore, 100);
  },

  // Generate device fingerprint
  generateDeviceFingerprint: (deviceInfo: DeviceInfo, ipAddress: string): string => {
    const data = `${deviceInfo.user_agent}_${deviceInfo.screen_resolution}_${deviceInfo.timezone}_${deviceInfo.language}_${ipAddress}`;
    return Buffer.from(data).toString('base64').substring(0, 32);
  }
};

// Export collection names for consistency
export const REFERRAL_CLICKS_COLLECTION = 'cythro_dash_referral_clicks';
export const REFERRAL_SIGNUPS_COLLECTION = 'cythro_dash_referral_signups';
export const REFERRAL_STATS_COLLECTION = 'cythro_dash_referral_stats';

// Database indexes for optimal performance
export const REFERRAL_CLICKS_INDEXES = [
  { key: { referrer_id: 1 }, name: 'referrer_id_index' },
  { key: { referral_code: 1 }, name: 'referral_code_index' },
  { key: { click_id: 1 }, name: 'click_id_index', unique: true },
  { key: { 'security_info.ip_address': 1 }, name: 'ip_address_index' },
  { key: { 'security_info.device_info.fingerprint': 1 }, name: 'device_fingerprint_index' },
  { key: { clicked_at: -1 }, name: 'clicked_at_desc_index' },
  { key: { status: 1 }, name: 'status_index' },
  { key: { converted: 1 }, name: 'converted_index' },
  { key: { claimed: 1 }, name: 'claimed_index' },
  { key: { expires_at: 1 }, name: 'expires_at_index' },
  { key: { referrer_id: 1, clicked_at: -1 }, name: 'referrer_activity_index' },
  { key: { referrer_id: 1, status: 1 }, name: 'referrer_status_index' }
];

export const REFERRAL_SIGNUPS_INDEXES = [
  { key: { referrer_id: 1 }, name: 'referrer_id_index' },
  { key: { referred_user_id: 1 }, name: 'referred_user_id_index', unique: true },
  { key: { referral_code: 1 }, name: 'referral_code_index' },
  { key: { click_id: 1 }, name: 'click_id_index' },
  { key: { 'security_info.ip_address': 1 }, name: 'ip_address_index' },
  { key: { signed_up_at: -1 }, name: 'signed_up_at_desc_index' },
  { key: { status: 1 }, name: 'status_index' },
  { key: { verified: 1 }, name: 'verified_index' },
  { key: { claimed: 1 }, name: 'claimed_index' },
  { key: { referrer_id: 1, signed_up_at: -1 }, name: 'referrer_signups_index' }
];

export const REFERRAL_STATS_INDEXES = [
  { key: { user_id: 1 }, name: 'user_id_index', unique: true },
  { key: { current_tier: 1 }, name: 'current_tier_index' },
  { key: { total_signups: -1 }, name: 'total_signups_desc_index' },
  { key: { total_earnings: -1 }, name: 'total_earnings_desc_index' },
  { key: { last_updated: -1 }, name: 'last_updated_desc_index' }
];
