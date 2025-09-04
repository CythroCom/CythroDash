/**
 * CythroDash - User Management Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// User role enumeration
export enum UserRole {
  ADMIN = 0,
  USER = 1
}

// Theme enumeration
export enum UserTheme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

// Language enumeration
export enum UserLanguage {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  RU = 'ru',
  ZH = 'zh',
  JA = 'ja',
  KO = 'ko'
}

// OAuth provider enumeration
export enum OAuthProvider {
  DISCORD = 'discord',
  GITHUB = 'github',
  GOOGLE = 'google'
}

// User interface definition
export interface CythroDashUser {
  _id?: ObjectId;
  
  // Core identification (synced with Pterodactyl)
  id: number; // Same as Pterodactyl user ID
  pterodactyl_uuid: string; // Pterodactyl user UUID
  username: string;
  email: string;
  
  // Personal information
  first_name: string;
  last_name: string;
  display_name?: string; // Optional display name override
  
  // Authentication & Security
  password?: string; // Hashed password (optional if using OAuth only)
  verified: boolean; // Email verification status
  verified_at?: Date; // When email was verified
  email_verification_token?: string; // Token for email verification
  password_reset_token?: string; // Token for password reset
  password_reset_expires?: Date; // Password reset token expiration
  
  // Two-Factor Authentication
  two_factor_enabled: boolean;
  two_factor_secret?: string; // TOTP secret
  two_factor_backup_codes?: string[]; // Backup codes for 2FA
  
  // Account status
  role: UserRole; // 0 = admin, 1 = user
  banned: boolean;
  banned_at?: Date;
  banned_reason?: string;
  banned_by?: number; // Admin user ID who banned this user
  deleted: boolean; // Soft delete flag
  deleted_at?: Date;
  
  // Security
  security_pin?: string; // Hashed security PIN for sensitive operations
  last_login?: Date;
  last_login_ip?: string;
  failed_login_attempts: number;
  locked_until?: Date; // Account lockout expiration
  
  // OAuth integrations
  oauth?: {
    discord?: {
      id: string;
      username: string;
      discriminator?: string;
      avatar?: string;
      connected_at: Date;
    };
    github?: {
      id: number;
      login: string;
      name?: string;
      avatar_url?: string;
      connected_at: Date;
    };
    google?: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      connected_at: Date;
    };
  };
  
  // Wallet & Economy
  coins: number; // User's coin balance
  total_coins_earned: number; // Lifetime coins earned
  total_coins_spent: number; // Lifetime coins spent
  
  // Preferences
  theme: UserTheme;
  language: UserLanguage;
  timezone?: string; // User's timezone (e.g., 'America/New_York')
  
  // Dashboard preferences
  dashboard_layout?: string; // JSON string of dashboard layout preferences
  notifications_enabled: boolean;
  email_notifications: boolean;
  
  // Referral system
  referral_code?: string; // User's unique referral code
  referred_by?: string; // Referral code of who referred this user
  referral_earnings: number; // Coins earned from referrals
  
  // Activity tracking
  last_activity?: Date;
  total_servers_created: number;

  // Server limits
  max_servers: number; // Maximum number of servers user can create
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  
  // Additional fields for future features
  avatar_url?: string; // Custom avatar URL
  bio?: string; // User biography
  website?: string; // User's website
  social_links?: {
    twitter?: string;
    discord?: string;
    github?: string;
  };
  
  // API access
  api_keys?: Array<{
    id: string;
    name: string;
    key_hash: string; // Hashed API key
    permissions: string[]; // Array of permissions
    last_used?: Date;
    created_at: Date;
    expires_at?: Date;
  }>;
  
  // Session management
  active_sessions?: Array<{
    session_id: string;
    ip_address: string;
    user_agent: string;
    created_at: Date;
    last_activity: Date;
  }>;
}



// Helper functions for user management
export const UserHelpers = {
  // Generate a unique referral code
  generateReferralCode: (username: string): string => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${username.substring(0, 4).toUpperCase()}${timestamp}${randomStr}`.toUpperCase();
  },

  // Check if verification is required based on environment
  isVerificationRequired: (): boolean => {
    return process.env.ACCOUNT_VERIFICATION === 'true';
  },

  // Get default user values
  getDefaultUserValues: (): Partial<CythroDashUser> => ({
    coins: 0,
    total_coins_earned: 0,
    total_coins_spent: 0,
    referral_earnings: 0,
    total_servers_created: 0,
    failed_login_attempts: 0,
    notifications_enabled: true,
    email_notifications: true,
    two_factor_enabled: false,
    banned: false,
    deleted: false,
    role: UserRole.USER,
    theme: UserTheme.DARK,
    language: UserLanguage.EN,
    oauth: {},
    verified: !UserHelpers.isVerificationRequired(), // Auto-verify if verification is disabled
    verified_at: !UserHelpers.isVerificationRequired() ? new Date() : undefined,
    created_at: new Date(),
    updated_at: new Date()
  })
};
