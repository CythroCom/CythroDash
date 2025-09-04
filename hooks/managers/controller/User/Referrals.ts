/**
 * CythroDash - Referrals Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { referralOperations, CreateReferralClickData, CreateReferralSignupData } from '../../database/referrals';
import { userOperations } from '../../database/user';
import { ReferralLogsController } from './ReferralLogs';
import {
  ReferralHelpers,
  SecurityInfo,
  DeviceInfo,
  ReferralStatus,
  CythroDashReferralStats
} from '../../../../database/tables/cythro_dash_referrals';

// Request interfaces
export interface ReferralClickRequest {
  referral_code: string;
  ip_address: string;
  user_agent: string;
  device_info?: Partial<DeviceInfo>;
  session_id?: string;
}

export interface ReferralSignupRequest {
  referrer_id: number;
  referred_user_id: number;
  referral_code: string;
  click_id?: string;
  ip_address: string;
  user_agent: string;
  device_info?: Partial<DeviceInfo>;
  session_id?: string;
}

export interface ClaimRewardsRequest {
  user_id: number;
  claim_type: 'clicks' | 'signups' | 'all';
  ip_address?: string;
  user_agent?: string;
}

// Response interfaces
export interface ReferralResponse {
  success: boolean;
  message?: string;
  data?: any;
  errors?: Array<{ field: string; message: string }>;
}

export interface ReferralStatsResponse extends ReferralResponse {
  data?: CythroDashReferralStats;
}

export interface ReferralClickResponse extends ReferralResponse {
  data?: {
    click_id: string;
    reward_earned: number;
    status: ReferralStatus;
    blocked: boolean;
    reason?: string;
  };
}

export interface ClaimRewardsResponse extends ReferralResponse {
  data?: {
    total_claimed: number;
    clicks_claimed: number;
    signups_claimed: number;
    new_balance: number;
  };
}

// Referrals controller class
export class ReferralsController {
  /**
   * Process a referral click
   */
  static async processReferralClick(request: ReferralClickRequest): Promise<ReferralClickResponse> {
    try {
      // Check if referral program is enabled
      if (!ReferralHelpers.isReferralProgramEnabled()) {
        return {
          success: false,
          message: 'Referral program is currently disabled'
        };
      }

      // Validate referral code and get referrer
      const referrer = await userOperations.getUserByReferralCode(request.referral_code);
      if (!referrer) {
        return {
          success: false,
          message: 'Invalid referral code',
          errors: [{ field: 'referral_code', message: 'Referral code not found' }]
        };
      }

      // Check if referrer account is active
      if (referrer.banned || referrer.deleted) {
        return {
          success: false,
          message: 'Referral code is no longer valid'
        };
      }

      // Prepare device information
      const deviceInfo: DeviceInfo = {
        user_agent: request.user_agent,
        screen_resolution: request.device_info?.screen_resolution,
        timezone: request.device_info?.timezone,
        language: request.device_info?.language,
        platform: request.device_info?.platform,
        browser: request.device_info?.browser,
        os: request.device_info?.os,
        device_type: request.device_info?.device_type
      };

      // Prepare security information
      const securityInfo: SecurityInfo = {
        ip_address: request.ip_address,
        device_info: deviceInfo,
        session_id: request.session_id,
        is_suspicious: false, // Will be calculated in database layer
        risk_score: 0 // Will be calculated in database layer
      };

      // Create click data
      const clickData: CreateReferralClickData = {
        referrer_id: referrer.id,
        referral_code: request.referral_code,
        security_info: securityInfo
      };

      // Create the referral click
      const click = await referralOperations.createReferralClick(clickData);

      return {
        success: true,
        message: click.status === ReferralStatus.BLOCKED 
          ? 'Click registered but blocked due to security concerns'
          : 'Referral click registered successfully',
        data: {
          click_id: click.click_id,
          reward_earned: click.total_reward,
          status: click.status,
          blocked: click.status === ReferralStatus.BLOCKED,
          reason: click.security_info.blocked_reason
        }
      };

    } catch (error) {
      console.error('Referral click processing error:', error);
      return {
        success: false,
        message: 'Failed to process referral click',
        errors: [{ field: 'general', message: 'An unexpected error occurred' }]
      };
    }
  }

  /**
   * Process a referral signup
   */
  static async processReferralSignup(request: ReferralSignupRequest): Promise<ReferralResponse> {
    try {
      // Check if referral program is enabled
      if (!ReferralHelpers.isReferralProgramEnabled()) {
        return {
          success: false,
          message: 'Referral program is currently disabled'
        };
      }

      // Validate referrer exists
      const referrer = await userOperations.getUserById(request.referrer_id);
      if (!referrer) {
        return {
          success: false,
          message: 'Invalid referrer',
          errors: [{ field: 'referrer_id', message: 'Referrer not found' }]
        };
      }

      // Validate referred user exists
      const referredUser = await userOperations.getUserById(request.referred_user_id);
      if (!referredUser) {
        return {
          success: false,
          message: 'Invalid referred user',
          errors: [{ field: 'referred_user_id', message: 'Referred user not found' }]
        };
      }

      // Check if user is trying to refer themselves
      if (request.referrer_id === request.referred_user_id) {
        return {
          success: false,
          message: 'Users cannot refer themselves',
          errors: [{ field: 'referred_user_id', message: 'Self-referral not allowed' }]
        };
      }

      // Check if referred user already has a referrer
      if (referredUser.referred_by && referredUser.referred_by !== request.referral_code) {
        return {
          success: false,
          message: 'User already has a referrer',
          errors: [{ field: 'referred_user_id', message: 'User was already referred by someone else' }]
        };
      }

      // Prepare device information
      const deviceInfo: DeviceInfo = {
        user_agent: request.user_agent,
        screen_resolution: request.device_info?.screen_resolution,
        timezone: request.device_info?.timezone,
        language: request.device_info?.language,
        platform: request.device_info?.platform,
        browser: request.device_info?.browser,
        os: request.device_info?.os,
        device_type: request.device_info?.device_type
      };

      // Prepare security information
      const securityInfo: SecurityInfo = {
        ip_address: request.ip_address,
        device_info: deviceInfo,
        session_id: request.session_id,
        is_suspicious: false, // Will be calculated in database layer
        risk_score: 0 // Will be calculated in database layer
      };

      // Create signup data
      const signupData: CreateReferralSignupData = {
        referrer_id: request.referrer_id,
        referred_user_id: request.referred_user_id,
        referral_code: request.referral_code,
        click_id: request.click_id,
        security_info: securityInfo
      };

      // Create the referral signup
      const signup = await referralOperations.createReferralSignup(signupData);

      // Update referred user's referral information
      await userOperations.updateUser(request.referred_user_id, {
        referred_by: request.referral_code
      });

      return {
        success: true,
        message: signup.status === ReferralStatus.BLOCKED 
          ? 'Signup registered but requires verification'
          : 'Referral signup processed successfully',
        data: {
          signup_id: signup._id,
          reward_earned: signup.total_reward,
          status: signup.status,
          verified: signup.verified,
          tier_bonus: signup.tier_bonus
        }
      };

    } catch (error) {
      console.error('Referral signup processing error:', error);
      
      // Handle duplicate signup error
      if (error instanceof Error && error.message.includes('already has a referral signup')) {
        return {
          success: false,
          message: 'User already has a referral signup record',
          errors: [{ field: 'referred_user_id', message: 'Duplicate referral signup' }]
        };
      }

      return {
        success: false,
        message: 'Failed to process referral signup',
        errors: [{ field: 'general', message: 'An unexpected error occurred' }]
      };
    }
  }

  /**
   * Get referred users list
   */
  static async getReferredUsers(userId: number, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    message?: string;
    data?: {
      users: Array<{
        id: string;
        username: string;
        email: string;
        joinedAt: string;
        status: 'completed' | 'pending';
        reward: number;
      }>;
      total: number;
      has_more: boolean;
    };
    errors?: Array<{ field: string; message: string }>;
  }> {
    try {
      // Validate user ID
      if (!userId || userId <= 0) {
        return {
          success: false,
          message: 'Invalid user ID',
          errors: [{ field: 'user_id', message: 'User ID must be a positive number' }]
        };
      }

      // Get referred users from database
      const result = await referralOperations.getReferredUsers(userId, limit, offset);

      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to retrieve referred users',
          errors: [{ field: 'general', message: result.error || 'Unknown error' }]
        };
      }

      return {
        success: true,
        message: 'Referred users retrieved successfully',
        data: {
          users: result.users,
          total: result.total,
          has_more: result.users.length === limit && result.total > offset + limit
        }
      };

    } catch (error) {
      console.error('Get referred users error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while retrieving referred users',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }

  /**
   * Get user referral statistics
   */
  static async getUserReferralStats(userId: number): Promise<ReferralStatsResponse> {
    try {
      // Check if referral program is enabled
      if (!ReferralHelpers.isReferralProgramEnabled()) {
        return {
          success: false,
          message: 'Referral program is currently disabled'
        };
      }

      // Get user stats
      const stats = await referralOperations.getUserStats(userId);
      
      if (!stats) {
        // Create initial stats if they don't exist
        await referralOperations.updateUserStats(userId);
        const newStats = await referralOperations.getUserStats(userId);
        
        return {
          success: true,
          message: 'User referral statistics retrieved',
          data: newStats || undefined
        };
      }

      return {
        success: true,
        message: 'User referral statistics retrieved',
        data: stats
      };

    } catch (error) {
      console.error('Get referral stats error:', error);
      return {
        success: false,
        message: 'Failed to retrieve referral statistics',
        errors: [{ field: 'general', message: 'An unexpected error occurred' }]
      };
    }
  }

  /**
   * Claim referral rewards
   */
  static async claimReferralRewards(request: ClaimRewardsRequest): Promise<ClaimRewardsResponse> {
    try {
      // Check if referral program is enabled
      if (!ReferralHelpers.isReferralProgramEnabled()) {
        return {
          success: false,
          message: 'Referral program is currently disabled'
        };
      }

      // Get user to verify they exist
      const user = await userOperations.getUserById(request.user_id);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: [{ field: 'user_id', message: 'Invalid user ID' }]
        };
      }

      // Claim the rewards using the database operations
      const claimResult = await referralOperations.claimUserRewards(
        request.user_id,
        request.claim_type
      );

      if (!claimResult.success) {
        return {
          success: false,
          message: claimResult.error || 'Failed to claim rewards',
          errors: [{ field: 'general', message: claimResult.error || 'Unknown error' }]
        };
      }

      // Log the claim activity
      try {
        await ReferralLogsController.logReferralActivity({
          log_type: 'claim' as any,
          user_id: request.user_id,
          activity_data: {
            claimed_amount: claimResult.total_claimed,
            claim_type: request.claim_type,
            clicks_claimed: claimResult.clicks_claimed,
            signups_claimed: claimResult.signups_claimed
          },
          ip_address: request.ip_address || '127.0.0.1',
          user_agent: request.user_agent || 'Unknown'
        });
      } catch (logError) {
        console.warn('Failed to log claim activity:', logError);
        // Don't fail the claim if logging fails
      }

      return {
        success: true,
        message: claimResult.total_claimed > 0
          ? `Successfully claimed ${claimResult.total_claimed} coins!`
          : 'No rewards available to claim',
        data: {
          total_claimed: claimResult.total_claimed,
          clicks_claimed: claimResult.clicks_claimed,
          signups_claimed: claimResult.signups_claimed,
          new_balance: claimResult.new_balance
        }
      };

    } catch (error) {
      console.error('Claim rewards error:', error);
      return {
        success: false,
        message: 'Failed to claim rewards',
        errors: [{ field: 'general', message: 'An unexpected error occurred' }]
      };
    }
  }

  /**
   * Validate referral code format
   */
  static validateReferralCode(code: string): boolean {
    // Referral codes should be alphanumeric and between 8-20 characters
    const codeRegex = /^[A-Z0-9]{8,20}$/;
    return codeRegex.test(code);
  }

  /**
   * Get referral URL for a user
   */
  static generateReferralUrl(referralCode: string, baseUrl?: string): string {
    const base = baseUrl || process.env.NEXT_PUBLIC_URL;
    return `${base}/auth/register?ref=${referralCode}`;
  }
}
