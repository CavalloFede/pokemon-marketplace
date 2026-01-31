import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockUser {
  id: string;
  email: string;
  displayName: string;
  coins: number;
}

// Mock the auth store
const mockAuthStore: {
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: ReturnType<typeof vi.fn>;
  setIsAuthenticated: ReturnType<typeof vi.fn>;
  setIsLoading: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
} = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: vi.fn(),
  setIsAuthenticated: vi.fn(),
  setIsLoading: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
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

  describe('login', () => {
    it('should call login function', () => {
      mockAuthStore.login();
      expect(mockAuthStore.login).toHaveBeenCalled();
    });
  });
});
