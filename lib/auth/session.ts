/**
 * CythroDash - Session Management Utilities
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

/**
 * Get session token from cookies (client-side)
 */
export function getSessionTokenFromCookies(): string | null {
  if (typeof window === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const sessionCookie = cookies.find(cookie => 
    cookie.trim().startsWith('session_token=')
  )
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1]
  }
  
  return null
}

/**
 * Check if user has a valid session token in cookies
 */
export function hasSessionToken(): boolean {
  return getSessionTokenFromCookies() !== null
}

/**
 * Clear session token from cookies (client-side)
 */
export function clearSessionToken(): void {
  if (typeof window === 'undefined') return
  
  document.cookie = 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
}

/**
 * Simple session validation without API calls
 * This checks if we have the basic requirements for a valid session
 */
export function isSessionValid(sessionToken: string | null, currentUser: any): boolean {
  return !!(sessionToken && currentUser && currentUser.id)
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: any): string {
  if (!user) return 'Unknown User'
  
  if (user.display_name) return user.display_name
  if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`
  if (user.username) return user.username
  if (user.email) return user.email
  
  return 'Unknown User'
}

/**
 * Get user role text
 */
export function getUserRoleText(role: number): string {
  switch (role) {
    case 0:
      return 'Administrator'
    case 1:
      return 'User'
    default:
      return 'Unknown'
  }
}

/**
 * Check if user is admin
 */
export function isUserAdmin(user: any): boolean {
  return user && user.role === 0
}

/**
 * Validate session data structure
 */
export function validateSessionData(data: any): boolean {
  return !!(
    data &&
    typeof data.id === 'number' &&
    typeof data.username === 'string' &&
    typeof data.email === 'string' &&
    typeof data.role === 'number'
  )
}
