/**
 * CythroDash - User Registration Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations, CreateUserData } from '../../database/user';
import { UserValidation, ValidationResult } from '../../database/user-validation';
import {
  panelUserCreate,
  panelUserExistsByEmail,
  panelUserExistsByUsername,
  PterodactylError,
  UserCreateData as PterodactylUserCreateData
} from '../../pterodactyl/users';
import {
  UserRole,
  UserTheme,
  UserLanguage,
  UserHelpers
} from '../../../../database/tables/cythro_dash_users';

// Registration interfaces
export interface RegisterRequest {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  referral_code?: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  marketing_emails?: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    username: string;
    email: string;
    verified: boolean;
    verification_required: boolean;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Registration controller class
export class RegisterController {
  static async registerUser(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Check if registration is enabled
      if (process.env.ACCOUNT_CREATION === 'false') {
        return {
          success: false,
          message: 'User registration is currently disabled'
        };
      }

      // Log verification setting for debugging
      const verificationRequired = UserHelpers.isVerificationRequired();
      console.log(`Registration attempt for ${request.email}. Verification required: ${verificationRequired} (ACCOUNT_VERIFICATION=${process.env.ACCOUNT_VERIFICATION})`);

      // Validate input data
      const validation = await this.validateRegistrationData(request);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Check if user already exists in Pterodactyl
      const [emailExists, usernameExists] = await Promise.all([
        panelUserExistsByEmail(request.email),
        panelUserExistsByUsername(request.username)
      ]);

      if (emailExists) {
        return {
          success: false,
          message: 'An account with this email already exists',
          errors: [{ field: 'email', message: 'Email already registered' }]
        };
      }

      if (usernameExists) {
        return {
          success: false,
          message: 'This username is already taken',
          errors: [{ field: 'username', message: 'Username already taken' }]
        };
      }

      // Check if user exists in our database
      const [dbEmailUser, dbUsernameUser] = await Promise.all([
        userOperations.getUserByEmail(request.email),
        userOperations.getUserByUsername(request.username)
      ]);

      if (dbEmailUser) {
        return {
          success: false,
          message: 'An account with this email already exists in our system',
          errors: [{ field: 'email', message: 'Email already registered' }]
        };
      }

      if (dbUsernameUser) {
        return {
          success: false,
          message: 'This username is already taken in our system',
          errors: [{ field: 'username', message: 'Username already taken' }]
        };
      }

      // Validate referral code if provided
      let referredBy: string | undefined;
      if (request.referral_code) {
        const referrer = await userOperations.getUserByReferralCode(request.referral_code);
        if (!referrer) {
          return {
            success: false,
            message: 'Invalid referral code',
            errors: [{ field: 'referral_code', message: 'Referral code not found' }]
          };
        }
        referredBy = request.referral_code;
      }

      // Create user in Pterodactyl first
      const pterodactylUserData: PterodactylUserCreateData = {
        email: request.email,
        username: request.username,
        first_name: request.first_name,
        last_name: request.last_name,
        password: request.password,
        language: 'en',
        root_admin: false
      };

      const pterodactylUser = await panelUserCreate(pterodactylUserData);

      if (!pterodactylUser.attributes) {
        throw new Error('Failed to create user in Pterodactyl panel');
      }

      // Create user in our database
      const dashUserData: CreateUserData = {
        id: pterodactylUser.attributes.id,
        pterodactyl_uuid: pterodactylUser.attributes.uuid,
        username: request.username,
        email: request.email,
        first_name: request.first_name,
        last_name: request.last_name,
        password: request.password,
        role: UserRole.USER,
        theme: UserTheme.DARK,
        language: UserLanguage.EN,
        referred_by: referredBy
      };

      const dashUser = await userOperations.createUser(dashUserData);

      // Handle email verification if required
      let verificationToken: string | undefined;

      if (verificationRequired && !dashUser.verified) {
        // Only set verification token if verification is required and user is not already verified
        verificationToken = await userOperations.setEmailVerificationToken(dashUser.id);
        // TODO: Send verification email with token
        console.log(`Verification required for ${dashUser.email}. Token: ${verificationToken}`);
      }

      // Award referral bonus if applicable
      if (referredBy) {
        await this.handleReferralBonus(referredBy, dashUser.id, request.ip_address, request.user_agent);
      }

      // Award welcome bonus
      await userOperations.updateCoins(dashUser.id, 100, 'Welcome bonus');

      // Prepare response message based on verification status
      let responseMessage: string;
      if (verificationRequired && !dashUser.verified) {
        responseMessage = 'Account created successfully! Please check your email to verify your account before logging in.';
      } else {
        responseMessage = 'Account created successfully! You can now log in to your dashboard.';
      }

      return {
        success: true,
        message: responseMessage,
        user: {
          id: dashUser.id,
          username: dashUser.username,
          email: dashUser.email,
          verified: dashUser.verified,
          verification_required: verificationRequired
        }
      };

    } catch (error) {
      console.error('Registration error:', error);

      if (error instanceof PterodactylError) {
        return {
          success: false,
          message: `Panel error: ${error.message}`,
          errors: [{ field: 'general', message: error.message }]
        };
      }

      return {
        success: false,
        message: 'An unexpected error occurred during registration',
        errors: [{ field: 'general', message: 'Registration failed' }]
      };
    }
  }

  /**
   * Validate registration data
   */
  private static async validateRegistrationData(request: RegisterRequest): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];

    // Check terms acceptance
    if (!request.terms_accepted) {
      errors.push({ field: 'terms_accepted', message: 'You must accept the terms of service' });
    }

    if (!request.privacy_accepted) {
      errors.push({ field: 'privacy_accepted', message: 'You must accept the privacy policy' });
    }

    // Check password confirmation
    if (request.password !== request.confirm_password) {
      errors.push({ field: 'confirm_password', message: 'Passwords do not match' });
    }

    // Validate individual fields
    const emailError = UserValidation.validateEmail(request.email);
    if (emailError) errors.push(emailError);

    const usernameError = UserValidation.validateUsername(request.username);
    if (usernameError) errors.push(usernameError);

    const passwordError = UserValidation.validatePassword(request.password);
    if (passwordError) errors.push(passwordError);

    const firstNameError = UserValidation.validateName(request.first_name, 'first_name');
    if (firstNameError) errors.push(firstNameError);

    const lastNameError = UserValidation.validateName(request.last_name, 'last_name');
    if (lastNameError) errors.push(lastNameError);

    if (request.referral_code) {
      const referralError = UserValidation.validateReferralCode(request.referral_code);
      if (referralError) errors.push(referralError);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Handle referral bonus using new referrals system
   */
  private static async handleReferralBonus(referralCode: string, newUserId: number, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // Import referrals controller
      const { ReferralsController } = await import('../User/Referrals');

      const referrer = await userOperations.getUserByReferralCode(referralCode);
      if (referrer) {
        // Process referral signup through new system
        const signupRequest = {
          referrer_id: referrer.id,
          referred_user_id: newUserId,
          referral_code: referralCode,
          ip_address: ipAddress || 'unknown',
          user_agent: userAgent || 'unknown',
          device_info: {
            device_type: 'desktop' as const // Default for server-side registration
          }
        };

        const result = await ReferralsController.processReferralSignup(signupRequest);

        if (result.success) {
          console.log(`Referral signup processed successfully for user ${newUserId} referred by ${referrer.username}`);

          // Award coins to referrer if signup was verified
          if (result.data && result.data.verified) {
            await userOperations.updateCoins(referrer.id, result.data.reward_earned, 'Referral signup bonus');

            // Update referrer's referral earnings
            await userOperations.updateUser(referrer.id, {
              referral_earnings: (referrer.referral_earnings || 0) + result.data.reward_earned
            });
          }
        } else {
          console.warn(`Referral signup processing failed: ${result.message}`);
          // Fallback to old system
          await userOperations.updateCoins(referrer.id, 50, 'Referral bonus (fallback)');
        }
      }
    } catch (error) {
      console.error('Error handling referral bonus:', error);
      // Don't throw error as this shouldn't block registration
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await userOperations.verifyEmailToken(token);
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }

      const success = await userOperations.verifyUserEmail(user.id);
      if (success) {
        // Award email verification bonus
        await userOperations.updateCoins(user.id, 25, 'Email verification bonus');

        return {
          success: true,
          message: 'Email verified successfully! You can now log in.'
        };
      } else {
        return {
          success: false,
          message: 'Failed to verify email'
        };
      }
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: 'An error occurred during email verification'
      };
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await userOperations.getUserByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'No account found with this email address'
        };
      }

      if (user.verified) {
        return {
          success: false,
          message: 'This account is already verified'
        };
      }

      await userOperations.setEmailVerificationToken(user.id);
      // TODO: Send verification email with token

      return {
        success: true,
        message: 'Verification email sent successfully'
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        message: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Get current verification settings for debugging/admin purposes
   */
  static getVerificationSettings(): {
    verification_required: boolean;
    account_verification_env: string | undefined;
    account_creation_enabled: boolean;
  } {
    return {
      verification_required: UserHelpers.isVerificationRequired(),
      account_verification_env: process.env.ACCOUNT_VERIFICATION,
      account_creation_enabled: process.env.ACCOUNT_CREATION !== 'false'
    };
  }

  /**
   * Test verification flow (for development/testing purposes)
   */
  static async testVerificationFlow(): Promise<{
    settings: ReturnType<typeof RegisterController.getVerificationSettings>;
    test_user_defaults: {
      verified: boolean;
      verified_at: Date | undefined;
    };
  }> {
    const settings = this.getVerificationSettings();
    const defaults = UserHelpers.getDefaultUserValues();

    return {
      settings,
      test_user_defaults: {
        verified: defaults.verified || false,
        verified_at: defaults.verified_at
      }
    };
  }
}