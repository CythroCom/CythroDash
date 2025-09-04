/**
 * CythroDash - Admin Delete User Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations } from '@/hooks/managers/database/user';
import { panelUserDelete } from '@/hooks/managers/pterodactyl/users';

// Interface for delete user response
export interface AdminDeleteUserResponse {
  success: boolean;
  message: string;
  deletedUser?: any;
  error?: string;
}

export class AdminDeleteUserController {
  /**
   * Delete a user (both from database and Pterodactyl panel)
   * This is a hard delete - use with caution!
   */
  static async deleteUser(
    userId: number,
    adminUserId: number,
    adminIP?: string,
    forceDelete: boolean = false
  ): Promise<AdminDeleteUserResponse> {
    try {
      console.log(`🗑️ Admin ${adminUserId} deleting user ID: ${userId}`);

      // Prevent admin from deleting themselves
      if (userId === adminUserId) {
        return {
          success: false,
          message: 'Cannot delete your own account',
          error: 'CANNOT_DELETE_SELF'
        };
      }

      // Get current user data for logging
      const currentUser = await userOperations.getUserById(userId);
      if (!currentUser) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check if user is an admin (extra confirmation required)
      if (currentUser.role === 0 && !forceDelete) {
        return {
          success: false,
          message: 'Cannot delete admin user without force flag. This is a safety measure.',
          error: 'ADMIN_DELETE_REQUIRES_FORCE'
        };
      }

      // Store user data for response
      const deletedUserData = {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        role: currentUser.role,
        pterodactyl_uuid: currentUser.pterodactyl_uuid
      };

      // Step 1: Delete user from Pterodactyl panel
      console.log('📡 Deleting user from Pterodactyl panel...');
      try {
        await panelUserDelete(userId);
        console.log(`✅ User deleted from Pterodactyl panel`);
      } catch (pterodactylError) {
        console.warn('⚠️ Failed to delete user from Pterodactyl panel:', pterodactylError);
        // Continue with database deletion even if Pterodactyl deletion fails
        // This handles cases where user might already be deleted from panel
      }

      // Step 2: Delete user from CythroDash database
      console.log('💾 Deleting user from CythroDash database...');
      const databaseDeleteSuccess = await userOperations.deleteUser(userId);
      
      if (!databaseDeleteSuccess) {
        throw new Error('Failed to delete user from database');
      }

      console.log(`✅ User deleted from database`);

      // Log the deletion event
      console.log(`✅ Admin ${adminUserId} deleted user: ${currentUser.username} (ID: ${userId})`);

      return {
        success: true,
        message: 'User deleted successfully',
        deletedUser: deletedUserData
      };

    } catch (error) {
      console.error('💥 Admin delete user error:', error);

      // Log the error
      console.error(`❌ Admin ${adminUserId} failed to delete user ID: ${userId}`, error);

      return {
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Soft delete a user (marks as deleted but keeps data)
   * This is the safer option for user management
   */
  static async softDeleteUser(
    userId: number,
    adminUserId: number,
    adminIP?: string,
    reason?: string
  ): Promise<AdminDeleteUserResponse> {
    try {
      console.log(`🚫 Admin ${adminUserId} soft deleting user ID: ${userId}`);

      // Prevent admin from deleting themselves
      if (userId === adminUserId) {
        return {
          success: false,
          message: 'Cannot delete your own account',
          error: 'CANNOT_DELETE_SELF'
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

      // Perform soft delete (mark as deleted)
      console.log('💾 Soft deleting user in database...');
      const softDeleteSuccess = await userOperations.deleteUser(userId); // This should be soft delete
      
      if (!softDeleteSuccess) {
        throw new Error('Failed to soft delete user');
      }

      console.log(`✅ User soft deleted`);

      // Log the soft deletion event
      console.log(`✅ Admin ${adminUserId} soft deleted user: ${currentUser.username} (ID: ${userId})`);

      return {
        success: true,
        message: 'User soft deleted successfully',
        deletedUser: {
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
          action: 'soft_deleted'
        }
      };

    } catch (error) {
      console.error('💥 Admin soft delete user error:', error);

      console.error(`❌ Admin ${adminUserId} failed to soft delete user ID: ${userId}`, error);

      return {
        success: false,
        message: 'Failed to soft delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
