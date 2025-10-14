/**
 * Authentication Service for YBUILT
 * 
 * Provides client-side authentication with backend API integration.
 * Stores JWT tokens in localStorage and handles user authentication flow.
 */

const AUTH_TOKEN_KEY = 'ybuilt_auth_token';

export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

class AuthService {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Sign in failed'
        };
      }

      // Store the real JWT token from backend
      if (data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed'
      };
    }
  }

  /**
   * Create a new account
   */
  async createAccount(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Account creation failed'
        };
      }

      // Store the real JWT token from backend
      if (data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user
      };
    } catch (error) {
      console.error('Account creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account creation failed'
      };
    }
  }

  /**
   * Sign out
   */
  signOut(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  /**
   * Get current session token
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Get current user data
   * Note: This requires a /api/me endpoint on the backend
   */
  async getCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/me', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        // Token invalid or expired, clear it
        if (response.status === 401) {
          this.signOut();
        }
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Get authentication headers for API requests
   * Use this to add Authorization header to authenticated requests
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (!token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Make an authenticated API request
   * Automatically handles 401 responses by clearing token
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      ...options.headers,
      ...this.getAuthHeaders()
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle token expiration
    if (response.status === 401) {
      this.signOut();
      // Dispatch event to notify app of unauthorized access
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return response;
  }

  /**
   * Decode JWT token to get user info without API call
   * Note: This doesn't validate the token, just decodes the payload
   */
  decodeToken(token?: string): { sub: number; email: string } | null {
    try {
      const tokenToUse = token || this.getToken();
      if (!tokenToUse) return null;

      const parts = tokenToUse.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return {
        sub: payload.sub,
        email: payload.email
      };
    } catch {
      return null;
    }
  }

  /**
   * Get user from token without API call
   * Useful for quick user info display
   */
  getUserFromToken(): User | null {
    const decoded = this.decodeToken();
    if (!decoded) return null;

    return {
      id: decoded.sub,
      email: decoded.email
    };
  }
}

export const mockAuth = new AuthService();

// For backward compatibility, also export as 'auth'
export const auth = mockAuth;

// Export MockUser type alias for backward compatibility
export type MockUser = User;
