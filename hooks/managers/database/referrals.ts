/**
 * CythroDash - Referrals Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection } from 'mongodb';
import { connectToDatabase } from '../../../database/index';
import { userOperations } from './user';
import {
  CythroDashReferralClick,
  CythroDashReferralSignup,
  CythroDashReferralStats,
  ReferralStatus,
  ReferralTier,
  SecurityInfo,
  ReferralHelpers,
  REFERRAL_CLICKS_COLLECTION,
  REFERRAL_SIGNUPS_COLLECTION,
  REFERRAL_STATS_COLLECTION,
  REFERRAL_CLICKS_INDEXES,
  REFERRAL_SIGNUPS_INDEXES,
  REFERRAL_STATS_INDEXES
} from '../../../database/tables/cythro_dash_referrals';

// Interface for creating referral clicks
export interface CreateReferralClickData {
  referrer_id: number;
  referral_code: string;
  security_info: SecurityInfo;
  click_reward?: number;
}

// Interface for creating referral signups
export interface CreateReferralSignupData {
  referrer_id: number;
  referred_user_id: number;
  referral_code: string;
  click_id?: string;
  security_info: SecurityInfo;
  signup_reward?: number;
}

// Database collection management for referral clicks
class CythroDashReferralClicksCollection {
  private collection!: Collection<CythroDashReferralClick>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashReferralClick>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    const db = await connectToDatabase();
    this.collection = db.collection<CythroDashReferralClick>(REFERRAL_CLICKS_COLLECTION);
    
    // Create indexes for better performance
    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    try {
      for (const index of REFERRAL_CLICKS_INDEXES) {
        try {
          await this.collection.createIndex(index.key as any, { 
            name: index.name,
            unique: index.unique || false
          });
        } catch (error) {
          console.log(`Index ${index.name} already exists or failed to create`);
        }
      }
      console.log('Referral clicks indexes created successfully');
    } catch (error) {
      console.error('Error creating referral clicks indexes:', error);
    }
  }
}

// Database collection management for referral signups
class CythroDashReferralSignupsCollection {
  private collection!: Collection<CythroDashReferralSignup>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashReferralSignup>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    const db = await connectToDatabase();
    this.collection = db.collection<CythroDashReferralSignup>(REFERRAL_SIGNUPS_COLLECTION);
    
    // Create indexes for better performance
    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    try {
      for (const index of REFERRAL_SIGNUPS_INDEXES) {
        try {
          await this.collection.createIndex(index.key as any, { 
            name: index.name,
            unique: index.unique || false
          });
        } catch (error) {
          console.log(`Index ${index.name} already exists or failed to create`);
        }
      }
      console.log('Referral signups indexes created successfully');
    } catch (error) {
      console.error('Error creating referral signups indexes:', error);
    }
  }
}

// Database collection management for referral stats
class CythroDashReferralStatsCollection {
  private collection!: Collection<CythroDashReferralStats>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashReferralStats>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    const db = await connectToDatabase();
    this.collection = db.collection<CythroDashReferralStats>(REFERRAL_STATS_COLLECTION);
    
    // Create indexes for better performance
    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    try {
      for (const index of REFERRAL_STATS_INDEXES) {
        try {
          await this.collection.createIndex(index.key as any, { 
            name: index.name,
            unique: index.unique || false
          });
        } catch (error) {
          console.log(`Index ${index.name} already exists or failed to create`);
        }
      }
      console.log('Referral stats indexes created successfully');
    } catch (error) {
      console.error('Error creating referral stats indexes:', error);
    }
  }
}

// Singleton instances
const referralClicksCollection = new CythroDashReferralClicksCollection();
const referralSignupsCollection = new CythroDashReferralSignupsCollection();
const referralStatsCollection = new CythroDashReferralStatsCollection();

// Referral operations class
class ReferralOperations {
  // Create a new referral click
  async createReferralClick(clickData: CreateReferralClickData): Promise<CythroDashReferralClick> {
    const collection = await referralClicksCollection.getCollection();
    
    // Generate unique click ID
    const clickId = ReferralHelpers.generateClickId();
    
    // Check rate limiting - more strict limits
    const recentClicks = await this.getClickCountByIP(clickData.security_info.ip_address, 60 * 60 * 1000); // 1 hour
    const dailyClicks = await this.getClickCountByIP(clickData.security_info.ip_address, 24 * 60 * 60 * 1000); // 24 hours

    // Calculate risk score
    const riskScore = ReferralHelpers.calculateRiskScore(clickData.security_info, dailyClicks);

    // Generate device fingerprint
    const fingerprint = ReferralHelpers.generateDeviceFingerprint(
      clickData.security_info.device_info,
      clickData.security_info.ip_address
    );

    // Check for device fingerprint abuse
    const fingerprintClicks = await this.getClickCountByFingerprint(fingerprint, 24 * 60 * 60 * 1000);

    // Update security info with calculated values
    const securityInfo: SecurityInfo = {
      ...clickData.security_info,
      risk_score: riskScore,
      is_suspicious: riskScore > 50 || recentClicks > 5 || fingerprintClicks > 10,
      device_info: {
        ...clickData.security_info.device_info,
        fingerprint
      }
    };

    // Determine if click should be blocked - stricter limits
    const shouldBlock = riskScore > 80 ||
                       recentClicks > 10 ||  // Max 10 clicks per hour per IP
                       dailyClicks > 50 ||   // Max 50 clicks per day per IP
                       fingerprintClicks > 20; // Max 20 clicks per day per device

    // Add blocking reason
    let blockReason = '';
    if (shouldBlock) {
      if (recentClicks > 10) blockReason = 'Too many clicks per hour from this IP';
      else if (dailyClicks > 50) blockReason = 'Daily click limit exceeded for this IP';
      else if (fingerprintClicks > 20) blockReason = 'Daily click limit exceeded for this device';
      else if (riskScore > 80) blockReason = 'High risk score detected';

      securityInfo.blocked_reason = blockReason;
    }
    
    const newClick: CythroDashReferralClick = {
      referrer_id: clickData.referrer_id,
      referral_code: clickData.referral_code,
      click_id: clickId,
      clicked_at: new Date(),
      security_info: securityInfo,
      converted: false,
      click_reward: shouldBlock ? 0 : (clickData.click_reward || ReferralHelpers.getDefaultClickReward()),
      total_reward: shouldBlock ? 0 : (clickData.click_reward || ReferralHelpers.getDefaultClickReward()),
      status: shouldBlock ? ReferralStatus.BLOCKED : ReferralStatus.PENDING,
      claimed: false,
      created_at: new Date(),
      updated_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    if (shouldBlock) {
      newClick.security_info.blocked_reason = 'High risk score or excessive clicks from IP';
    }
    
    const result = await collection.insertOne(newClick);
    const createdClick = await collection.findOne({ _id: result.insertedId });
    
    if (!createdClick) {
      throw new Error('Failed to retrieve created referral click');
    }
    
    // Update user stats
    await this.updateUserStats(clickData.referrer_id);
    
    return createdClick;
  }

  // Create a new referral signup
  async createReferralSignup(signupData: CreateReferralSignupData): Promise<CythroDashReferralSignup> {
    const collection = await referralSignupsCollection.getCollection();
    
    // Check if user already has a referral signup (prevent duplicates)
    const existingSignup = await collection.findOne({ referred_user_id: signupData.referred_user_id });
    if (existingSignup) {
      throw new Error('User already has a referral signup record');
    }
    
    // Get referrer's current tier for bonus calculation
    const referrerStats = await this.getUserStats(signupData.referrer_id);
    const currentTier = referrerStats?.current_tier || ReferralTier.BRONZE;
    const tierBonusPercentage = ReferralHelpers.getTierBonus(currentTier);
    
    const baseReward = signupData.signup_reward || ReferralHelpers.getDefaultSignupReward();
    const tierBonus = Math.floor((baseReward * tierBonusPercentage) / 100);
    const totalReward = baseReward + tierBonus;
    
    // Check signup rate limiting
    const recentSignups = await this.getSignupCountByIP(signupData.security_info.ip_address, 60 * 60 * 1000); // 1 hour
    const dailySignups = await this.getSignupCountByIP(signupData.security_info.ip_address, 24 * 60 * 60 * 1000); // 24 hours

    // Calculate risk score for signup
    const riskScore = ReferralHelpers.calculateRiskScore(signupData.security_info, dailySignups);

    // Generate device fingerprint
    const fingerprint = ReferralHelpers.generateDeviceFingerprint(
      signupData.security_info.device_info,
      signupData.security_info.ip_address
    );

    // Check for device fingerprint abuse
    const fingerprintSignups = await this.getSignupCountByFingerprint(fingerprint, 24 * 60 * 60 * 1000);

    // Determine if signup should be blocked
    const shouldBlock = riskScore > 70 ||
                       recentSignups > 2 ||    // Max 2 signups per hour per IP
                       dailySignups > 5 ||     // Max 5 signups per day per IP
                       fingerprintSignups > 3; // Max 3 signups per day per device

    let blockReason = '';
    if (shouldBlock) {
      if (recentSignups > 2) blockReason = 'Too many signups per hour from this IP';
      else if (dailySignups > 5) blockReason = 'Daily signup limit exceeded for this IP';
      else if (fingerprintSignups > 3) blockReason = 'Daily signup limit exceeded for this device';
      else if (riskScore > 70) blockReason = 'High risk score detected';
    }

    const securityInfo: SecurityInfo = {
      ...signupData.security_info,
      risk_score: riskScore,
      is_suspicious: riskScore > 30 || shouldBlock,
      device_info: {
        ...signupData.security_info.device_info,
        fingerprint
      },
      blocked_reason: blockReason || undefined
    };
    
    const newSignup: CythroDashReferralSignup = {
      referrer_id: signupData.referrer_id,
      referred_user_id: signupData.referred_user_id,
      referral_code: signupData.referral_code,
      click_id: signupData.click_id,
      signed_up_at: new Date(),
      security_info: securityInfo,
      verified: !shouldBlock && riskScore < 50, // Auto-verify low risk signups
      signup_reward: shouldBlock ? 0 : baseReward,
      tier_bonus: shouldBlock ? 0 : tierBonus,
      total_reward: shouldBlock ? 0 : totalReward,
      status: shouldBlock ? ReferralStatus.BLOCKED : ReferralStatus.COMPLETED,
      claimed: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (shouldBlock) {
      newSignup.verification_notes = blockReason;
    } else if (riskScore > 50) {
      newSignup.verification_notes = 'Moderate risk score - requires manual verification';
    }
    
    const result = await collection.insertOne(newSignup);
    const createdSignup = await collection.findOne({ _id: result.insertedId });
    
    if (!createdSignup) {
      throw new Error('Failed to retrieve created referral signup');
    }
    
    // Update corresponding click if exists
    if (signupData.click_id) {
      await this.markClickAsConverted(signupData.click_id, signupData.referred_user_id, tierBonus);
    }
    
    // Update user stats
    await this.updateUserStats(signupData.referrer_id);
    
    return createdSignup;
  }

  // Get click count by IP address (for security)
  async getClickCountByIP(ipAddress: string, timeWindow: number = 24 * 60 * 60 * 1000): Promise<number> {
    const collection = await referralClicksCollection.getCollection();
    const since = new Date(Date.now() - timeWindow);

    return await collection.countDocuments({
      'security_info.ip_address': ipAddress,
      clicked_at: { $gte: since }
    });
  }

  // Get click count by device fingerprint (for security)
  async getClickCountByFingerprint(fingerprint: string, timeWindow: number = 24 * 60 * 60 * 1000): Promise<number> {
    const collection = await referralClicksCollection.getCollection();
    const since = new Date(Date.now() - timeWindow);

    return await collection.countDocuments({
      'security_info.device_info.fingerprint': fingerprint,
      clicked_at: { $gte: since }
    });
  }

  // Get signup count by IP address (for security)
  async getSignupCountByIP(ipAddress: string, timeWindow: number = 24 * 60 * 60 * 1000): Promise<number> {
    const collection = await referralSignupsCollection.getCollection();
    const since = new Date(Date.now() - timeWindow);

    return await collection.countDocuments({
      'security_info.ip_address': ipAddress,
      signed_up_at: { $gte: since }
    });
  }

  // Get signup count by device fingerprint (for security)
  async getSignupCountByFingerprint(fingerprint: string, timeWindow: number = 24 * 60 * 60 * 1000): Promise<number> {
    const collection = await referralSignupsCollection.getCollection();
    const since = new Date(Date.now() - timeWindow);

    return await collection.countDocuments({
      'security_info.device_info.fingerprint': fingerprint,
      signed_up_at: { $gte: since }
    });
  }

  // Mark a click as converted
  async markClickAsConverted(clickId: string, userId: number, tierBonus: number): Promise<boolean> {
    const collection = await referralClicksCollection.getCollection();
    
    const result = await collection.updateOne(
      { click_id: clickId },
      {
        $set: {
          converted: true,
          converted_at: new Date(),
          converted_user_id: userId,
          signup_reward: ReferralHelpers.getDefaultSignupReward(),
          tier_bonus: tierBonus,
          total_reward: ReferralHelpers.getDefaultClickReward() + ReferralHelpers.getDefaultSignupReward() + tierBonus,
          status: ReferralStatus.COMPLETED,
          updated_at: new Date()
        }
      }
    );
    
    return result.modifiedCount > 0;
  }

  // Get user referral statistics
  async getUserStats(userId: number): Promise<CythroDashReferralStats | null> {
    const collection = await referralStatsCollection.getCollection();
    return await collection.findOne({ user_id: userId });
  }

  // Claim user rewards
  async claimUserRewards(userId: number, claimType: 'clicks' | 'signups' | 'all' = 'all'): Promise<{
    success: boolean;
    total_claimed: number;
    clicks_claimed: number;
    signups_claimed: number;
    new_balance: number;
    error?: string;
  }> {
    try {
      const clicksCollection = await referralClicksCollection.getCollection();
      const signupsCollection = await referralSignupsCollection.getCollection();

      let totalClaimed = 0;
      let clicksClaimed = 0;
      let signupsClaimed = 0;

      // Claim click rewards
      if (claimType === 'clicks' || claimType === 'all') {
        const unclaimedClicks = await clicksCollection.find({
          referrer_id: userId,
          claimed: false,
          status: { $ne: ReferralStatus.BLOCKED }
        }).toArray();

        for (const click of unclaimedClicks) {
          clicksClaimed += click.total_reward;
        }

        if (unclaimedClicks.length > 0) {
          await clicksCollection.updateMany(
            {
              referrer_id: userId,
              claimed: false,
              status: { $ne: ReferralStatus.BLOCKED }
            },
            {
              $set: {
                claimed: true,
                claimed_at: new Date(),
                status: ReferralStatus.CLAIMED,
                updated_at: new Date()
              }
            }
          );
        }
      }

      // Claim signup rewards
      if (claimType === 'signups' || claimType === 'all') {
        const unclaimedSignups = await signupsCollection.find({
          referrer_id: userId,
          claimed: false,
          verified: true,
          status: { $ne: ReferralStatus.BLOCKED }
        }).toArray();

        for (const signup of unclaimedSignups) {
          signupsClaimed += signup.total_reward;
        }

        if (unclaimedSignups.length > 0) {
          await signupsCollection.updateMany(
            {
              referrer_id: userId,
              claimed: false,
              verified: true,
              status: { $ne: ReferralStatus.BLOCKED }
            },
            {
              $set: {
                claimed: true,
                claimed_at: new Date(),
                status: ReferralStatus.CLAIMED,
                updated_at: new Date()
              }
            }
          );
        }
      }

      totalClaimed = clicksClaimed + signupsClaimed;

      // Update user's coin balance if there are rewards to claim
      let newBalance = 0;
      if (totalClaimed > 0) {
        const coinsUpdated = await userOperations.updateCoins(userId, totalClaimed, 'Referral rewards claim');
        if (coinsUpdated) {
          // Get updated user to get new balance
          const updatedUser = await userOperations.getUserById(userId);
          if (updatedUser) {
            newBalance = updatedUser.coins;

            // Update user's referral earnings
            await userOperations.updateUser(userId, {
              referral_earnings: (updatedUser.referral_earnings || 0) + totalClaimed
            });
          } else {
            throw new Error('Failed to retrieve updated user');
          }
        } else {
          throw new Error('Failed to update user coins');
        }
      } else {
        const user = await userOperations.getUserById(userId);
        newBalance = user?.coins || 0;
      }

      // Update user stats
      await this.updateUserStats(userId);

      return {
        success: true,
        total_claimed: totalClaimed,
        clicks_claimed: clicksClaimed,
        signups_claimed: signupsClaimed,
        new_balance: newBalance
      };

    } catch (error) {
      console.error('Error claiming user rewards:', error);
      return {
        success: false,
        total_claimed: 0,
        clicks_claimed: 0,
        signups_claimed: 0,
        new_balance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get referred users for a user
  async getReferredUsers(userId: number, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    users: Array<{
      id: string;
      username: string;
      email: string;
      joinedAt: string;
      status: 'completed' | 'pending';
      reward: number;
    }>;
    total: number;
    error?: string;
  }> {
    try {
      const signupsCollection = await referralSignupsCollection.getCollection();

      // Get total count
      const total = await signupsCollection.countDocuments({
        referrer_id: userId,
        verified: true
      });

      // Get referred users with pagination
      const signups = await signupsCollection
        .find({
          referrer_id: userId,
          verified: true
        })
        .sort({ signed_up_at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      // Get user details for each referred user
      const userIds = signups.map(signup => signup.referred_user_id);
      const userDetails = await userOperations.getUsersByIds(userIds);

      // Create a map for quick lookup
      const userMap = new Map(userDetails.map((user: any) => [user.id, user]));

      // Transform the data to match the expected format
      const users = signups.map(signup => {
        const user: any = userMap.get(signup.referred_user_id);
        return {
          id: signup.referred_user_id?.toString() || signup._id?.toString() || '',
          username: user?.username || 'Unknown User',
          email: user?.email || 'unknown@example.com',
          joinedAt: signup.signed_up_at.toISOString(),
          status: (signup.claimed ? 'completed' : 'pending') as 'completed' | 'pending',
          reward: signup.total_reward
        };
      });

      return {
        success: true,
        users,
        total
      };

    } catch (error) {
      console.error('Error getting referred users:', error);
      return {
        success: false,
        users: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Update user referral statistics
  async updateUserStats(userId: number): Promise<void> {
    const clicksCollection = await referralClicksCollection.getCollection();
    const signupsCollection = await referralSignupsCollection.getCollection();
    const statsCollection = await referralStatsCollection.getCollection();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Calculate click statistics
    const [totalClicks, clicksToday, clicksThisWeek, clicksThisMonth, uniqueClicks] = await Promise.all([
      clicksCollection.countDocuments({ referrer_id: userId }),
      clicksCollection.countDocuments({ referrer_id: userId, clicked_at: { $gte: today } }),
      clicksCollection.countDocuments({ referrer_id: userId, clicked_at: { $gte: thisWeek } }),
      clicksCollection.countDocuments({ referrer_id: userId, clicked_at: { $gte: thisMonth } }),
      clicksCollection.distinct('security_info.ip_address', { referrer_id: userId }).then(ips => ips.length)
    ]);
    
    // Calculate signup statistics
    const [totalSignups, signupsToday, signupsThisWeek, signupsThisMonth] = await Promise.all([
      signupsCollection.countDocuments({ referrer_id: userId, verified: true }),
      signupsCollection.countDocuments({ referrer_id: userId, verified: true, signed_up_at: { $gte: today } }),
      signupsCollection.countDocuments({ referrer_id: userId, verified: true, signed_up_at: { $gte: thisWeek } }),
      signupsCollection.countDocuments({ referrer_id: userId, verified: true, signed_up_at: { $gte: thisMonth } })
    ]);
    
    // Calculate earnings
    const clickEarnings = await clicksCollection.aggregate([
      { $match: { referrer_id: userId, status: { $ne: ReferralStatus.BLOCKED } } },
      { $group: { _id: null, total: { $sum: '$total_reward' }, claimed: { $sum: { $cond: ['$claimed', '$total_reward', 0] } } } }
    ]).toArray();
    
    const signupEarnings = await signupsCollection.aggregate([
      { $match: { referrer_id: userId, verified: true } },
      { $group: { _id: null, total: { $sum: '$total_reward' }, claimed: { $sum: { $cond: ['$claimed', '$total_reward', 0] } } } }
    ]).toArray();
    
    const totalEarnings = (clickEarnings[0]?.total || 0) + (signupEarnings[0]?.total || 0);
    const claimedEarnings = (clickEarnings[0]?.claimed || 0) + (signupEarnings[0]?.claimed || 0);
    const pendingEarnings = totalEarnings - claimedEarnings;
    
    // Calculate tier information
    const currentTier = ReferralHelpers.calculateTier(totalSignups);
    const tierProgress = ReferralHelpers.calculateTierProgress(totalSignups, currentTier);
    const tierBonusPercentage = ReferralHelpers.getTierBonus(currentTier);
    
    // Calculate conversion rate
    const conversionRate = totalClicks > 0 ? (totalSignups / totalClicks) * 100 : 0;
    
    // Calculate security metrics
    const [suspiciousClicks, blockedClicks] = await Promise.all([
      clicksCollection.countDocuments({ referrer_id: userId, 'security_info.is_suspicious': true }),
      clicksCollection.countDocuments({ referrer_id: userId, status: ReferralStatus.BLOCKED })
    ]);
    
    const fraudScore = totalClicks > 0 ? Math.min((suspiciousClicks / totalClicks) * 100, 100) : 0;
    
    const stats: CythroDashReferralStats = {
      user_id: userId,
      total_clicks: totalClicks,
      unique_clicks: uniqueClicks,
      clicks_today: clicksToday,
      clicks_this_week: clicksThisWeek,
      clicks_this_month: clicksThisMonth,
      total_signups: totalSignups,
      signups_today: signupsToday,
      signups_this_week: signupsThisWeek,
      signups_this_month: signupsThisMonth,
      click_to_signup_rate: conversionRate,
      total_earnings: totalEarnings,
      pending_earnings: pendingEarnings,
      claimed_earnings: claimedEarnings,
      earnings_today: 0, // TODO: Calculate daily earnings
      earnings_this_week: 0, // TODO: Calculate weekly earnings
      earnings_this_month: 0, // TODO: Calculate monthly earnings
      current_tier: currentTier,
      tier_progress: tierProgress,
      tier_bonus_percentage: tierBonusPercentage,
      suspicious_clicks: suspiciousClicks,
      blocked_clicks: blockedClicks,
      fraud_score: fraudScore,
      last_updated: new Date(),
      created_at: new Date()
    };
    
    await statsCollection.replaceOne(
      { user_id: userId },
      stats,
      { upsert: true }
    );
  }
}

// Export singleton instance
export const referralOperations = new ReferralOperations();
