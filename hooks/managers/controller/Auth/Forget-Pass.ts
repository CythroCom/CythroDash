/**
 * CythroDash - Password Reset Controller
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { userOperations } from '../../database/user';
import { UserValidation } from '../../database/user-validation';
import {
  panelUserUpdate,
  PterodactylError
} from '../../pterodactyl/users';

// Password reset interfaces
export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirm_password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Password reset controller class
export class ForgetPasswordController {

  /**
   * Initiate password reset process
   */
  static async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    try {
      // Validate email format
      const emailError = UserValidation.validateEmail(request.email);
      if (emailError) {
        return {
          success: false,
          message: 'Invalid email format',
          errors: [emailError]
        };
      }

      // Find user by email
      const user = await userOperations.getUserByEmail(request.email);

      // Always return success for security (don't reveal if email exists)
      // But only send email if user actually exists
      if (user) {
        // Check if account is banned or deleted
        if (user.banned) {
          return {
            success: false,
            message: 'Cannot reset password for banned account',
            errors: [{ field: 'email', message: 'Account is banned' }]
          };
        }

        if (user.deleted) {
          return {
            success: false,
            message: 'Account not found',
            errors: [{ field: 'email', message: 'Account not found' }]
          };
        }

        // Generate password reset token
        const resetToken = await userOperations.setPasswordResetToken(user.id);

        // TODO: Send password reset email with token
        console.log(`Password reset token for ${user.email}: ${resetToken}`);
      }

      return {
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      };

    } catch (error) {
      console.error('Forgot password error:', error);

      return {
        success: false,
        message: 'An unexpected error occurred',
        errors: [{ field: 'general', message: 'Password reset failed' }]
      };
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    try {
      // Validate input
      const validation = this.validateResetPasswordData(request);
      if (!validation.isValid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Verify reset token
      const user = await userOperations.verifyPasswordResetToken(request.token);
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired reset token',
          errors: [{ field: 'token', message: 'Token is invalid or expired' }]
        };
      }

      // Check if account is banned or deleted
      if (user.banned) {
        return {
          success: false,
          message: 'Cannot reset password for banned account',
          errors: [{ field: 'general', message: 'Account is banned' }]
        };
      }

      if (user.deleted) {
        return {
          success: false,
          message: 'Account not found',
          errors: [{ field: 'general', message: 'Account not found' }]
        };
      }

      // Update password in our database
      const passwordUpdated = await userOperations.updatePassword(user.id, request.password);
      if (!passwordUpdated) {
        return {
          success: false,
          message: 'Failed to update password',
          errors: [{ field: 'general', message: 'Password update failed' }]
        };
      }

      // Update password in Pterodactyl panel
      try {
        await panelUserUpdate(user.id, {
          password: request.password
        });
      } catch (error) {
        console.error('Failed to update password in Pterodactyl panel:', error);
        // Don't fail the entire operation if panel update fails
        // The user can still log in with the new password
      }

      // Reset failed login attempts
      await userOperations.updateFailedLoginAttempts(user.id, false);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      };

    } catch (error) {
      console.error('Reset password error:', error);

      return {
        success: false,
        message: 'An unexpected error occurred during password reset',
        errors: [{ field: 'general', message: 'Password reset failed' }]
      };
    }
  }

  /**
   * Validate reset password data
   */
  private static validateResetPasswordData(request: ResetPasswordRequest): { isValid: boolean; errors: Array<{ field: string; message: string }> } {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate token
    if (!request.token || request.token.trim().length === 0) {
      errors.push({ field: 'token', message: 'Reset token is required' });
    }

    // Validate password
    const passwordError = UserValidation.validatePassword(request.password);
    if (passwordError) {
      errors.push(passwordError);
    }

    // Check password confirmation
    if (request.password !== request.confirm_password) {
      errors.push({ field: 'confirm_password', message: 'Passwords do not match' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify reset token validity
   */
  static async verifyResetToken(token: string): Promise<{ valid: boolean; message: string }> {
    try {
      const user = await userOperations.verifyPasswordResetToken(token);

      if (!user) {
        return {
          valid: false,
          message: 'Invalid or expired reset token'
        };
      }

      if (user.banned || user.deleted) {
        return {
          valid: false,
          message: 'Account is not available for password reset'
        };
      }

      return {
        valid: true,
        message: 'Token is valid'
      };

    } catch (error) {
      console.error('Token verification error:', error);
      return {
        valid: false,
        message: 'Error verifying token'
      };
    }
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message: string; errors?: Array<{ field: string; message: string }> }> {
    try {
      // Validate new password
      const passwordError = UserValidation.validatePassword(newPassword);
      if (passwordError) {
        return {
          success: false,
          message: 'Invalid new password',
          errors: [passwordError]
        };
      }

      // Check password confirmation
      if (newPassword !== confirmPassword) {
        return {
          success: false,
          message: 'Passwords do not match',
          errors: [{ field: 'confirm_password', message: 'Passwords do not match' }]
        };
      }

      // Verify current password
      const currentPasswordValid = await userOperations.verifyPassword(userId, currentPassword);
      if (!currentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect',
          errors: [{ field: 'current_password', message: 'Current password is incorrect' }]
        };
      }

      // Update password
      const passwordUpdated = await userOperations.updatePassword(userId, newPassword);
      if (!passwordUpdated) {
        return {
          success: false,
          message: 'Failed to update password',
          errors: [{ field: 'general', message: 'Password update failed' }]
        };
      }

      // Update password in Pterodactyl panel
      try {
        await panelUserUpdate(userId, {
          password: newPassword
        });
      } catch (error) {
        console.error('Failed to update password in Pterodactyl panel:', error);
        // Don't fail the entire operation
      }

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      console.error('Change password error:', error);

      return {
        success: false,
        message: 'An unexpected error occurred',
        errors: [{ field: 'general', message: 'Password change failed' }]
      };
    }
  }
}