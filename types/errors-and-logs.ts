/**
 * Standardized Error and Logging Types for CythroDash
 *
 * Centralizes error categories, structures, and log classifications
 * used across API responses, controllers, and dashboards.
 */

// Error categories/types
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  RATE_LIMIT = 'rate_limit',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  NETWORK = 'network',
  SERVER = 'server',
  INTEGRATION = 'integration',
  UNKNOWN = 'unknown',
}

// Standardized error payload
export interface StandardErrorItem {
  // Optional machine-readable code (e.g., INVALID_PASSWORD)
  code?: string
  // High-level type/category
  type?: ErrorType
  // Affected field for validation errors
  field?: string
  // Human-readable message
  message: string
  // Structured details for debugging
  details?: Record<string, any>
}

// Canonical API error response shape
export interface ApiErrorResponse {
  success: false
  message: string
  errors?: StandardErrorItem[]
}

// Canonical API success response (extension point)
export interface ApiSuccessResponse<T = any> {
  success: true
  message?: string
  data?: T
}

// Log classification (high-level buckets across the app)
export enum LogCategory {
  // Account/Security: login, logout, password changes, profile updates, 2FA, bans, etc.
  ACCOUNT = 'account',
  SECURITY = 'security',
  // Earnings/Rewards: accrual, redemptions, referral earnings, tasks, payouts
  EARNING = 'earning',
  // Admin actions: privilege escalations, policy changes, settings updates
  ADMIN = 'admin',
  // API/Platform wide issues
  SYSTEM = 'system',
}

// Security log severity (mirrors existing DB enum for UI reuse)
export enum LogSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Utility: normalize any unknown error into a StandardErrorItem
export function toStandardErrorItem(err: any, fallbackType: ErrorType = ErrorType.UNKNOWN): StandardErrorItem {
  if (!err) return { type: fallbackType, message: 'Unknown error' }

  if (typeof err === 'string') return { type: fallbackType, message: err }

  if (err?.message && typeof err.message === 'string') {
    const item: StandardErrorItem = { message: err.message }
    if (err.code && typeof err.code === 'string') item.code = err.code
    if (err.type && typeof err.type === 'string') item.type = err.type as ErrorType
    if (err.field && typeof err.field === 'string') item.field = err.field
    if (err.details && typeof err.details === 'object') item.details = err.details
    return item
  }

  try {
    return { type: fallbackType, message: JSON.stringify(err) }
  } catch {
    return { type: fallbackType, message: 'Unserializable error' }
  }
}

// Utility: array-normalize errors into messages for display
export function extractErrorMessage(errors?: Array<StandardErrorItem | string> | null, fallback?: string): string {
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((e) => (typeof e === 'string' ? e : e?.message || ''))
      .filter(Boolean)
      .join(', ')
  }
  return fallback || 'An error occurred'
}

