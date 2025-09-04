/**
 * CythroDash - Daily Login Bonus Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { ObjectId } from 'mongodb';

// Daily login status enum
export enum DailyLoginStatus {
  PENDING = 'pending',
  CLAIMED = 'claimed',
  EXPIRED = 'expired'
}

// Daily login bonus record interface
export interface CythroDashDailyLogin {
  _id?: ObjectId;
  
  // User identification
  user_id: number; // References cythro_dash_users.id
  
  // Login tracking
  login_date: string; // YYYY-MM-DD format for easy querying
  login_timestamp: Date; // Exact login time
  
  // Reward information
  coins_awarded: number; // Amount of coins awarded
  status: DailyLoginStatus; // Current status of the login bonus
  
  // Claim tracking
  claimed_at?: Date; // When the bonus was claimed
  expires_at: Date; // When the bonus expires (24 hours from login)
  
  // Metadata
  ip_address?: string; // IP address for security tracking
  user_agent?: string; // User agent for analytics
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Daily login statistics interface
export interface DailyLoginStats {
  user_id: number;
  total_logins: number;
  current_streak: number;
  longest_streak: number;
  total_coins_earned: number;
  last_login_date?: string;
  first_login_date?: string;
}

// Daily login analytics interface
export interface DailyLoginAnalytics {
  date: string;
  total_logins: number;
  unique_users: number;
  total_coins_awarded: number;
  claim_rate: number; // Percentage of logins that claimed bonus
}

// Database indexes for optimal performance
export const DAILY_LOGINS_INDEXES = [
  {
    name: 'user_id_1',
    key: { user_id: 1 },
    unique: false
  },
  {
    name: 'login_date_1',
    key: { login_date: 1 },
    unique: false
  },
  {
    name: 'user_id_1_login_date_1',
    key: { user_id: 1, login_date: 1 },
    unique: true // One record per user per day
  },
  {
    name: 'status_1',
    key: { status: 1 },
    unique: false
  },
  {
    name: 'expires_at_1',
    key: { expires_at: 1 },
    unique: false
  },
  {
    name: 'created_at_1',
    key: { created_at: 1 },
    unique: false
  },
  {
    name: 'claimed_at_1',
    key: { claimed_at: 1 },
    unique: false,
    sparse: true // Only index documents that have claimed_at
  }
];

// Validation schemas
export const DailyLoginValidation = {
  user_id: {
    required: true,
    type: 'number',
    min: 1
  },
  login_date: {
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/ // YYYY-MM-DD format
  },
  coins_awarded: {
    required: true,
    type: 'number',
    min: 0,
    max: 10000
  },
  status: {
    required: true,
    type: 'string',
    enum: Object.values(DailyLoginStatus)
  },
  ip_address: {
    required: false,
    type: 'string',
    maxLength: 45 // IPv6 max length
  },
  user_agent: {
    required: false,
    type: 'string',
    maxLength: 500
  }
};

// Helper functions for date handling
export class DailyLoginUtils {
  /**
   * Get current date in YYYY-MM-DD format (UTC)
   */
  static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get date string from timestamp
   */
  static getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get start of day timestamp
   */
  static getStartOfDay(dateString: string): Date {
    return new Date(`${dateString}T00:00:00.000Z`);
  }

  /**
   * Get end of day timestamp
   */
  static getEndOfDay(dateString: string): Date {
    return new Date(`${dateString}T23:59:59.999Z`);
  }

  /**
   * Get expiration time (24 hours from now)
   */
  static getExpirationTime(): Date {
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Check if two dates are consecutive
   */
  static areConsecutiveDates(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }

  /**
   * Calculate streak from login dates
   */
  static calculateStreak(loginDates: string[]): number {
    if (loginDates.length === 0) return 0;

    // Sort dates in descending order
    const sortedDates = loginDates.sort((a, b) => b.localeCompare(a));
    
    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      if (this.areConsecutiveDates(sortedDates[i], sortedDates[i - 1])) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
