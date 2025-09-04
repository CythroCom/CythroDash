/**
 * CythroDash - Security Configuration
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

export const SECURITY_CONFIG = {
  // Rate limiting
  RATE_LIMIT: {
    LOGIN: {
      MAX_ATTEMPTS: 5,
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      LOCKOUT_DURATION: 15 * 60 * 1000 // 15 minutes
    },
    REGISTER: {
      MAX_ATTEMPTS: 3,
      WINDOW_MS: 60 * 60 * 1000, // 1 hour
      LOCKOUT_DURATION: 60 * 60 * 1000 // 1 hour
    },
    API: {
      MAX_REQUESTS: 100,
      WINDOW_MS: 15 * 60 * 1000 // 15 minutes
    }
  },

  // Session configuration
  SESSION: {
    DEFAULT_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    REMEMBER_ME_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
    REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
    CLEANUP_INTERVAL: 60 * 60 * 1000 // 1 hour
  },

  // Cookie configuration
  COOKIES: {
    SECURE: process.env.NODE_ENV === 'production',
    SAME_SITE: 'strict' as const,
    HTTP_ONLY: true,
    PATH: '/'
  },

  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: false
  },

  // CSRF protection
  CSRF: {
    ENABLED: true,
    SECRET_LENGTH: 32,
    TOKEN_LENGTH: 32
  },

  // Security headers
  HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
}

/**
 * Get cookie options for session management
 */
export function getSessionCookieOptions(rememberMe: boolean = false) {
  return {
    httpOnly: SECURITY_CONFIG.COOKIES.HTTP_ONLY,
    secure: SECURITY_CONFIG.COOKIES.SECURE,
    sameSite: SECURITY_CONFIG.COOKIES.SAME_SITE,
    path: SECURITY_CONFIG.COOKIES.PATH,
    maxAge: rememberMe 
      ? SECURITY_CONFIG.SESSION.REMEMBER_ME_EXPIRY 
      : SECURITY_CONFIG.SESSION.DEFAULT_EXPIRY
  }
}

/**
 * Get refresh token cookie options
 */
export function getRefreshTokenCookieOptions() {
  return {
    httpOnly: SECURITY_CONFIG.COOKIES.HTTP_ONLY,
    secure: SECURITY_CONFIG.COOKIES.SECURE,
    sameSite: SECURITY_CONFIG.COOKIES.SAME_SITE,
    path: SECURITY_CONFIG.COOKIES.PATH,
    maxAge: SECURITY_CONFIG.SESSION.REFRESH_TOKEN_EXPIRY
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = []
  const config = SECURITY_CONFIG.PASSWORD

  if (password.length < config.MIN_LENGTH) {
    errors.push(`Password must be at least ${config.MIN_LENGTH} characters long`)
  }

  if (password.length > config.MAX_LENGTH) {
    errors.push(`Password must be at most ${config.MAX_LENGTH} characters long`)
  }

  if (config.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (config.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (config.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (config.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Generate secure random string
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return result
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000) // Limit length
}

/**
 * Check if IP is in allowed range (for future IP whitelisting)
 */
export function isIPAllowed(ip: string): boolean {
  // For now, allow all IPs
  // In production, you might want to implement IP whitelisting
  return true
}

/**
 * Get client IP from request
 */
export function getClientIP(request: any): string {
  return request.ip || 
         request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown'
}
