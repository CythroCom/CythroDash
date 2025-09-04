/**
 * CythroDash - Admin Disable User Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations } from '@/hooks/managers/database/user';

// Interface for disable user response
export interface AdminDisableUserResponse {
  success: boolean;
  message: string;
  user?: any;
  error?: string;
}

export class AdminDisableUserController {
  /**
   * Ban/disable a user account
   */
  static async banUser(
    userId: number,
    reason: string,
    adminUserId: number,
    adminIP?: string
  ): Promise<AdminDisableUserResponse> {
    try {
      console.log(`🚫 Admin ${adminUserId} banning user ID: ${userId}`);

      // Prevent admin from banning themselves
      if (userId === adminUserId) {
        return {
          success: false,
          message: 'Cannot ban your own account',
          error: 'CANNOT_BAN_SELF'
        };
      }

      // Get current user data
      const currentUser = await userOperations.getUserById(userId);
      if (!currentUser) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check if user is already banned
      if (currentUser.banned) {
        return {
          success: false,
          message: 'User is already banned',
          error: 'USER_ALREADY_BANNED'
        };
      }

      // Ban the user
      console.log('💾 Banning user in database...');
      const banSuccess = await userOperations.banUser(userId, reason, adminUserId);
      
      if (!banSuccess) {
        throw new Error('Failed to ban user in database');
      }

      console.log(`✅ User banned successfully`);

      // Get updated user data
      const updatedUser = await userOperations.getUserById(userId);

      // Log the ban event
      console.log(`✅ Admin ${adminUserId} banned user: ${currentUser.username} (ID: ${userId}) - Reason: ${reason}`);

      return {
        success: true,
        message: 'User banned successfully',
        user: {
          id: updatedUser?.id,
          username: updatedUser?.username,
          email: updatedUser?.email,
          is_banned: updatedUser?.banned,
          banned_at: updatedUser?.banned_at,
          ban_reason: updatedUser?.banned_reason
        }
      };

    } catch (error) {
      console.error('💥 Admin ban user error:', error);

      // Log the error
      console.error(`❌ Admin ${adminUserId} failed to ban user ID: ${userId}`, error);

      return {
        success: false,
        message: 'Failed to ban user',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unban/enable a user account
   */
  static async unbanUser(
    userId: number,
    adminUserId: number,
    adminIP?: string
  ): Promise<AdminDisableUserResponse> {
    try {
      console.log(`✅ Admin ${adminUserId} unbanning user ID: ${userId}`);

      // Get current user data
      const currentUser = await userOperations.getUserById(userId);
      if (!currentUser) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check if user is actually banned
      if (!currentUser.banned) {
        return {
          success: false,
          message: 'User is not banned',
          error: 'USER_NOT_BANNED'
        };
      }

      // Unban the user
      console.log('💾 Unbanning user in database...');
      const unbanSuccess = await userOperations.unbanUser(userId);
      
      if (!unbanSuccess) {
        throw new Error('Failed to unban user in database');
      }

      console.log(`✅ User unbanned successfully`);

      // Get updated user data
      const updatedUser = await userOperations.getUserById(userId);

      // Log the unban event
      console.log(`✅ Admin ${adminUserId} unbanned user: ${currentUser.username} (ID: ${userId})`);

      return {
        success: true,
        message: 'User unbanned successfully',
        user: {
          id: updatedUser?.id,
          username: updatedUser?.username,
          email: updatedUser?.email,
          is_banned: updatedUser?.banned,
          banned_at: updatedUser?.banned_at,
          ban_reason: updatedUser?.banned_reason
        }
      };

    } catch (error) {
      console.error('💥 Admin unban user error:', error);

      // Log the error
      console.error(`❌ Admin ${adminUserId} failed to unban user ID: ${userId}`, error);

      return {
        success: false,
        message: 'Failed to unban user',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user ban status and details
   */
  static async getUserBanStatus(
    userId: number,
    adminUserId: number
  ): Promise<AdminDisableUserResponse> {
    try {
      console.log(`📋 Admin ${adminUserId} checking ban status for user ID: ${userId}`);

      // Get current user data
      const currentUser = await userOperations.getUserById(userId);
      if (!currentUser) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'User ban status retrieved',
        user: {
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
          is_banned: currentUser.banned,
          banned_at: currentUser.banned_at,
          ban_reason: currentUser.banned_reason,
          banned_by: currentUser.banned_by
        }
      };

    } catch (error) {
      console.error('💥 Get user ban status error:', error);

      return {
        success: false,
        message: 'Failed to get user ban status',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
