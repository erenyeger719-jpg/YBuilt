/**
 * Mock Authentication Service for YBUILT
 * 
 * Provides client-side authentication simulation when MOCK_MODE is active.
 * Stores session tokens in localStorage and communicates with server for user data.
 */

const MOCK_TOKEN_KEY = 'ybuilt_session';
const MOCK_MODE = true; // In production, this would check env var

export interface MockUser {
  id: string;
  email: string;
  username: string;
  credits: number;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: MockUser;
  error?: string;
}

class MockAuthService {
  /**
   * Sign in with email and password (mock implementation)
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    if (!MOCK_MODE) {
      return { success: false, error: 'Auth service not available' };
    }

    // In mock mode, any email/password combination works
    // Generate a mock JWT-like token
    const mockToken = this.generateMockToken(email);
    
    // Store in localStorage
    localStorage.setItem(MOCK_TOKEN_KEY, mockToken);

    // Create/get user from server
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Sign in failed');
      }

      const data = await response.json();
      return {
        success: true,
        token: mockToken,
        user: data.user
      };
    } catch (error) {
      localStorage.removeItem(MOCK_TOKEN_KEY);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed'
      };
    }
  }

  /**
   * Create a new account (mock implementation)
   */
  async createAccount(email: string, password: string): Promise<AuthResponse> {
    if (!MOCK_MODE) {
      return { success: false, error: 'Auth service not available' };
    }

    // In mock mode, account creation always succeeds
    const mockToken = this.generateMockToken(email);
    localStorage.setItem(MOCK_TOKEN_KEY, mockToken);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Account creation failed');
      }

      const data = await response.json();
      return {
        success: true,
        token: mockToken,
        user: data.user
      };
    } catch (error) {
      localStorage.removeItem(MOCK_TOKEN_KEY);
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
    localStorage.removeItem(MOCK_TOKEN_KEY);
  }

  /**
   * Get current session token
   */
  getToken(): string | null {
    return localStorage.getItem(MOCK_TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Get current user data
   */
  async getCurrentUser(): Promise<MockUser | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Token invalid, clear it
        this.signOut();
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
   * Generate a mock JWT-like token
   */
  private generateMockToken(email: string): string {
    const header = btoa(JSON.stringify({ alg: 'MOCK', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ 
      email, 
      iat: Date.now(),
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    }));
    const signature = btoa(`mock_signature_${email}_${Date.now()}`);
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Validate and decode a mock token
   */
  validateToken(token: string): { email: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp && payload.exp < Date.now()) {
        return null;
      }

      return { email: payload.email };
    } catch {
      return null;
    }
  }
}

export const mockAuth = new MockAuthService();
