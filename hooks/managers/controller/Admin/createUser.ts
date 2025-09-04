/**
 * CythroDash - Admin Create User Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations } from '@/hooks/managers/database/user';
import { panelUserCreate, UserCreateData } from '@/hooks/managers/pterodactyl/users';

// Interface for admin create user request
export interface AdminCreateUserRequest {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role?: number; // 0 = admin, 1 = user (default)
  root_admin?: boolean; // For Pterodactyl panel admin
  language?: string;
  display_name?: string;
  referral_code?: string;
}

// Interface for create user response
export interface AdminCreateUserResponse {
  success: boolean;
  message: string;
  user?: any;
  pterodactyl_user?: any;
  error?: string;
}

export class AdminCreateUserController {
  /**
   * Create a new user (both in database and Pterodactyl panel)
   */
  static async createUser(
    userData: AdminCreateUserRequest,
    adminUserId: number,
    adminIP?: string
  ): Promise<AdminCreateUserResponse> {
    try {
      console.log(`🔨 Admin ${adminUserId} creating new user: ${userData.username}`);

      // Validate required fields
      if (!userData.username || !userData.email || !userData.password) {
        return {
          success: false,
          message: 'Username, email, and password are required',
          error: 'MISSING_REQUIRED_FIELDS'
        };
      }

      // Check if user already exists in database
      const existingUser = await userOperations.getUserByEmail(userData.email);
      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        };
      }

      const existingUsername = await userOperations.getUserByUsername(userData.username);
      if (existingUsername) {
        return {
          success: false,
          message: 'Username is already taken',
          error: 'USERNAME_EXISTS'
        };
      }

      // Step 1: Create user in Pterodactyl panel first
      const pterodactylUserData: UserCreateData = {
        username: userData.username,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        password: userData.password,
        language: userData.language || 'en',
        root_admin: userData.root_admin || false
      };

      console.log('📡 Creating user in Pterodactyl panel...');
      const pterodactylResponse = await panelUserCreate(pterodactylUserData);

      if (!pterodactylResponse.attributes) {
        throw new Error('Failed to create user in Pterodactyl panel');
      }

      const pterodactylUser = pterodactylResponse.attributes;
      console.log(`✅ Pterodactyl user created with ID: ${pterodactylUser.id}`);

      // Step 2: Create user in CythroDash database
      const databaseUserData = {
        id: pterodactylUser.id, // Use Pterodactyl user ID
        pterodactyl_uuid: pterodactylUser.uuid,
        username: userData.username,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        password: userData.password, // Will be hashed by userOperations
        role: userData.role || 1, // Default to user role
        display_name: userData.display_name,
        referral_code: userData.referral_code,
        language: userData.language as any || 'en'
      };

      console.log('💾 Creating user in CythroDash database...');
      const databaseUser = await userOperations.createUser(databaseUserData);
      console.log(`✅ Database user created with ID: ${databaseUser.id}`);

      // Log the creation event
      console.log(`✅ Admin ${adminUserId} created user: ${databaseUser.username} (ID: ${databaseUser.id})`);

      return {
        success: true,
        message: 'User created successfully',
        user: {
          id: databaseUser.id,
          username: databaseUser.username,
          email: databaseUser.email,
          first_name: databaseUser.first_name,
          last_name: databaseUser.last_name,
          role: databaseUser.role,
          pterodactyl_uuid: databaseUser.pterodactyl_uuid,
          created_at: databaseUser.created_at
        },
        pterodactyl_user: pterodactylUser
      };

    } catch (error) {
      console.error('💥 Admin create user error:', error);

      // Log the error
      console.error(`❌ Admin ${adminUserId} failed to create user: ${userData.username}`, error);

      return {
        success: false,
        message: 'Failed to create user',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
