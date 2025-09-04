/**
 * CythroDash - Redeem Codes Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Code status enumeration
export enum CodeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  DEPLETED = 'depleted' // When max_uses is reached
}

// Code type enumeration
export enum CodeType {
  SINGLE_USE = 'single_use',
  MULTI_USE = 'multi_use',
  UNLIMITED = 'unlimited'
}

// Redeem code interface
export interface CythroDashCode {
  _id?: ObjectId;
  
  // Core code information
  id: number; // Unique numeric ID
  code: string; // The actual redemption code (unique)
  coins_value: number; // Amount of coins this code gives
  
  // Usage limits
  max_uses: number; // Maximum number of times this code can be used (0 = unlimited)
  current_uses: number; // Current number of times this code has been used
  
  // Expiry settings
  expiry_date?: Date; // When this code expires (null = never expires)
  
  // Admin information
  created_by_admin_id: number; // Admin user ID who created this code
  
  // Status
  is_active: boolean; // Whether this code is currently active
  status: CodeStatus; // Current status of the code
  
  // Description and metadata
  description?: string; // Optional description for admin reference
  internal_notes?: string; // Internal notes for admins
  
  // Usage tracking
  first_used_at?: Date; // When this code was first redeemed
  last_used_at?: Date; // When this code was last redeemed
  
  // User restrictions (optional)
  allowed_user_ids?: number[]; // If set, only these users can redeem this code
  restricted_to_new_users?: boolean; // If true, only new users can redeem
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

// Code redemption tracking interface
export interface CythroDashCodeRedemption {
  _id?: ObjectId;
  
  // Core redemption information
  id: number; // Unique redemption ID
  code_id: number; // Reference to the code that was redeemed
  code: string; // The actual code that was redeemed
  user_id: number; // User who redeemed the code
  username: string; // Username at time of redemption
  
  // Redemption details
  coins_awarded: number; // Amount of coins awarded
  redeemed_at: Date; // When the code was redeemed
  
  // Security and tracking
  ip_address: string; // IP address of the user who redeemed
  user_agent: string; // User agent of the redemption request
  
  // Validation
  user_balance_before: number; // User's coin balance before redemption
  user_balance_after: number; // User's coin balance after redemption
  
  // Status
  status: 'completed' | 'failed' | 'reversed'; // Redemption status
  
  // Error tracking (if redemption failed)
  error_message?: string;
  error_code?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

// Collection names
export const codesCollectionName = 'cythro_dash_codes';
export const codeRedemptionsCollectionName = 'cythro_dash_code_redemptions';

// Default code values
export const defaultCodeValues: Partial<CythroDashCode> = {
  current_uses: 0,
  is_active: true,
  status: CodeStatus.ACTIVE,
  created_at: new Date(),
  updated_at: new Date(),
  restricted_to_new_users: false
};

// Default redemption values
export const defaultRedemptionValues: Partial<CythroDashCodeRedemption> = {
  status: 'completed',
  created_at: new Date(),
  updated_at: new Date()
};

// Code validation rules
export const codeValidation = {
  minCodeLength: 4,
  maxCodeLength: 32,
  minCoinsValue: 1,
  maxCoinsValue: 10000,
  maxDescriptionLength: 500,
  maxInternalNotesLength: 1000,
  codePattern: /^[A-Z0-9-_]+$/i, // Alphanumeric, hyphens, and underscores only
  
  // Rate limiting
  maxRedemptionsPerUserPerDay: 10,
  maxRedemptionsPerIPPerHour: 5,
  
  // Security
  minTimeBetweenRedemptions: 60000, // 1 minute in milliseconds
};

// Helper functions
export const codeHelpers = {
  // Generate unique code ID
  generateCodeId: (): number => {
    return Date.now() + Math.floor(Math.random() * 1000);
  },

  // Generate unique redemption ID
  generateRedemptionId: (): number => {
    return Date.now() + Math.floor(Math.random() * 1000);
  },

  // Generate random code
  generateRandomCode: (length: number = 8): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Validate code format
  isValidCodeFormat: (code: string): boolean => {
    return code.length >= codeValidation.minCodeLength &&
           code.length <= codeValidation.maxCodeLength &&
           codeValidation.codePattern.test(code);
  },

  // Validate coins value
  isValidCoinsValue: (coins: number): boolean => {
    return coins >= codeValidation.minCoinsValue &&
           coins <= codeValidation.maxCoinsValue &&
           Number.isInteger(coins);
  },

  // Check if code is expired
  isCodeExpired: (code: CythroDashCode): boolean => {
    if (!code.expiry_date) return false;
    return new Date() > code.expiry_date;
  },

  // Check if code is depleted
  isCodeDepleted: (code: CythroDashCode): boolean => {
    if (code.max_uses === 0) return false; // Unlimited uses
    return code.current_uses >= code.max_uses;
  },

  // Check if code can be redeemed
  canRedeemCode: (code: CythroDashCode): boolean => {
    return code.is_active &&
           code.status === CodeStatus.ACTIVE &&
           !codeHelpers.isCodeExpired(code) &&
           !codeHelpers.isCodeDepleted(code);
  },

  // Get code type based on max_uses
  getCodeType: (code: CythroDashCode): CodeType => {
    if (code.max_uses === 0) return CodeType.UNLIMITED;
    if (code.max_uses === 1) return CodeType.SINGLE_USE;
    return CodeType.MULTI_USE;
  },

  // Calculate remaining uses
  getRemainingUses: (code: CythroDashCode): number | null => {
    if (code.max_uses === 0) return null; // Unlimited
    return Math.max(0, code.max_uses - code.current_uses);
  },

  // Update code status based on current state
  updateCodeStatus: (code: CythroDashCode): CodeStatus => {
    if (!code.is_active) return CodeStatus.INACTIVE;
    if (codeHelpers.isCodeExpired(code)) return CodeStatus.EXPIRED;
    if (codeHelpers.isCodeDepleted(code)) return CodeStatus.DEPLETED;
    return CodeStatus.ACTIVE;
  }
};

// Database indexes for optimal performance
export const CODES_INDEXES = [
  { key: { id: 1 }, name: 'id_index', unique: true },
  { key: { code: 1 }, name: 'code_index', unique: true },
  { key: { created_by_admin_id: 1 }, name: 'created_by_admin_index' },
  { key: { is_active: 1 }, name: 'is_active_index' },
  { key: { status: 1 }, name: 'status_index' },
  { key: { expiry_date: 1 }, name: 'expiry_date_index' },
  { key: { created_at: -1 }, name: 'created_at_desc_index' },
  { key: { coins_value: -1 }, name: 'coins_value_desc_index' },
  { key: { current_uses: -1 }, name: 'current_uses_desc_index' },
  { key: { is_active: 1, status: 1 }, name: 'active_status_index' },
  { key: { created_by_admin_id: 1, created_at: -1 }, name: 'admin_codes_index' }
];

export const CODE_REDEMPTIONS_INDEXES = [
  { key: { id: 1 }, name: 'id_index', unique: true },
  { key: { code_id: 1 }, name: 'code_id_index' },
  { key: { code: 1 }, name: 'code_index' },
  { key: { user_id: 1 }, name: 'user_id_index' },
  { key: { ip_address: 1 }, name: 'ip_address_index' },
  { key: { redeemed_at: -1 }, name: 'redeemed_at_desc_index' },
  { key: { status: 1 }, name: 'status_index' },
  { key: { user_id: 1, redeemed_at: -1 }, name: 'user_redemptions_index' },
  { key: { code_id: 1, redeemed_at: -1 }, name: 'code_redemptions_index' },
  { key: { ip_address: 1, redeemed_at: -1 }, name: 'ip_redemptions_index' }
];

// Types are already exported above, no need to re-export
