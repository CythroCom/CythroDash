/**
 * CythroDash - Social Media Verification Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Verification status enumeration
export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

// Social platform enumeration
export enum SocialPlatform {
  DISCORD = 'discord',
  GITHUB = 'github',
  TWITTER = 'twitter'
}

// Verification action enumeration
export enum VerificationAction {
  JOIN_SERVER = 'join_server',
  FOLLOW_USER = 'follow_user',
  STAR_REPO = 'star_repo',
  FORK_REPO = 'fork_repo'
}

// Social verification interface definition
export interface CythroDashSocialVerification {
  _id?: ObjectId;
  
  // Core identification
  user_id: number; // CythroDash user ID
  platform: SocialPlatform;
  action: VerificationAction;
  
  // Platform-specific data
  platform_user_id?: string; // Discord user ID, GitHub username, etc.
  platform_username?: string; // Display username on platform
  target_id?: string; // Server ID, repo name, user to follow, etc.
  
  // Verification details
  status: VerificationStatus;
  verified_at?: Date;
  expires_at?: Date; // When verification expires (for re-checking)
  
  // Reward information
  coins_reward: number;
  claimed: boolean;
  claimed_at?: Date;
  
  // Verification metadata
  verification_data?: {
    // Discord specific
    guild_id?: string;
    member_since?: Date;
    roles?: string[];
    
    // GitHub specific
    starred_at?: Date;
    forked_at?: Date;
    following_since?: Date;
    
    // Twitter specific (if implemented)
    followed_at?: Date;
  };
  
  // Security and tracking
  ip_address: string;
  user_agent: string;
  verification_attempts: number;
  last_check?: Date; // Last time we verified they still meet criteria
  
  // Error tracking
  error_message?: string;
  error_code?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

// Social verification task definition
export interface SocialVerificationTask {
  id: string;
  platform: SocialPlatform;
  action: VerificationAction;
  title: string;
  description: string;
  coins_reward: number;
  
  // Platform-specific requirements
  requirements: {
    // Discord
    guild_id?: string; // Discord server to join
    required_roles?: string[]; // Required roles (optional)
    
    // GitHub
    repository?: string; // Repository to star/fork
    username?: string; // User to follow
    
    // Twitter
    twitter_username?: string; // Twitter account to follow
  };
  
  // Task configuration
  enabled: boolean;
  max_completions?: number; // Limit how many users can complete
  expires_at?: Date; // Task expiration
  verification_interval: number; // How often to re-check (in hours)
}

// Helper functions
export const SocialVerificationHelpers = {
  // Get default verification values
  getDefaultVerificationValues: (userId: number, platform: SocialPlatform, action: VerificationAction): Partial<CythroDashSocialVerification> => ({
    user_id: userId,
    platform,
    action,
    status: VerificationStatus.PENDING,
    coins_reward: SocialVerificationHelpers.getDefaultReward(platform, action),
    claimed: false,
    verification_attempts: 0,
    created_at: new Date(),
    updated_at: new Date()
  }),

  // Get default reward for platform/action
  getDefaultReward: (platform: SocialPlatform, action: VerificationAction): number => {
    switch (platform) {
      case SocialPlatform.DISCORD:
        return action === VerificationAction.JOIN_SERVER ? 50 : 25;
      case SocialPlatform.GITHUB:
        return action === VerificationAction.STAR_REPO ? 30 : 
               action === VerificationAction.FORK_REPO ? 40 : 25;
      case SocialPlatform.TWITTER:
        return 20; // Lower reward since harder to verify
      default:
        return 10;
    }
  },

  // Check if verification is expired
  isExpired: (verification: CythroDashSocialVerification): boolean => {
    if (!verification.expires_at) return false;
    return new Date() > verification.expires_at;
  },

  // Check if verification needs re-checking
  needsRecheck: (verification: CythroDashSocialVerification, intervalHours: number = 24): boolean => {
    if (!verification.last_check) return true;
    const recheckTime = new Date(verification.last_check.getTime() + (intervalHours * 60 * 60 * 1000));
    return new Date() > recheckTime;
  },

  // Get verification expiry time
  getExpiryTime: (platform: SocialPlatform, action: VerificationAction): Date => {
    const now = new Date();
    switch (platform) {
      case SocialPlatform.DISCORD:
        // Discord verifications last longer since membership is persistent
        return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days
      case SocialPlatform.GITHUB:
        // GitHub actions are more permanent
        return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
      case SocialPlatform.TWITTER:
        // Twitter follows can be easily undone
        return new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 1 day
      default:
        return new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 1 day
    }
  }
};

// Default social verification tasks
export const DEFAULT_SOCIAL_TASKS: SocialVerificationTask[] = [
  {
    id: 'discord-join-server',
    platform: SocialPlatform.DISCORD,
    action: VerificationAction.JOIN_SERVER,
    title: 'Join Our Discord Server',
    description: 'Join our Discord community and get verified',
    coins_reward: 50,
    requirements: {
      guild_id: process.env.DISCORD_GUILD_ID || '', // Set in environment
    },
    enabled: true,
    verification_interval: 24 // Check every 24 hours
  },
  {
    id: 'github-star-repo',
    platform: SocialPlatform.GITHUB,
    action: VerificationAction.STAR_REPO,
    title: 'Star Our GitHub Repository',
    description: 'Star our main repository on GitHub',
    coins_reward: 30,
    requirements: {
      repository: process.env.GITHUB_REPOSITORY || 'CythroCom/CythroDash', // Set in environment
    },
    enabled: true,
    verification_interval: 168 // Check weekly
  }
];
