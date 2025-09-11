/**
 * CythroDash - Admin Get Users Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations } from '../../database/user';
import { 
  CythroDashUser, 
  UserRole, 
  UserTheme, 
  UserLanguage 
} from '../../../../database/tables/cythro_dash_users';
import { SecurityLogsController } from '../Security/Logs';
import { SecurityLogAction, SecurityLogSeverity } from '../../../../database/tables/cythro_dash_users_logs';

// Request interfaces
export interface GetUsersRequest {
  // Pagination
  page?: number;
  limit?: number;
  
  // Filtering
  search?: string; // Search by username, email, first_name, last_name
  role?: UserRole;
  verified?: boolean;
  banned?: boolean;
  deleted?: boolean;
  has_two_factor?: boolean;
  
  // Date filters
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
  
  // Sorting
  sort_by?: 'id' | 'username' | 'email' | 'created_at' | 'last_login' | 'coins' | 'total_servers_created';
  sort_order?: 'asc' | 'desc';
  
  // Include additional data
  include_stats?: boolean;
  include_oauth?: boolean;
  include_referrals?: boolean;
}

export interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  role: UserRole;
  verified: boolean;
  banned: boolean;
  deleted: boolean;
  coins: number;
  total_servers_created: number;
  two_factor_enabled: boolean;
  last_login?: Date;
  last_login_ip?: string;
  created_at: Date;
  
  // Optional extended data
  stats?: {
    total_coins_earned: number;
    total_coins_spent: number;
    referral_earnings: number;
    failed_login_attempts: number;
    last_activity?: Date;
  };
  
  oauth?: {
    discord?: boolean;
    github?: boolean;
    google?: boolean;
  };
  
  referrals?: {
    referral_code?: string;
    referred_by?: string;
    total_referrals: number;
  };
}

export interface GetUsersResponse {
  success: boolean;
  message: string;
  users?: AdminUserSummary[];
  pagination?: {
    current_page: number;
    total_pages: number;
    total_users: number;
    per_page: number;
    has_next: boolean;
    has_previous: boolean;
  };
  stats?: {
    total_users: number;
    verified_users: number;
    banned_users: number;
    admin_users: number;
    users_with_2fa: number;
    total_coins_in_circulation: number;
  };
}

export class AdminGetUsersController {
  /**
   * Get users with filtering, pagination, and sorting
   */
  static async getUsers(
    request: GetUsersRequest,
    admin_user_id: number
  ): Promise<GetUsersResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(admin_user_id);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        await SecurityLogsController.createLog({
          user_id: admin_user_id,
          action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
          severity: SecurityLogSeverity.HIGH,
          description: 'Attempted to access admin user list without proper permissions',
          ip_address: '', // Should be passed from the request
          user_agent: '', // Should be passed from the request
        });
        
        return {
          success: false,
          message: 'Insufficient permissions to access user data'
        };
      }

      // Set default values
      const page = Math.max(1, request.page || 1);
      const limit = Math.min(100, Math.max(1, request.limit || 25)); // Max 100 users per page
      const skip = (page - 1) * limit;
      // Default sorting: ID ascending (stable, predictable)
      const sortBy = request.sort_by || 'id';
      const sortOrder = request.sort_order ? (request.sort_order === 'asc' ? 1 : -1) : 1;

      // Build filter query
      const filter: any = {};
      
      // Basic filters
      if (request.role !== undefined) {
        filter.role = request.role;
      }
      
      if (request.verified !== undefined) {
        filter.verified = request.verified;
      }
      
      if (request.banned !== undefined) {
        filter.banned = request.banned;
      }
      
      if (request.deleted !== undefined) {
        filter.deleted = request.deleted;
      }
      
      if (request.has_two_factor !== undefined) {
        filter.two_factor_enabled = request.has_two_factor;
      }
      
      // Search filter
      if (request.search && request.search.trim()) {
        const searchRegex = { $regex: request.search.trim(), $options: 'i' };
        filter.$or = [
          { username: searchRegex },
          { email: searchRegex },
          { first_name: searchRegex },
          { last_name: searchRegex },
          { display_name: searchRegex }
        ];
      }
      
      // Date filters
      if (request.created_after || request.created_before) {
        filter.created_at = {};
        if (request.created_after) {
          filter.created_at.$gte = request.created_after;
        }
        if (request.created_before) {
          filter.created_at.$lte = request.created_before;
        }
      }
      
      if (request.last_login_after || request.last_login_before) {
        filter.last_login = {};
        if (request.last_login_after) {
          filter.last_login.$gte = request.last_login_after;
        }
        if (request.last_login_before) {
          filter.last_login.$lte = request.last_login_before;
        }
      }

      // Get users with pagination and sorting
      const users = await userOperations.getUsersWithPagination({
        filter,
        skip,
        limit,
        sort: { [sortBy]: sortOrder }
      });

      // Get total count for pagination
      const totalUsers = await userOperations.getUsersCount(filter);
      const totalPages = Math.ceil(totalUsers / limit);

      // Transform users to admin summary format
      const adminUserSummaries: AdminUserSummary[] = users.map(user => {
        const summary: AdminUserSummary = {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,
          role: user.role,
          verified: user.verified,
          banned: user.banned,
          deleted: user.deleted,
          coins: user.coins,
          total_servers_created: user.total_servers_created,
          two_factor_enabled: user.two_factor_enabled,
          last_login: user.last_login,
          last_login_ip: user.last_login_ip,
          created_at: user.created_at
        };

        // Add optional stats
        if (request.include_stats) {
          summary.stats = {
            total_coins_earned: user.total_coins_earned,
            total_coins_spent: user.total_coins_spent,
            referral_earnings: user.referral_earnings,
            failed_login_attempts: user.failed_login_attempts,
            last_activity: user.last_activity
          };
        }

        // Add OAuth status
        if (request.include_oauth) {
          summary.oauth = {
            discord: !!user.oauth?.discord,
            github: !!user.oauth?.github,
            google: !!user.oauth?.google
          };
        }

        // Add referral info
        if (request.include_referrals) {
          summary.referrals = {
            referral_code: user.referral_code,
            referred_by: user.referred_by,
            total_referrals: 0 // This would need to be calculated separately
          };
        }

        return summary;
      });

      // Calculate additional stats if requested
      let stats;
      if (request.include_stats) {
        stats = await AdminGetUsersController.calculateUserStats();
      }

      // Log admin action
      await SecurityLogsController.createLog({
        user_id: admin_user_id,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.LOW,
        description: `Retrieved ${adminUserSummaries.length} users (page ${page}/${totalPages})`,
        ip_address: '', // Should be passed from the request
        user_agent: '', // Should be passed from the request
      });

      return {
        success: true,
        message: `Retrieved ${adminUserSummaries.length} users successfully`,
        users: adminUserSummaries,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_users: totalUsers,
          per_page: limit,
          has_next: page < totalPages,
          has_previous: page > 1
        },
        stats
      };

    } catch (error) {
      console.error('Error in AdminGetUsersController.getUsers:', error);
      
      // Log error for admin
      await SecurityLogsController.createLog({
        user_id: admin_user_id,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.CRITICAL,
        description: `Error retrieving users: ${error}`,
        ip_address: '', // Should be passed from the request
        user_agent: '', // Should be passed from the request
      });

      return {
        success: false,
        message: 'Failed to retrieve users. Please try again.'
      };
    }
  }

  /**
   * Calculate overall user statistics for admin dashboard
   */
  private static async calculateUserStats(): Promise<{
    total_users: number;
    verified_users: number;
    banned_users: number;
    admin_users: number;
    users_with_2fa: number;
    total_coins_in_circulation: number;
  }> {
    try {
      const [
        totalUsers,
        verifiedUsers,
        bannedUsers,
        adminUsers,
        usersWith2FA,
        totalCoins
      ] = await Promise.all([
        userOperations.getUsersCount({}),
        userOperations.getUsersCount({ verified: true }),
        userOperations.getUsersCount({ banned: true }),
        userOperations.getUsersCount({ role: UserRole.ADMIN }),
        userOperations.getUsersCount({ two_factor_enabled: true }),
        userOperations.getTotalCoinsInCirculation()
      ]);

      return {
        total_users: totalUsers,
        verified_users: verifiedUsers,
        banned_users: bannedUsers,
        admin_users: adminUsers,
        users_with_2fa: usersWith2FA,
        total_coins_in_circulation: totalCoins
      };
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        total_users: 0,
        verified_users: 0,
        banned_users: 0,
        admin_users: 0,
        users_with_2fa: 0,
        total_coins_in_circulation: 0
      };
    }
  }

  /**
   * Get a single user by ID (admin view with full details)
   */
  static async getUserById(
    user_id: number,
    admin_user_id: number
  ): Promise<GetUsersResponse> {
    try {
      // Validate admin permissions
      const adminUser = await userOperations.getUserById(admin_user_id);
      if (!adminUser || adminUser.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Insufficient permissions to access user data'
        };
      }

      const user = await userOperations.getUserById(user_id);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const userSummary: AdminUserSummary = {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        role: user.role,
        verified: user.verified,
        banned: user.banned,
        deleted: user.deleted,
        coins: user.coins,
        total_servers_created: user.total_servers_created,
        two_factor_enabled: user.two_factor_enabled,
        last_login: user.last_login,
        last_login_ip: user.last_login_ip,
        created_at: user.created_at,
        stats: {
          total_coins_earned: user.total_coins_earned,
          total_coins_spent: user.total_coins_spent,
          referral_earnings: user.referral_earnings,
          failed_login_attempts: user.failed_login_attempts,
          last_activity: user.last_activity
        },
        oauth: {
          discord: !!user.oauth?.discord,
          github: !!user.oauth?.github,
          google: !!user.oauth?.google
        },
        referrals: {
          referral_code: user.referral_code,
          referred_by: user.referred_by,
          total_referrals: 0 // Would need separate calculation
        }
      };

      // Log admin action
      await SecurityLogsController.createLog({
        user_id: admin_user_id,
        action: SecurityLogAction.ADMIN_ACTION_PERFORMED,
        severity: SecurityLogSeverity.MEDIUM,
        description: `Viewed user details for user ID: ${user_id}`,
        ip_address: '', // Should be passed from the request
        user_agent: '', // Should be passed from the request
      });

      return {
        success: true,
        message: 'User retrieved successfully',
        users: [userSummary]
      };

    } catch (error) {
      console.error('Error in AdminGetUsersController.getUserById:', error);
      return {
        success: false,
        message: 'Failed to retrieve user details'
      };
    }
  }
}
