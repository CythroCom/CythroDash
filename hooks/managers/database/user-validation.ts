/**
 * CythroDash - User Data Validation
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { UserRole, UserTheme, UserLanguage } from '../../../database/tables/cythro_dash_users';

// Validation error interface
export interface ValidationError {
  field: string;
  message: string;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// User validation class
export class UserValidation {
  
  // Validate email format
  static validateEmail(email: string): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      return { field: 'email', message: 'Email is required' };
    }
    
    if (!emailRegex.test(email)) {
      return { field: 'email', message: 'Invalid email format' };
    }
    
    if (email.length > 255) {
      return { field: 'email', message: 'Email must be less than 255 characters' };
    }
    
    return null;
  }

  // Validate username
  static validateUsername(username: string): ValidationError | null {
    if (!username) {
      return { field: 'username', message: 'Username is required' };
    }
    
    if (username.length < 3) {
      return { field: 'username', message: 'Username must be at least 3 characters long' };
    }
    
    if (username.length > 30) {
      return { field: 'username', message: 'Username must be less than 30 characters' };
    }
    
    // Allow alphanumeric, underscore, and hyphen
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return { field: 'username', message: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }
    
    return null;
  }

  // Validate password
  static validatePassword(password: string): ValidationError | null {
    if (!password) {
      return { field: 'password', message: 'Password is required' };
    }
    
    if (password.length < 8) {
      return { field: 'password', message: 'Password must be at least 8 characters long' };
    }
    
    if (password.length > 128) {
      return { field: 'password', message: 'Password must be less than 128 characters' };
    }
    
    // Check for at least one uppercase, one lowercase, one number
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return { 
        field: 'password', 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      };
    }
    
    return null;
  }

  // Validate name (first_name, last_name)
  static validateName(name: string, fieldName: string): ValidationError | null {
    if (!name) {
      return { field: fieldName, message: `${fieldName.replace('_', ' ')} is required` };
    }
    
    if (name.length < 1) {
      return { field: fieldName, message: `${fieldName.replace('_', ' ')} cannot be empty` };
    }
    
    if (name.length > 50) {
      return { field: fieldName, message: `${fieldName.replace('_', ' ')} must be less than 50 characters` };
    }
    
    // Allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(name)) {
      return { 
        field: fieldName, 
        message: `${fieldName.replace('_', ' ')} can only contain letters, spaces, hyphens, and apostrophes` 
      };
    }
    
    return null;
  }

  // Validate display name
  static validateDisplayName(displayName: string): ValidationError | null {
    if (!displayName) {
      return null; // Display name is optional
    }
    
    if (displayName.length > 50) {
      return { field: 'display_name', message: 'Display name must be less than 50 characters' };
    }
    
    // Allow most characters but not control characters
    const displayNameRegex = /^[^\x00-\x1F\x7F]+$/;
    if (!displayNameRegex.test(displayName)) {
      return { field: 'display_name', message: 'Display name contains invalid characters' };
    }
    
    return null;
  }

  // Validate role
  static validateRole(role: any): ValidationError | null {
    if (role === undefined || role === null) {
      return null; // Role is optional, will default
    }
    
    if (!Object.values(UserRole).includes(role)) {
      return { field: 'role', message: 'Invalid user role' };
    }
    
    return null;
  }

  // Validate theme
  static validateTheme(theme: any): ValidationError | null {
    if (theme === undefined || theme === null) {
      return null; // Theme is optional, will default
    }
    
    if (!Object.values(UserTheme).includes(theme)) {
      return { field: 'theme', message: 'Invalid theme selection' };
    }
    
    return null;
  }

  // Validate language
  static validateLanguage(language: any): ValidationError | null {
    if (language === undefined || language === null) {
      return null; // Language is optional, will default
    }
    
    if (!Object.values(UserLanguage).includes(language)) {
      return { field: 'language', message: 'Invalid language selection' };
    }
    
    return null;
  }

  // Validate URL (for website, avatar_url, etc.)
  static validateUrl(url: string, fieldName: string): ValidationError | null {
    if (!url) {
      return null; // URLs are typically optional
    }
    
    try {
      new URL(url);
    } catch {
      return { field: fieldName, message: `Invalid ${fieldName.replace('_', ' ')} URL format` };
    }
    
    if (url.length > 500) {
      return { field: fieldName, message: `${fieldName.replace('_', ' ')} URL must be less than 500 characters` };
    }
    
    return null;
  }

  // Validate bio
  static validateBio(bio: string): ValidationError | null {
    if (!bio) {
      return null; // Bio is optional
    }
    
    if (bio.length > 500) {
      return { field: 'bio', message: 'Bio must be less than 500 characters' };
    }
    
    return null;
  }

  // Validate timezone
  static validateTimezone(timezone: string): ValidationError | null {
    if (!timezone) {
      return null; // Timezone is optional
    }

    // Common timezone formats:
    // 1. UTC
    // 2. Region/City format (e.g., America/New_York)
    // 3. GMT+/-offset (e.g., GMT+5, GMT-8)
    const validTimezones = [
      'UTC',
      'GMT',
      /^[A-Za-z_]+\/[A-Za-z_]+$/, // Region/City format
      /^GMT[+-]\d{1,2}$/, // GMT offset format
      /^[A-Z]{3,4}$/ // Common abbreviations like EST, PST, etc.
    ];

    const isValid = validTimezones.some(pattern => {
      if (typeof pattern === 'string') {
        return timezone === pattern;
      } else {
        return pattern.test(timezone);
      }
    });

    if (!isValid) {
      return { field: 'timezone', message: 'Invalid timezone format. Use UTC, GMT, Region/City format, or GMT offset.' };
    }

    return null;
  }

  // Validate Pterodactyl ID
  static validatePterodactylId(id: any): ValidationError | null {
    if (id === undefined || id === null) {
      return { field: 'id', message: 'Pterodactyl ID is required' };
    }
    
    if (!Number.isInteger(id) || id <= 0) {
      return { field: 'id', message: 'Pterodactyl ID must be a positive integer' };
    }
    
    return null;
  }

  // Validate Pterodactyl UUID
  static validatePterodactylUuid(uuid: string): ValidationError | null {
    if (!uuid) {
      return { field: 'pterodactyl_uuid', message: 'Pterodactyl UUID is required' };
    }
    
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return { field: 'pterodactyl_uuid', message: 'Invalid Pterodactyl UUID format' };
    }
    
    return null;
  }

  // Validate referral code
  static validateReferralCode(code: string): ValidationError | null {
    if (!code) {
      return null; // Referral code is optional
    }
    
    if (code.length < 6 || code.length > 20) {
      return { field: 'referral_code', message: 'Referral code must be between 6 and 20 characters' };
    }
    
    // Allow alphanumeric and hyphens
    const codeRegex = /^[A-Z0-9-]+$/;
    if (!codeRegex.test(code)) {
      return { field: 'referral_code', message: 'Referral code can only contain uppercase letters, numbers, and hyphens' };
    }
    
    return null;
  }

  // Comprehensive user data validation
  static validateUserData(userData: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Required field validations
    const emailError = this.validateEmail(userData.email);
    if (emailError) errors.push(emailError);
    
    const usernameError = this.validateUsername(userData.username);
    if (usernameError) errors.push(usernameError);
    
    const firstNameError = this.validateName(userData.first_name, 'first_name');
    if (firstNameError) errors.push(firstNameError);
    
    const lastNameError = this.validateName(userData.last_name, 'last_name');
    if (lastNameError) errors.push(lastNameError);
    
    const idError = this.validatePterodactylId(userData.id);
    if (idError) errors.push(idError);
    
    const uuidError = this.validatePterodactylUuid(userData.pterodactyl_uuid);
    if (uuidError) errors.push(uuidError);
    
    // Optional field validations
    if (userData.password) {
      const passwordError = this.validatePassword(userData.password);
      if (passwordError) errors.push(passwordError);
    }
    
    const displayNameError = this.validateDisplayName(userData.display_name);
    if (displayNameError) errors.push(displayNameError);
    
    const roleError = this.validateRole(userData.role);
    if (roleError) errors.push(roleError);
    
    const themeError = this.validateTheme(userData.theme);
    if (themeError) errors.push(themeError);
    
    const languageError = this.validateLanguage(userData.language);
    if (languageError) errors.push(languageError);
    
    const bioError = this.validateBio(userData.bio);
    if (bioError) errors.push(bioError);
    
    const websiteError = this.validateUrl(userData.website, 'website');
    if (websiteError) errors.push(websiteError);
    
    const avatarError = this.validateUrl(userData.avatar_url, 'avatar_url');
    if (avatarError) errors.push(avatarError);
    
    const timezoneError = this.validateTimezone(userData.timezone);
    if (timezoneError) errors.push(timezoneError);
    
    const referralError = this.validateReferralCode(userData.referral_code);
    if (referralError) errors.push(referralError);
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export validation utilities
export const validateUser = UserValidation.validateUserData;
export const validateEmail = UserValidation.validateEmail;
export const validateUsername = UserValidation.validateUsername;
export const validatePassword = UserValidation.validatePassword;
