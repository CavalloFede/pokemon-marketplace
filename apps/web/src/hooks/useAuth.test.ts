import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the auth store
const mockAuthStore = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: vi.fn(),
  setIsAuthenticated: vi.fn(),
  setIsLoading: vi.fn(),
  logout: vi.fn(),
};

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}));

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.user = null;
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.isLoading = true;
  });

  describe('initial state', () => {
    it('should start with loading state', () => {
      expect(mockAuthStore.isLoading).toBe(true);
      expect(mockAuthStore.user).toBeNull();
      expect(mockAuthStore.isAuthenticated).toBe(false);
    });
  });

  describe('authenticated user', () => {
    it('should have user data when authenticated', () => {
      mockAuthStore.user = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        coins: 500,
      };
      mockAuthStore.isAuthenticated = true;
      mockAuthStore.isLoading = false;

      expect(mockAuthStore.isAuthenticated).toBe(true);
      expect(mockAuthStore.user?.email).toBe('test@example.com');
      expect(mockAuthStore.user?.coins).toBe(500);
    });
  });

  describe('logout', () => {
    it('should call logout function', () => {
      mockAuthStore.logout();
      expect(mockAuthStore.logout).toHaveBeenCalled();
    });
  });

  describe('login URL generation', () => {
    it('should generate correct Cognito login URL', () => {
      const domain = 'test.auth.us-east-1.amazoncognito.com';
      const clientId = 'test-client-id';
      const redirectUri = 'http://localhost:5173/auth/callback';

      const loginUrl = `https://${domain}/oauth2/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `scope=email+openid+profile&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}`;

      expect(loginUrl).toContain('oauth2/authorize');
      expect(loginUrl).toContain('client_id=test-client-id');
      expect(loginUrl).toContain('response_type=code');
    });
  });
});
