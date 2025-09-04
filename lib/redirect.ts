/**
 * CythroDash - Redirect Configuration System
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

"use client"

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

// Redirect configuration interface
export interface RedirectConfig {
  // Authentication redirects
  loginRequired: string;
  loginSuccess: string;
  logoutSuccess: string;
  
  // Role-based redirects
  adminRequired: string;
  userDashboard: string;
  adminDashboard: string;
  
  // Error redirects
  forbidden: string;
  notFound: string;
  serverError: string;
  
  // Feature redirects
  profileComplete: string;
  emailVerify: string;
  passwordReset: string;
  
  // Default fallbacks
  home: string;
  defaultAfterLogin: string;
  defaultAfterLogout: string;
}

// Default redirect configuration
export const DEFAULT_REDIRECT_CONFIG: RedirectConfig = {
  // Authentication
  loginRequired: '/auth/login',
  loginSuccess: '/',
  logoutSuccess: '/auth/login',
  
  // Role-based
  adminRequired: '/auth/login?error=admin_required',
  userDashboard: '/',
  adminDashboard: '/admin',
  
  // Errors
  forbidden: '/auth/login?error=forbidden',
  notFound: '/404',
  serverError: '/500',
  
  // Features
  profileComplete: '/profile',
  emailVerify: '/auth/verify-email',
  passwordReset: '/auth/reset-password',
  
  // Defaults
  home: '/',
  defaultAfterLogin: '/',
  defaultAfterLogout: '/'
};

// Utility functions for URL handling
export class RedirectUtils {
  /**
   * Extract redirect parameter from URL
   */
  static getRedirectParam(url?: string): string | null {
    if (typeof window === 'undefined') return null;
    
    const searchParams = new URLSearchParams(url || window.location.search);
    return searchParams.get('redirect');
  }

  /**
   * Create URL with redirect parameter
   */
  static createRedirectUrl(basePath: string, redirectTo?: string): string {
    if (!redirectTo) return basePath;
    
    const url = new URL(basePath, window.location.origin);
    url.searchParams.set('redirect', redirectTo);
    return url.pathname + url.search;
  }

  /**
   * Validate redirect URL for security
   */
  static isValidRedirect(redirectUrl: string): boolean {
    try {
      // Only allow relative URLs or same-origin URLs
      if (redirectUrl.startsWith('/')) {
        return true;
      }
      
      const url = new URL(redirectUrl, window.location.origin);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize redirect URL
   */
  static sanitizeRedirect(redirectUrl: string): string {
    if (!this.isValidRedirect(redirectUrl)) {
      return DEFAULT_REDIRECT_CONFIG.home;
    }
    
    // Remove any dangerous characters
    return redirectUrl.replace(/[<>'"]/g, '');
  }

  /**
   * Get current page URL for redirect
   */
  static getCurrentPageUrl(): string {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname + window.location.search;
  }
}

// Main redirect manager class
export class RedirectManager {
  private config: RedirectConfig;
  private router: any;

  constructor(config: RedirectConfig = DEFAULT_REDIRECT_CONFIG) {
    this.config = config;
  }

  /**
   * Set router instance
   */
  setRouter(router: any) {
    this.router = router;
  }

  /**
   * Redirect to login with current page as redirect
   */
  redirectToLogin(reason?: 'auth_required' | 'session_expired' | 'admin_required' | 'forbidden') {
    const currentUrl = RedirectUtils.getCurrentPageUrl();
    let loginUrl = this.config.loginRequired;
    
    if (reason) {
      loginUrl += `?error=${reason}`;
    }
    
    if (currentUrl !== '/' && currentUrl !== this.config.loginRequired) {
      const separator = loginUrl.includes('?') ? '&' : '?';
      loginUrl += `${separator}redirect=${encodeURIComponent(currentUrl)}`;
    }
    
    if (this.router) {
      this.router.push(loginUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = loginUrl;
    }
  }

  /**
   * Redirect after successful login
   */
  redirectAfterLogin(userRole: number = 1) {
    const redirectParam = RedirectUtils.getRedirectParam();
    
    let targetUrl: string;
    
    if (redirectParam && RedirectUtils.isValidRedirect(redirectParam)) {
      targetUrl = RedirectUtils.sanitizeRedirect(redirectParam);
    } else {
      // Default to regular dashboard for everyone when no redirect is specified
      targetUrl = this.config.userDashboard;
    }
    
    if (this.router) {
      this.router.push(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetUrl;
    }
  }

  /**
   * Redirect after logout
   */
  redirectAfterLogout() {
    const targetUrl = this.config.home;
    
    if (this.router) {
      this.router.push(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetUrl;
    }
  }

  /**
   * Redirect for admin access required
   */
  redirectAdminRequired() {
    this.redirectToLogin('admin_required');
  }

  /**
   * Redirect for forbidden access
   */
  redirectForbidden() {
    const targetUrl = this.config.forbidden;
    
    if (this.router) {
      this.router.push(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetUrl;
    }
  }

  /**
   * Generic redirect with fallback
   */
  redirect(path: keyof RedirectConfig, fallback?: string) {
    const targetUrl = this.config[path] || fallback || this.config.home;
    
    if (this.router) {
      this.router.push(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetUrl;
    }
  }
}

// React hook for redirect management
export function useRedirect(config?: Partial<RedirectConfig>) {
  const router = useRouter();
  
  const mergedConfig = { ...DEFAULT_REDIRECT_CONFIG, ...config };
  const redirectManager = new RedirectManager(mergedConfig);
  redirectManager.setRouter(router);

  const redirectToLogin = useCallback((reason?: 'auth_required' | 'session_expired' | 'admin_required' | 'forbidden') => {
    redirectManager.redirectToLogin(reason);
  }, [redirectManager]);

  const redirectAfterLogin = useCallback((userRole?: number) => {
    redirectManager.redirectAfterLogin(userRole);
  }, [redirectManager]);

  const redirectAfterLogout = useCallback(() => {
    redirectManager.redirectAfterLogout();
  }, [redirectManager]);

  const redirectAdminRequired = useCallback(() => {
    redirectManager.redirectAdminRequired();
  }, [redirectManager]);

  const redirectForbidden = useCallback(() => {
    redirectManager.redirectForbidden();
  }, [redirectManager]);

  const redirect = useCallback((path: keyof RedirectConfig, fallback?: string) => {
    redirectManager.redirect(path, fallback);
  }, [redirectManager]);

  return {
    // Direct redirect functions
    redirectToLogin,
    redirectAfterLogin,
    redirectAfterLogout,
    redirectAdminRequired,
    redirectForbidden,
    redirect,
    
    // Utility functions
    getRedirectParam: RedirectUtils.getRedirectParam,
    createRedirectUrl: RedirectUtils.createRedirectUrl,
    isValidRedirect: RedirectUtils.isValidRedirect,
    sanitizeRedirect: RedirectUtils.sanitizeRedirect,
    getCurrentPageUrl: RedirectUtils.getCurrentPageUrl,
    
    // Configuration
    config: mergedConfig
  };
}

// Export for direct usage
export const redirectManager = new RedirectManager();
