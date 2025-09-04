/**
 * CythroDash - User Details Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations, UpdateUserData } from '../../database/user';
import { UserValidation } from '../../database/user-validation';
import {
  panelUserGetDetails,
  panelUserUpdate,
  PterodactylError,
  PterodactylUser,
  PterodactylServer
} from '../../pterodactyl/users';
import {
  UserRole,
  UserTheme,
  UserLanguage
} from '../../../../database/tables/cythro_dash_users';
import bcrypt from 'bcrypt';
import { SecurityLogsController } from '../Security/Logs';

// User details interfaces
export interface UserDetailsRequest {
  user_id: number;
  include_servers?: boolean;
  include_activity?: boolean;
  include_stats?: boolean;
}

export interface UserDetailsResponse {
  success: boolean;
  message: string;
  user?: {
    // Basic info
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    display_name?: string;

    // Status
    role: UserRole;
    verified: boolean;
    banned: boolean;
    deleted: boolean;

    // Preferences
    theme: UserTheme;
    language: UserLanguage;
    timezone?: string;
    notifications_enabled: boolean;
    email_notifications: boolean;

    // Profile
    avatar_url?: string;
    bio?: string;
    website?: string;
    social_links?: {
      twitter?: string;
      discord?: string;
      github?: string;
    };

    // Economy
    coins: number;
    total_coins_earned: number;
    total_coins_spent: number;
    referral_earnings: number;
    referral_code?: string;

    // Security
    two_factor_enabled: boolean;
    last_login?: Date;
    last_login_ip?: string;
    last_activity?: Date;

    // Timestamps
    created_at: Date;
    updated_at: Date;
    verified_at?: Date;
  };
  pterodactyl_user?: {
    id: number;
    uuid: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    language: string;
    root_admin: boolean;
    two_factor: boolean;
    created_at: string;
    updated_at: string;
  };
  servers?: Array<{
    id: number;
    uuid: string;
    name: string;
    description: string;
    status: string | null;
    suspended: boolean;
    limits: {
      memory: number;
      disk: number;
      cpu: number;
    };
    created_at: string;
  }>;
  activity?: {
    total_servers_created: number;
    failed_login_attempts: number;
    account_locked: boolean;
    lock_expires?: Date;
  };
  stats?: {
    days_since_registration: number;
    servers_count: number;
    referrals_count: number;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface UpdateUserProfileRequest {
  user_id: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  bio?: string;
  website?: string;
  timezone?: string;
  theme?: UserTheme;
  language?: UserLanguage;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  social_links?: {
    twitter?: string;
    discord?: string;
    github?: string;
  };
  ip_address?: string;
  user_agent?: string;
}

export interface ChangePasswordRequest {
  user_id: number;
  current_password: string;
  new_password: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UpdateUserProfileResponse {
  success: boolean;
  message: string;
  user?: UserDetailsResponse['user'];
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// User details controller class
export class UserDetailsController {

  /**
   * Get comprehensive user details
   */
  static async getUserDetails(request: UserDetailsRequest): Promise<UserDetailsResponse> {
    try {
      // Get user from database
      const user = await userOperations.getUserById(request.user_id);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: [{ field: 'user_id', message: 'User does not exist' }]
        };
      }

      // Check if user is deleted
      if (user.deleted) {
        return {
          success: false,
          message: 'User account has been deleted',
          errors: [{ field: 'user_id', message: 'User account deleted' }]
        };
      }

      // Get Pterodactyl user details
      let pterodactylUser: PterodactylUser | undefined;
      let servers: PterodactylServer[] = [];

      try {
        const pterodactylResponse = await panelUserGetDetails(user.id, {
          include: request.include_servers ? 'servers' : undefined
        });

        if (pterodactylResponse.attributes) {
          pterodactylUser = pterodactylResponse.attributes;

          // Extract servers if included
          if (request.include_servers && pterodactylResponse.relationships?.servers?.data) {
            servers = pterodactylResponse.relationships.servers.data
              .map((server: any) => server.attributes)
              .filter(Boolean);
          }
        }
      } catch (error) {
        console.error('Error fetching Pterodactyl user details:', error);
        // Don't fail the entire request if Pterodactyl is unavailable
        if (error instanceof PterodactylError && error.status === 404) {
          // User doesn't exist in Pterodactyl anymore
          console.warn(`User ${user.id} not found in Pterodactyl panel`);
        }
      }

      // Prepare activity data if requested
      let activity: UserDetailsResponse['activity'] | undefined;
      if (request.include_activity) {
        const isLocked = await userOperations.isUserLocked(user.id);
        activity = {
          total_servers_created: user.total_servers_created,
          failed_login_attempts: user.failed_login_attempts,
          account_locked: isLocked,
          lock_expires: user.locked_until
        };
      }

      // Prepare stats if requested
      let stats: UserDetailsResponse['stats'] | undefined;
      if (request.include_stats) {
        const daysSinceRegistration = Math.floor(
          (Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Count referrals (users who used this user's referral code)
        const referralsCount = 0; // TODO: Implement referral counting

        stats = {
          days_since_registration: daysSinceRegistration,
          servers_count: servers.length,
          referrals_count: referralsCount
        };
      }

      // Build response
      const response: UserDetailsResponse = {
        success: true,
        message: 'User details retrieved successfully',
        user: {
          // Basic info
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,

          // Status
          role: user.role,
          verified: user.verified,
          banned: user.banned,
          deleted: user.deleted,

          // Preferences
          theme: user.theme,
          language: user.language,
          timezone: user.timezone,
          notifications_enabled: user.notifications_enabled,
          email_notifications: user.email_notifications,

          // Profile
          avatar_url: user.avatar_url,
          bio: user.bio,
          website: user.website,
          social_links: user.social_links,

          // Economy
          coins: user.coins,
          total_coins_earned: user.total_coins_earned,
          total_coins_spent: user.total_coins_spent,
          referral_earnings: user.referral_earnings,
          referral_code: user.referral_code,

          // Security
          two_factor_enabled: user.two_factor_enabled,
          last_login: user.last_login,
          last_login_ip: user.last_login_ip,
          last_activity: user.last_activity,

          // Timestamps
          created_at: user.created_at,
          updated_at: user.updated_at,
          verified_at: user.verified_at
        }
      };

      // Add Pterodactyl user data if available
      if (pterodactylUser) {
        response.pterodactyl_user = {
          id: pterodactylUser.id,
          uuid: pterodactylUser.uuid,
          username: pterodactylUser.username,
          email: pterodactylUser.email,
          first_name: pterodactylUser.first_name,
          last_name: pterodactylUser.last_name,
          language: pterodactylUser.language,
          root_admin: pterodactylUser.root_admin,
          two_factor: pterodactylUser["2fa"],
          created_at: pterodactylUser.created_at,
          updated_at: pterodactylUser.updated_at
        };
      }

      // Add servers if requested
      if (request.include_servers) {
        response.servers = servers.map(server => ({
          id: server.id,
          uuid: server.uuid,
          name: server.name,
          description: server.description,
          status: server.status,
          suspended: server.suspended,
          limits: {
            memory: server.limits.memory,
            disk: server.limits.disk,
            cpu: server.limits.cpu
          },
          created_at: server.created_at
        }));
      }

      // Add activity if requested
      if (activity) {
        response.activity = activity;
      }

      // Add stats if requested
      if (stats) {
        response.stats = stats;
      }

      return response;

    } catch (error) {
      console.error('Error getting user details:', error);

      return {
        success: false,
        message: 'An unexpected error occurred while retrieving user details',
        errors: [{ field: 'general', message: 'Failed to get user details' }]
      };
    }
  }

  /**
   * Update user profile information
   */
  static async updateUserProfile(request: UpdateUserProfileRequest): Promise<UpdateUserProfileResponse> {
    try {
      // Get current user
      const user = await userOperations.getUserById(request.user_id);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          errors: [{ field: 'user_id', message: 'User does not exist' }]
        };
      }

      // Check if user is deleted or banned
      if (user.deleted) {
        return {
          success: false,
          message: 'Cannot update deleted user profile',
          errors: [{ field: 'user_id', message: 'User account deleted' }]
        };
      }

      if (user.banned) {
        return {
          success: false,
          message: 'Cannot update banned user profile',
          errors: [{ field: 'user_id', message: 'User account banned' }]
        };
      }

      // Validate update data
      const validation = this.validateProfileUpdateData(request);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Prepare update data
      const updateData: UpdateUserData = {};

      if (request.username !== undefined) updateData.username = request.username;
      if (request.email !== undefined) updateData.email = request.email;
      if (request.first_name !== undefined) updateData.first_name = request.first_name;
      if (request.last_name !== undefined) updateData.last_name = request.last_name;
      if (request.display_name !== undefined) updateData.display_name = request.display_name;
      if (request.bio !== undefined) updateData.bio = request.bio;
      if (request.website !== undefined) updateData.website = request.website;
      if (request.timezone !== undefined) updateData.timezone = request.timezone;
      if (request.theme !== undefined) updateData.theme = request.theme;
      if (request.language !== undefined) updateData.language = request.language;
      if (request.notifications_enabled !== undefined) updateData.notifications_enabled = request.notifications_enabled;
      if (request.email_notifications !== undefined) updateData.email_notifications = request.email_notifications;
      if (request.social_links !== undefined) updateData.social_links = request.social_links;

      // Update user in database
      const updatedUser = await userOperations.updateUser(request.user_id, updateData);
      if (!updatedUser) {
        return {
          success: false,
          message: 'Failed to update user profile',
          errors: [{ field: 'general', message: 'Update operation failed' }]
        };
      }

      // Update Pterodactyl user if relevant fields changed
      if (request.username !== undefined || request.email !== undefined || request.first_name !== undefined || request.last_name !== undefined) {
        try {
          const pterodactylUpdateData: any = {
            // Always include required fields for Pterodactyl
            username: updatedUser.username,  // Required by Pterodactyl
            email: updatedUser.email,        // Required by Pterodactyl
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name
          };

          console.log('Updating Pterodactyl user with data:', pterodactylUpdateData);
          await panelUserUpdate(request.user_id, pterodactylUpdateData);
          console.log('Pterodactyl user update successful');
        } catch (error) {
          console.error('Failed to update Pterodactyl user:', error);
          // Don't fail the entire operation if panel update fails
        }
      }

      // Get updated user details
      const userDetailsResponse = await this.getUserDetails({
        user_id: request.user_id,
        include_servers: false,
        include_activity: false,
        include_stats: false
      });

      // Log profile update event
      const changedFields = Object.keys(updateData).filter(key => updateData[key as keyof UpdateUserData] !== undefined);
      await SecurityLogsController.logProfileUpdate(
        request.user_id,
        changedFields,
        request.ip_address,
        request.user_agent
      );

      return {
        success: true,
        message: 'Profile updated successfully',
        user: userDetailsResponse.user
      };

    } catch (error) {
      console.error('Error updating user profile:', error);

      return {
        success: false,
        message: 'An unexpected error occurred while updating profile',
        errors: [{ field: 'general', message: 'Profile update failed' }]
      };
    }
  }

  /**
   * Validate profile update data
   */
  private static validateProfileUpdateData(request: UpdateUserProfileRequest): { isValid: boolean; errors: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate username if provided
    if (request.username !== undefined) {
      const usernameError = UserValidation.validateUsername(request.username);
      if (usernameError) errors.push(usernameError);
    }

    // Validate email if provided
    if (request.email !== undefined) {
      const emailError = UserValidation.validateEmail(request.email);
      if (emailError) errors.push(emailError);
    }

    // Validate names if provided
    if (request.first_name !== undefined) {
      const firstNameError = UserValidation.validateName(request.first_name, 'first_name');
      if (firstNameError) errors.push(firstNameError);
    }

    if (request.last_name !== undefined) {
      const lastNameError = UserValidation.validateName(request.last_name, 'last_name');
      if (lastNameError) errors.push(lastNameError);
    }

    // Validate display name if provided
    if (request.display_name !== undefined) {
      const displayNameError = UserValidation.validateDisplayName(request.display_name);
      if (displayNameError) errors.push(displayNameError);
    }

    // Validate bio if provided
    if (request.bio !== undefined) {
      const bioError = UserValidation.validateBio(request.bio);
      if (bioError) errors.push(bioError);
    }

    // Validate website if provided
    if (request.website !== undefined) {
      const websiteError = UserValidation.validateUrl(request.website, 'website');
      if (websiteError) errors.push(websiteError);
    }

    // Validate timezone if provided
    if (request.timezone !== undefined) {
      const timezoneError = UserValidation.validateTimezone(request.timezone);
      if (timezoneError) errors.push(timezoneError);
    }

    // Validate theme if provided
    if (request.theme !== undefined) {
      const themeError = UserValidation.validateTheme(request.theme);
      if (themeError) errors.push(themeError);
    }

    // Validate language if provided
    if (request.language !== undefined) {
      const languageError = UserValidation.validateLanguage(request.language);
      if (languageError) errors.push(languageError);
    }

    // Validate social links if provided
    if (request.social_links) {
      if (request.social_links.twitter && request.social_links.twitter.length > 100) {
        errors.push({ field: 'social_links.twitter', message: 'Twitter handle must be less than 100 characters' });
      }
      if (request.social_links.discord && request.social_links.discord.length > 100) {
        errors.push({ field: 'social_links.discord', message: 'Discord username must be less than 100 characters' });
      }
      if (request.social_links.github && request.social_links.github.length > 100) {
        errors.push({ field: 'social_links.github', message: 'GitHub username must be less than 100 characters' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate password change data
   */
  private static validatePasswordChangeData(request: ChangePasswordRequest): { isValid: boolean; errors: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate current password
    if (!request.current_password) {
      errors.push({ field: 'current_password', message: 'Current password is required' });
    }

    // Validate new password
    if (request.new_password !== undefined) {
      const passwordError = UserValidation.validatePassword(request.new_password);
      if (passwordError) errors.push(passwordError);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get user by username (public method for lookups)
   */
  static async getUserByUsername(username: string): Promise<{ success: boolean; user?: UserDetailsResponse['user']; message: string }> {
    try {
      const user = await userOperations.getUserByUsername(username);
      if (!user || user.deleted) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const userDetailsResponse = await this.getUserDetails({
        user_id: user.id,
        include_servers: false,
        include_activity: false,
        include_stats: false
      });

      return {
        success: true,
        user: userDetailsResponse.user,
        message: 'User found'
      };

    } catch (error) {
      console.error('Error getting user by username:', error);
      return {
        success: false,
        message: 'Error retrieving user'
      };
    }
  }

  /**
   * Get user by email (admin method)
   */
  static async getUserByEmail(email: string): Promise<{ success: boolean; user?: UserDetailsResponse['user']; message: string }> {
    try {
      const user = await userOperations.getUserByEmail(email);
      if (!user || user.deleted) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const userDetailsResponse = await this.getUserDetails({
        user_id: user.id,
        include_servers: false,
        include_activity: false,
        include_stats: false
      });

      return {
        success: true,
        user: userDetailsResponse.user,
        message: 'User found'
      };

    } catch (error) {
      console.error('Error getting user by email:', error);
      return {
        success: false,
        message: 'Error retrieving user'
      };
    }
  }

  /**
   * Update user coins
   */
  static async updateUserCoins(
    userId: number,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const success = await userOperations.updateUserCoins(userId, amount, reason);

      if (success) {
        return {
          success: true,
          message: 'User coins updated successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to update user coins'
        };
      }
    } catch (error) {
      console.error('Error updating user coins:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user coins'
      };
    }
  }

  /**
   * Update user metadata
   */
  static async updateUserMetadata(
    userId: number,
    metadata: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: any = {};

      // Add metadata fields to update data
      Object.keys(metadata).forEach(key => {
        updateData[key] = metadata[key];
      });

      const updatedUser = await userOperations.updateUser(userId, updateData);

      if (updatedUser) {
        return {
          success: true,
          message: 'User metadata updated successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to update user metadata'
        };
      }
    } catch (error) {
      console.error('Error updating user metadata:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user metadata'
      };
    }
  }



  /**
   * Change user password
   */
  static async changePassword(request: ChangePasswordRequest): Promise<{ success: boolean; message?: string; errors?: Array<{ field: string; message: string }> }> {
    try {
      console.log(`Changing password for user ${request.user_id}`);

      // Validate input data
      const validation = this.validatePasswordChangeData(request);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Get current user
      const currentUser = await userOperations.getUserById(request.user_id);
      if (!currentUser) {
        return {
          success: false,
          message: 'User not found',
          errors: [{ field: 'user_id', message: 'User not found' }]
        };
      }

      // Check if user has a password set
      if (!currentUser.password) {
        return {
          success: false,
          message: 'User does not have a password set',
          errors: [{ field: 'current_password', message: 'No password is currently set for this account' }]
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(request.current_password, currentUser.password);

      if (!isCurrentPasswordValid) {
        // Log failed password change attempt
        await SecurityLogsController.logPasswordChange(
          request.user_id,
          false,
          request.ip_address,
          request.user_agent,
          false
        );

        return {
          success: false,
          message: 'Current password is incorrect',
          errors: [{ field: 'current_password', message: 'Current password is incorrect' }]
        };
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(request.new_password, saltRounds);

      // Update password in database
      const updateData = {
        password: newPasswordHash
      };

      const updatedUser = await userOperations.updateUser(request.user_id, updateData);

      if (!updatedUser) {
        return {
          success: false,
          message: 'Failed to update password',
          errors: [{ field: 'password', message: 'Failed to update password in database' }]
        };
      }

      // Update password in Pterodactyl panel
      try {
        const pterodactylUpdateData = {
          username: updatedUser.username,
          email: updatedUser.email,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          password: request.new_password // Send plain text password to Pterodactyl (it will hash it)
        };

        console.log('Updating Pterodactyl user password for user:', request.user_id);
        await panelUserUpdate(request.user_id, pterodactylUpdateData);
        console.log('Pterodactyl password update successful');
      } catch (error) {
        console.error('Failed to update Pterodactyl user password:', error);
        // Don't fail the entire operation if Pterodactyl update fails
        // The password was successfully changed in the main database
        console.log('Password changed in database but Pterodactyl sync failed');
      }

      console.log(`Password changed successfully for user ${request.user_id}`);

      // Log password change event
      await SecurityLogsController.logPasswordChange(
        request.user_id,
        true,
        request.ip_address,
        request.user_agent,
        true // Pterodactyl synced
      );

      return {
        success: true,
        message: 'Password changed successfully and synced to Pterodactyl'
      };

    } catch (error) {
      console.error('Error changing password:', error);
      return {
        success: false,
        message: 'An unexpected error occurred while changing password',
        errors: [{ field: 'general', message: 'Internal server error' }]
      };
    }
  }
}