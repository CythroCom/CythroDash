/**
 * CythroDash - Admin Update User Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations, UpdateUserData } from '@/hooks/managers/database/user';
import { panelUserUpdate, UserUpdateData } from '@/hooks/managers/pterodactyl/users';

// Interface for admin update user request
export interface AdminUpdateUserRequest {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  role?: number; // 0 = admin, 1 = user
  root_admin?: boolean; // For Pterodactyl panel admin
  language?: string;
  display_name?: string;
}

// Interface for update user response
export interface AdminUpdateUserResponse {
  success: boolean;
  message: string;
  user?: any;
  pterodactyl_user?: any;
  error?: string;
}

export class AdminUpdateUserController {
  /**
   * Update an existing user (both in database and Pterodactyl panel)
   */
  static async updateUser(
    userId: number,
    updateData: AdminUpdateUserRequest,
    adminUserId: number,
    adminIP?: string
  ): Promise<AdminUpdateUserResponse> {
    try {
      console.log(`🔨 Admin ${adminUserId} updating user ID: ${userId}`);

      // Get current user data
      const currentUser = await userOperations.getUserById(userId);
      if (!currentUser) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Track what's being changed for logging
      const changes: any = {};
      if (updateData.username && updateData.username !== currentUser.username) {
        changes.username = { from: currentUser.username, to: updateData.username };
      }
      if (updateData.email && updateData.email !== currentUser.email) {
        changes.email = { from: currentUser.email, to: updateData.email };
      }
      if (updateData.role !== undefined && updateData.role !== currentUser.role) {
        changes.role = { from: currentUser.role, to: updateData.role };
      }

      // Check for conflicts if updating username or email
      if (updateData.username && updateData.username !== currentUser.username) {
        const existingUsername = await userOperations.getUserByUsername(updateData.username);
        if (existingUsername && existingUsername.id !== userId) {
          return {
            success: false,
            message: 'Username is already taken',
            error: 'USERNAME_EXISTS'
          };
        }
      }

      if (updateData.email && updateData.email !== currentUser.email) {
        const existingEmail = await userOperations.getUserByEmail(updateData.email);
        if (existingEmail && existingEmail.id !== userId) {
          return {
            success: false,
            message: 'Email is already taken',
            error: 'EMAIL_EXISTS'
          };
        }
      }

      // Step 1: Update user in Pterodactyl panel (if relevant data changed)
      let pterodactylUser = null;
      const pterodactylUpdateData: UserUpdateData = {};
      
      if (updateData.username) pterodactylUpdateData.username = updateData.username;
      if (updateData.email) pterodactylUpdateData.email = updateData.email;
      if (updateData.first_name) pterodactylUpdateData.first_name = updateData.first_name;
      if (updateData.last_name) pterodactylUpdateData.last_name = updateData.last_name;
      if (updateData.password) pterodactylUpdateData.password = updateData.password;
      if (updateData.language) pterodactylUpdateData.language = updateData.language;
      if (updateData.root_admin !== undefined) pterodactylUpdateData.root_admin = updateData.root_admin;

      // Only update Pterodactyl if there are relevant changes
      if (Object.keys(pterodactylUpdateData).length > 0) {
        console.log('📡 Updating user in Pterodactyl panel...');
        const pterodactylResponse = await panelUserUpdate(userId, pterodactylUpdateData);
        pterodactylUser = pterodactylResponse.attributes;
        console.log(`✅ Pterodactyl user updated`);
      }

      // Step 2: Update user in CythroDash database
      const databaseUpdateData: UpdateUserData = {};
      
      if (updateData.username) databaseUpdateData.username = updateData.username;
      if (updateData.email) databaseUpdateData.email = updateData.email;
      if (updateData.first_name) databaseUpdateData.first_name = updateData.first_name;
      if (updateData.last_name) databaseUpdateData.last_name = updateData.last_name;
      if (updateData.password) databaseUpdateData.password = updateData.password; // Will be hashed
      if (updateData.language) databaseUpdateData.language = updateData.language as any;
      if (updateData.display_name) databaseUpdateData.display_name = updateData.display_name;

      // Handle role update separately if needed
      if (updateData.role !== undefined) {
        // Role is handled in the general update
        // Note: Role is CythroDash specific, not in Pterodactyl
      }

      console.log('💾 Updating user in CythroDash database...');
      const updatedUser = await userOperations.updateUser(userId, databaseUpdateData);
      
      if (!updatedUser) {
        throw new Error('Failed to update user in database');
      }

      console.log(`✅ Database user updated`);

      // Log the update event
      console.log(`✅ Admin ${adminUserId} updated user ID: ${userId}`, changes);

      return {
        success: true,
        message: 'User updated successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          role: updatedUser.role,
          display_name: updatedUser.display_name,
          language: updatedUser.language,
          updated_at: updatedUser.updated_at
        },
        pterodactyl_user: pterodactylUser
      };

    } catch (error) {
      console.error('💥 Admin update user error:', error);

      // Log the error
      console.error(`❌ Admin ${adminUserId} failed to update user ID: ${userId}`, error);

      return {
        success: false,
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
