/**
 * CythroDash - User Database Management
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { Collection, Filter, UpdateFilter } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectToDatabase } from '../../../database/index';
import { 
  CythroDashUser, 
  UserRole, 
  UserTheme, 
  UserLanguage,
  UserHelpers 
} from '../../../database/tables/cythro_dash_users';

// User creation interface
export interface CreateUserData {
  // Required fields
  id: number; // Pterodactyl user ID
  pterodactyl_uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  
  // Optional fields
  password?: string;
  role?: UserRole;
  theme?: UserTheme;
  language?: UserLanguage;
  display_name?: string;
  referral_code?: string;
  referred_by?: string;
}

// User update interface
export interface UpdateUserData {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  password?: string; // Hashed password
  theme?: UserTheme;
  language?: UserLanguage;
  timezone?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  social_links?: {
    twitter?: string;
    discord?: string;
    github?: string;
  };
  referral_earnings?: number;
  referred_by?: string;
}

// Database collection management
class CythroDashUsersCollection {
  private collection!: Collection<CythroDashUser>;
  private initialized = false;

  async getCollection(): Promise<Collection<CythroDashUser>> {
    if (!this.initialized) {
      await this.initializeCollection();
    }
    return this.collection;
  }

  private async initializeCollection(): Promise<void> {
    const db = await connectToDatabase();
    this.collection = db.collection<CythroDashUser>('cythro_dash_users');
    
    // Create indexes for better performance
    await this.createIndexes();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    try {
      // Unique indexes
      await this.collection.createIndex({ id: 1 }, { unique: true });
      await this.collection.createIndex({ pterodactyl_uuid: 1 }, { unique: true });
      await this.collection.createIndex({ username: 1 }, { unique: true });
      await this.collection.createIndex({ email: 1 }, { unique: true });
      await this.collection.createIndex({ referral_code: 1 }, { unique: true, sparse: true });
      
      // Performance indexes
      await this.collection.createIndex({ role: 1 });
      await this.collection.createIndex({ banned: 1 });
      await this.collection.createIndex({ deleted: 1 });
      await this.collection.createIndex({ verified: 1 });
      await this.collection.createIndex({ last_activity: -1 });
      await this.collection.createIndex({ created_at: -1 });
      
      // Compound indexes
      await this.collection.createIndex({ deleted: 1, banned: 1 });
      await this.collection.createIndex({ role: 1, deleted: 1, banned: 1 });
      
      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error);
    }
  }
}

// Singleton instance
const usersCollection = new CythroDashUsersCollection();

// User operations class
export class UserOperations {
  private async getCollection(): Promise<Collection<CythroDashUser>> {
    return await usersCollection.getCollection();
  }

  // Create a new user
  async createUser(userData: CreateUserData): Promise<CythroDashUser> {
    const collection = await this.getCollection();
    
    // Check if user already exists
    const existingUser = await collection.findOne({
      $or: [
        { id: userData.id },
        { pterodactyl_uuid: userData.pterodactyl_uuid },
        { username: userData.username },
        { email: userData.email }
      ]
    });

    if (existingUser) {
      throw new Error('User already exists with this ID, UUID, username, or email');
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (userData.password) {
      hashedPassword = await bcrypt.hash(userData.password, 12);
    }

    // Generate referral code
    const referralCode = UserHelpers.generateReferralCode(userData.username);

    // Create user object with defaults
    const newUser: CythroDashUser = {
      ...UserHelpers.getDefaultUserValues(),
      ...userData,
      password: hashedPassword,
      referral_code: referralCode,
      created_at: new Date(),
      updated_at: new Date()
    } as CythroDashUser;

    // Insert user into database
    const result = await collection.insertOne(newUser);
    
    // Return the created user
    const createdUser = await collection.findOne({ _id: result.insertedId });
    if (!createdUser) {
      throw new Error('Failed to retrieve created user');
    }

    return createdUser;
  }

  // Get user by ID
  async getUserById(id: number): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ id, deleted: false });
  }

  // Get multiple users by IDs
  async getUsersByIds(ids: number[]): Promise<CythroDashUser[]> {
    if (ids.length === 0) return [];

    const collection = await this.getCollection();
    return await collection.find({
      id: { $in: ids },
      deleted: false
    }).toArray();
  }

  // Get user by Pterodactyl UUID
  async getUserByUuid(uuid: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ pterodactyl_uuid: uuid, deleted: false });
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ username, deleted: false });
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ email, deleted: false });
  }

  // Get user by referral code
  async getUserByReferralCode(referralCode: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ referral_code: referralCode, deleted: false });
  }

  // Update user
  async updateUser(id: number, updateData: UpdateUserData): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    
    const updateDoc: UpdateFilter<CythroDashUser> = {
      $set: {
        ...updateData,
        updated_at: new Date()
      }
    };

    await collection.updateOne({ id }, updateDoc);
    return await this.getUserById(id);
  }

  // Verify user email
  async verifyUserEmail(id: number): Promise<boolean> {
    const collection = await this.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          verified: true,
          verified_at: new Date(),
          updated_at: new Date()
        },
        $unset: {
          email_verification_token: ""
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Update user password
  async updatePassword(id: number, newPassword: string): Promise<boolean> {
    const collection = await this.getCollection();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          password: hashedPassword,
          updated_at: new Date()
        },
        $unset: {
          password_reset_token: "",
          password_reset_expires: ""
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Verify password
  async verifyPassword(id: number, password: string): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user || !user.password) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  // Ban user
  async banUser(id: number, reason: string, bannedBy: number): Promise<boolean> {
    const collection = await this.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          banned: true,
          banned_at: new Date(),
          banned_reason: reason,
          banned_by: bannedBy,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Unban user
  async unbanUser(id: number): Promise<boolean> {
    const collection = await this.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          banned: false,
          updated_at: new Date()
        },
        $unset: {
          banned_at: "",
          banned_reason: "",
          banned_by: ""
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Soft delete user
  async deleteUser(id: number): Promise<boolean> {
    const collection = await this.getCollection();
    
    const result = await collection.updateOne(
      { id },
      {
        $set: {
          deleted: true,
          deleted_at: new Date(),
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Restore deleted user
  async restoreUser(id: number): Promise<boolean> {
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { id },
      {
        $set: {
          deleted: false,
          updated_at: new Date()
        },
        $unset: {
          deleted_at: ""
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Update user coins
  async updateCoins(id: number, amount: number, _note: string): Promise<boolean> {
    const collection = await this.getCollection();
    const user = await this.getUserById(id);
    if (!user) return false;

    const newBalance = user.coins + amount;
    if (newBalance < 0) {
      throw new Error('Insufficient coins');
    }

    const updateDoc: UpdateFilter<CythroDashUser> = {
      $set: {
        coins: newBalance,
        updated_at: new Date()
      }
    };

    if (amount > 0) {
      updateDoc.$inc = { total_coins_earned: amount };
    } else {
      updateDoc.$inc = { total_coins_spent: Math.abs(amount) };
    }

    const result = await collection.updateOne({ id }, updateDoc);
    return result.modifiedCount > 0;
  }

  // Update last activity
  async updateLastActivity(id: number, ipAddress?: string): Promise<boolean> {
    const collection = await this.getCollection();

    const updateDoc: UpdateFilter<CythroDashUser> = {
      $set: {
        last_activity: new Date(),
        updated_at: new Date()
      }
    };

    if (ipAddress) {
      updateDoc.$set = {
        ...updateDoc.$set,
        last_login: new Date(),
        last_login_ip: ipAddress,
        failed_login_attempts: 0
      };
    }

    const result = await collection.updateOne({ id }, updateDoc);
    return result.modifiedCount > 0;
  }

  // Get all users with pagination
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    filter: Filter<CythroDashUser> = {}
  ): Promise<{ users: CythroDashUser[]; total: number; page: number; totalPages: number }> {
    const collection = await this.getCollection();
    const skip = (page - 1) * limit;

    const baseFilter = { deleted: false, ...filter };

    const [users, total] = await Promise.all([
      collection.find(baseFilter).skip(skip).limit(limit).toArray(),
      collection.countDocuments(baseFilter)
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Get user statistics
  async getUserStats(): Promise<{
    total: number;
    verified: number;
    unverified: number;
    admins: number;
    users: number;
    banned: number;
    deleted: number;
    with2fa: number;
  }> {
    const collection = await this.getCollection();

    const [
      total,
      verified,
      unverified,
      admins,
      users,
      banned,
      deleted,
      with2fa
    ] = await Promise.all([
      collection.countDocuments({ deleted: false }),
      collection.countDocuments({ deleted: false, verified: true }),
      collection.countDocuments({ deleted: false, verified: false }),
      collection.countDocuments({ deleted: false, role: UserRole.ADMIN }),
      collection.countDocuments({ deleted: false, role: UserRole.USER }),
      collection.countDocuments({ banned: true }),
      collection.countDocuments({ deleted: true }),
      collection.countDocuments({ deleted: false, two_factor_enabled: true })
    ]);

    return {
      total,
      verified,
      unverified,
      admins,
      users,
      banned,
      deleted,
      with2fa
    };
  }

  // Set email verification token
  async setEmailVerificationToken(id: number): Promise<string> {
    const collection = await this.getCollection();
    const token = crypto.randomBytes(32).toString('hex');

    await collection.updateOne(
      { id },
      {
        $set: {
          email_verification_token: token,
          updated_at: new Date()
        }
      }
    );

    return token;
  }

  // Set password reset token
  async setPasswordResetToken(id: number): Promise<string> {
    const collection = await this.getCollection();
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour from now

    await collection.updateOne(
      { id },
      {
        $set: {
          password_reset_token: token,
          password_reset_expires: expires,
          updated_at: new Date()
        }
      }
    );

    return token;
  }

  // Verify email verification token
  async verifyEmailToken(token: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({
      email_verification_token: token,
      deleted: false
    });
  }

  // Verify password reset token
  async verifyPasswordResetToken(token: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() },
      deleted: false
    });
  }

  // Update failed login attempts
  async updateFailedLoginAttempts(id: number, increment: boolean = true): Promise<boolean> {
    const collection = await this.getCollection();

    const updateDoc: UpdateFilter<CythroDashUser> = {
      $set: {
        updated_at: new Date()
      }
    };

    if (increment) {
      updateDoc.$inc = { failed_login_attempts: 1 };
    } else {
      updateDoc.$set = {
        ...updateDoc.$set,
        failed_login_attempts: 0
      };
    }

    const result = await collection.updateOne({ id }, updateDoc);
    return result.modifiedCount > 0;
  }

  // Lock user account
  async lockUserAccount(id: number, lockDurationMinutes: number = 30): Promise<boolean> {
    const collection = await this.getCollection();
    const lockUntil = new Date(Date.now() + lockDurationMinutes * 60000);

    const result = await collection.updateOne(
      { id },
      {
        $set: {
          locked_until: lockUntil,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Check if user account is locked
  async isUserLocked(id: number): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user || !user.locked_until) {
      return false;
    }

    return user.locked_until > new Date();
  }

  // Get users with pagination and sorting (for admin)
  async getUsersWithPagination(options: {
    filter?: Filter<CythroDashUser>;
    skip?: number;
    limit?: number;
    sort?: any;
  }): Promise<CythroDashUser[]> {
    const collection = await this.getCollection();
    const {
      filter = {},
      skip = 0,
      limit = 25,
      sort = { created_at: -1 }
    } = options;

    return await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  // Get total count of users matching filter
  async getUsersCount(filter: Filter<CythroDashUser> = {}): Promise<number> {
    const collection = await this.getCollection();
    return await collection.countDocuments(filter);
  }

  // Get total coins in circulation
  async getTotalCoinsInCirculation(): Promise<number> {
    const collection = await this.getCollection();
    const result = await collection.aggregate([
      {
        $match: {
          deleted: false,
          banned: false
        }
      },
      {
        $group: {
          _id: null,
          total_coins: { $sum: '$coins' }
        }
      }
    ]).toArray();

    return result.length > 0 ? result[0].total_coins : 0;
  }

  // Get users by role
  async getUsersByRole(role: UserRole): Promise<CythroDashUser[]> {
    const collection = await this.getCollection();
    return await collection.find({
      role,
      deleted: false
    }).toArray();
  }

  // Get recently registered users
  async getRecentUsers(days: number = 7, limit: number = 10): Promise<CythroDashUser[]> {
    const collection = await this.getCollection();
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await collection
      .find({
        created_at: { $gte: dateThreshold },
        deleted: false
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  // Get users with active sessions (recently active)
  async getActiveUsers(minutesThreshold: number = 30): Promise<CythroDashUser[]> {
    const collection = await this.getCollection();
    const dateThreshold = new Date(Date.now() - minutesThreshold * 60 * 1000);

    return await collection.find({
      last_activity: { $gte: dateThreshold },
      deleted: false,
      banned: false
    }).toArray();
  }

  // Search users by multiple criteria
  async searchUsers(searchTerm: string, limit: number = 20): Promise<CythroDashUser[]> {
    const collection = await this.getCollection();
    const searchRegex = { $regex: searchTerm, $options: 'i' };

    return await collection
      .find({
        $or: [
          { username: searchRegex },
          { email: searchRegex },
          { first_name: searchRegex },
          { last_name: searchRegex },
          { display_name: searchRegex }
        ],
        deleted: false
      })
      .limit(limit)
      .toArray();
  }

  // Discord OAuth connection operations
  async connectDiscord(userId: number, discordData: {
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
  }): Promise<boolean> {
    const collection = await this.getCollection();

    // Check if Discord account is already connected to another user
    const existingConnection = await collection.findOne({
      'oauth.discord.id': discordData.id,
      deleted: false
    });

    if (existingConnection && existingConnection.id !== userId) {
      throw new Error('This Discord account is already connected to another user');
    }

    const result = await collection.updateOne(
      { id: userId },
      {
        $set: {
          'oauth.discord': {
            id: discordData.id,
            username: discordData.username,
            discriminator: discordData.discriminator,
            avatar: discordData.avatar,
            connected_at: new Date()
          },
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Disconnect Discord OAuth
  async disconnectDiscord(userId: number): Promise<boolean> {
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { id: userId },
      {
        $unset: {
          'oauth.discord': ''
        },
        $set: {
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get user by Discord ID
  async getUserByDiscordId(discordId: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({
      'oauth.discord.id': discordId,
      deleted: false
    });
  }

  // Check if user has Discord connected
  async hasDiscordConnected(userId: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    return !!(user?.oauth?.discord?.id);
  }

  // Get Discord connection info
  async getDiscordConnection(userId: number): Promise<{
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
    connected_at: Date;
  } | null> {
    const user = await this.getUserById(userId);
    return user?.oauth?.discord || null;
  }

  // GitHub OAuth connection operations
  async connectGitHub(userId: number, githubData: {
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
  }): Promise<boolean> {
    const collection = await this.getCollection();

    // Check if GitHub account is already connected to another user
    const existingConnection = await collection.findOne({
      'oauth.github.id': githubData.id,
      deleted: false
    });

    if (existingConnection && existingConnection.id !== userId) {
      throw new Error('This GitHub account is already connected to another user');
    }

    const result = await collection.updateOne(
      { id: userId },
      {
        $set: {
          'oauth.github': {
            id: githubData.id,
            login: githubData.login,
            name: githubData.name,
            avatar_url: githubData.avatar_url,
            connected_at: new Date()
          },
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Disconnect GitHub OAuth
  async disconnectGitHub(userId: number): Promise<boolean> {
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { id: userId },
      {
        $unset: {
          'oauth.github': ''
        },
        $set: {
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get user by GitHub ID
  async getUserByGitHubId(githubId: number): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({
      'oauth.github.id': githubId,
      deleted: false
    });
  }

  // Check if user has GitHub connected
  async hasGitHubConnected(userId: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    return !!(user?.oauth?.github?.id);
  }

  // Get GitHub connection info
  async getGitHubConnection(userId: number): Promise<{
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
    connected_at: Date;
  } | null> {
    const user = await this.getUserById(userId);
    return user?.oauth?.github || null;
  }

  // Update user coins (for transfers)
  async updateUserCoins(userId: number, amount: number, reason: string): Promise<boolean> {
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { id: userId },
      {
        $inc: { coins: amount },
        $set: { updated_at: new Date() },
        $push: {
          coin_history: {
            amount,
            reason,
            timestamp: new Date(),
            balance_after: 0 // Will be updated by a separate query if needed
          }
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Get user by username (for transfers)
  async getUserByUsername(username: string): Promise<CythroDashUser | null> {
    const collection = await this.getCollection();
    return await collection.findOne({
      username: username,
      deleted: false
    });
  }

  // Search users (for transfer autocomplete)
  async searchUsers(searchTerm: string, limit: number = 10): Promise<CythroDashUser[]> {
    const collection = await this.getCollection();

    const searchRegex = new RegExp(searchTerm, 'i');

    return await collection
      .find({
        $or: [
          { username: searchRegex },
          { display_name: searchRegex },
          { email: searchRegex }
        ],
        deleted: false,
        banned: false
      })
      .limit(limit)
      .toArray();
  }
}

// Export singleton instance
export const userOperations = new UserOperations();
