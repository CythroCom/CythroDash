/**
 * CythroDash - User Login Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations } from '../../database/user';
import {
  panelUserGetDetails,
  PterodactylError
} from '../../pterodactyl/users';
import { CythroDashUser, UserHelpers } from '../../../../database/tables/cythro_dash_users';
import { SecurityLogsController } from '../Security/Logs';
import { SecurityLogAction } from '../../../../database/tables/cythro_dash_users_logs';

// Login interfaces
export interface LoginRequest {
  identifier: string; // Can be email or username
  password: string;
  remember_me?: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: number;
    verified: boolean;
    coins: number;
    theme: string;
    language: string;
    avatar_url?: string;
  };
  session?: {
    token: string;
    expires_at: Date;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
  requires_2fa?: boolean;
  account_locked?: boolean;
  lock_expires?: Date;
}

// Login controller class
export class LoginController {

  /**
   * Authenticate user with email/username and password
   */
  static async loginUser(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Check if login is enabled
      if (process.env.ACCOUNT_LOGIN === 'false') {
        return {
          success: false,
          message: 'User login is currently disabled'
        };
      }

      // Validate input data
      const validation = this.validateLoginData(request);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Find user by email or username
      let user: CythroDashUser | null = null;

      // Check if identifier is email format
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.identifier);

      if (isEmail) {
        user = await userOperations.getUserByEmail(request.identifier);
      } else {
        user = await userOperations.getUserByUsername(request.identifier);
      }

      if (!user) {
        // Increment failed attempts for security (even if user doesn't exist)
        await this.handleFailedLogin(request.identifier, request.ip_address);

        return {
          success: false,
          message: 'Invalid credentials',
          errors: [{ field: 'identifier', message: 'User not found' }]
        };
      }

      // Check if account is locked
      const isLocked = await userOperations.isUserLocked(user.id);
      if (isLocked) {
        return {
          success: false,
          message: 'Account is temporarily locked due to too many failed login attempts',
          account_locked: true,
          lock_expires: user.locked_until
        };
      }

      // Check if account is banned
      if (user.banned) {
        return {
          success: false,
          message: user.banned_reason || 'Your account has been banned',
          errors: [{ field: 'general', message: 'Account banned' }]
        };
      }

      // Check if account is deleted
      if (user.deleted) {
        return {
          success: false,
          message: 'Account not found',
          errors: [{ field: 'general', message: 'Account deleted' }]
        };
      }

      // Verify password
      const passwordValid = await userOperations.verifyPassword(user.id, request.password);
      if (!passwordValid) {
        await this.handleFailedLogin(request.identifier, request.ip_address, user.id);

        return {
          success: false,
          message: 'Invalid credentials',
          errors: [{ field: 'password', message: 'Incorrect password' }]
        };
      }

      // Check email verification if required
      if (!user.verified && UserHelpers.isVerificationRequired()) {
        return {
          success: false,
          message: 'Please verify your email address before logging in',
          errors: [{ field: 'general', message: 'Email not verified' }]
        };
      }

      // Check 2FA if enabled
      if (user.two_factor_enabled) {
        // For now, return that 2FA is required
        // In a full implementation, you'd handle the 2FA token here
        return {
          success: false,
          message: 'Two-factor authentication required',
          requires_2fa: true
        };
      }

      // Sync with Pterodactyl panel to ensure user still exists
      try {
        await panelUserGetDetails(user.id);
      } catch (error) {
        if (error instanceof PterodactylError && error.status === 404) {
          // User doesn't exist in Pterodactyl anymore
          await userOperations.deleteUser(user.id);
          return {
            success: false,
            message: 'Account not found in panel',
            errors: [{ field: 'general', message: 'Account sync error' }]
          };
        }
        // Log error but don't block login for other panel errors
        console.error('Panel sync error during login:', error);
      }

      // Reset failed login attempts
      await userOperations.updateFailedLoginAttempts(user.id, false);

      // Update last activity and login info
      await userOperations.updateLastActivity(user.id, request.ip_address);

      // Log successful login
      await SecurityLogsController.logAuthEvent(
        user.id,
        SecurityLogAction.LOGIN_SUCCESS,
        true,
        request.ip_address,
        request.user_agent,
        {
          remember_me: request.remember_me,
          login_method: isEmail ? 'email' : 'username'
        }
      );

      // Generate session token (simplified - in production use proper JWT or session management)
      const sessionToken = this.generateSessionToken();
      const expiresAt = new Date(Date.now() + (request.remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)); // 30 days or 1 day

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          verified: user.verified,
          coins: user.coins,
          theme: user.theme,
          language: user.language,
          avatar_url: user.avatar_url
        },
        session: {
          token: sessionToken,
          expires_at: expiresAt
        }
      };

    } catch (error) {
      console.error('Login error:', error);

      return {
        success: false,
        message: 'An unexpected error occurred during login',
        errors: [{ field: 'general', message: 'Login failed' }]
      };
    }
  }

  /**
   * Validate login data
   */
  private static validateLoginData(request: LoginRequest): { isValid: boolean; errors: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    if (!request.identifier || request.identifier.trim().length === 0) {
      errors.push({ field: 'identifier', message: 'Email or username is required' });
    }

    if (!request.password || request.password.length === 0) {
      errors.push({ field: 'password', message: 'Password is required' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Handle failed login attempts
   */
  private static async handleFailedLogin(identifier: string, ipAddress?: string, userId?: number): Promise<void> {
    try {
      if (userId) {
        // Increment failed attempts for known user
        await userOperations.updateFailedLoginAttempts(userId, true);

        // Log failed login attempt
        await SecurityLogsController.logAuthEvent(
          userId,
          SecurityLogAction.LOGIN_FAILED,
          false,
          ipAddress,
          undefined,
          {
            identifier: identifier,
            reason: 'invalid_credentials'
          }
        );

        // Check if we should lock the account
        const user = await userOperations.getUserById(userId);
        if (user && user.failed_login_attempts >= 5) {
          await userOperations.lockUserAccount(userId, 30); // Lock for 30 minutes

          // Log account lock event
          await SecurityLogsController.createLog({
            user_id: userId,
            action: SecurityLogAction.ACCOUNT_LOCKED,
            description: 'Account locked due to multiple failed login attempts',
            details: {
              failed_attempts: user.failed_login_attempts,
              lock_duration_minutes: 30
            },
            ip_address: ipAddress,
            is_suspicious: true,
            requires_attention: true
          });
        }
      } else {
        // Log failed attempt for unknown user (security monitoring)
        console.warn(`Failed login attempt for unknown user ${identifier} from IP: ${ipAddress || 'unknown'}`);
      }
    } catch (error) {
      console.error('Error handling failed login:', error);
    }
  }

  /**
   * Generate session token (simplified implementation)
   */
  private static generateSessionToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Logout user (invalidate session)
   */
  static async logoutUser(sessionToken: string, userId?: number, ipAddress?: string, userAgent?: string): Promise<{ success: boolean; message: string }> {
    try {
      // In a full implementation, you would invalidate the session token
      // For now, we'll just return success

      // Log logout event if user ID is provided
      if (userId) {
        await SecurityLogsController.logAuthEvent(
          userId,
          SecurityLogAction.LOGOUT,
          true,
          ipAddress,
          userAgent,
          {
            session_token: sessionToken.substring(0, 8) + '...' // Log partial token for tracking
          }
        );
      }

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'An error occurred during logout'
      };
    }
  }



  /**
   * Refresh session token
   */
  static async refreshSession(sessionToken: string): Promise<{ success: boolean; newToken?: string; expiresAt?: Date }> {
    try {
      // In a full implementation, you would validate the old token
      // and generate a new one
      const newToken = this.generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

      return {
        success: true,
        newToken,
        expiresAt
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return {
        success: false
      };
    }
  }
}