/**
 * CythroDash - User Security Logs Database Schema
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

// Security log action types
export enum SecurityLogAction {
  // Authentication actions
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  SESSION_EXPIRED = 'session_expired',
  
  // Password actions
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  PASSWORD_RESET_FAILED = 'password_reset_failed',
  
  // Profile actions
  PROFILE_UPDATED = 'profile_updated',
  EMAIL_CHANGED = 'email_changed',
  USERNAME_CHANGED = 'username_changed',
  
  // Security actions
  TWO_FACTOR_ENABLED = 'two_factor_enabled',
  TWO_FACTOR_DISABLED = 'two_factor_disabled',
  TWO_FACTOR_BACKUP_USED = 'two_factor_backup_used',
  
  // Account actions
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  ACCOUNT_BANNED = 'account_banned',
  ACCOUNT_UNBANNED = 'account_unbanned',
  ACCOUNT_DELETED = 'account_deleted',
  
  // Suspicious activities
  MULTIPLE_FAILED_LOGINS = 'multiple_failed_logins',
  SUSPICIOUS_LOGIN_LOCATION = 'suspicious_login_location',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  
  // API actions
  API_KEY_CREATED = 'api_key_created',
  API_KEY_DELETED = 'api_key_deleted',
  API_RATE_LIMIT_EXCEEDED = 'api_rate_limit_exceeded',
  
  // Admin actions
  ADMIN_ACCESS_GRANTED = 'admin_access_granted',
  ADMIN_ACCESS_REVOKED = 'admin_access_revoked',
  ADMIN_ACTION_PERFORMED = 'admin_action_performed'
}

// Security log severity levels
export enum SecurityLogSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Security log status
export enum SecurityLogStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  IGNORED = 'ignored'
}

// Main security log interface
export interface CythroDashUserLog {
  id: number; // Auto-increment primary key
  user_id: number; // Reference to cythro_dash_users.id
  
  // Log details
  action: SecurityLogAction;
  severity: SecurityLogSeverity;
  status: SecurityLogStatus;
  
  // Event information
  description: string; // Human-readable description
  details?: any; // JSON object with additional details
  
  // Request information
  ip_address?: string; // IP address of the request
  user_agent?: string; // User agent string
  request_id?: string; // Unique request identifier
  
  // Location information
  country?: string; // Country code (e.g., 'US')
  region?: string; // Region/state
  city?: string; // City name
  
  // Device information
  device_type?: string; // 'desktop', 'mobile', 'tablet'
  browser?: string; // Browser name and version
  os?: string; // Operating system
  
  // Security context
  session_id?: string; // Session identifier
  pterodactyl_synced?: boolean; // Whether action was synced to Pterodactyl
  
  // Metadata
  created_at: Date; // When the log was created
  updated_at: Date; // When the log was last updated
  resolved_at?: Date; // When the security issue was resolved
  resolved_by?: number; // Admin user ID who resolved the issue
  
  // Additional flags
  is_suspicious: boolean; // Whether this activity is flagged as suspicious
  requires_attention: boolean; // Whether this log requires admin attention
  notification_sent: boolean; // Whether user was notified about this activity
}

// Interface for creating new security logs
export interface CreateUserLogData {
  user_id: number;
  action: SecurityLogAction;
  severity: SecurityLogSeverity;
  description: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  country?: string;
  region?: string;
  city?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  session_id?: string;
  pterodactyl_synced?: boolean;
  is_suspicious?: boolean;
  requires_attention?: boolean;
}

// Interface for updating security logs
export interface UpdateUserLogData {
  status?: SecurityLogStatus;
  severity?: SecurityLogSeverity;
  details?: any;
  resolved_at?: Date;
  resolved_by?: number;
  requires_attention?: boolean;
  notification_sent?: boolean;
}

// Interface for querying security logs
export interface UserLogQuery {
  user_id?: number;
  action?: SecurityLogAction | SecurityLogAction[];
  severity?: SecurityLogSeverity | SecurityLogSeverity[];
  status?: SecurityLogStatus | SecurityLogStatus[];
  is_suspicious?: boolean;
  requires_attention?: boolean;
  ip_address?: string;
  date_from?: Date;
  date_to?: Date;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'severity' | 'action';
  sort_order?: 'asc' | 'desc';
}

// Security log statistics interface
export interface UserLogStats {
  total_logs: number;
  logs_by_severity: Record<SecurityLogSeverity, number>;
  logs_by_action: Record<SecurityLogAction, number>;
  suspicious_activities: number;
  unresolved_issues: number;
  recent_activity: number; // Last 24 hours
}

// Export the collection name for consistency
export const USER_LOGS_COLLECTION = 'cythro_dash_users_logs';

// Database indexes for optimal performance
export const USER_LOGS_INDEXES = [
  { key: { user_id: 1 }, name: 'user_id_index' },
  { key: { action: 1 }, name: 'action_index' },
  { key: { severity: 1 }, name: 'severity_index' },
  { key: { status: 1 }, name: 'status_index' },
  { key: { created_at: -1 }, name: 'created_at_desc_index' },
  { key: { ip_address: 1 }, name: 'ip_address_index' },
  { key: { is_suspicious: 1 }, name: 'suspicious_index' },
  { key: { requires_attention: 1 }, name: 'attention_index' },
  { key: { user_id: 1, created_at: -1 }, name: 'user_activity_index' },
  { key: { user_id: 1, action: 1 }, name: 'user_action_index' }
];
