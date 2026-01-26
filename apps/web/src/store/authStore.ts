import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coins: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setCoins: (coins: number) => void;
  login: (code: string, redirectUri: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setCoins: (coins) => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, coins } });
        }
      },

      login: async (code, redirectUri) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.handleOAuthCallback(code, redirectUri);

          // Store tokens
          api.setTokens(result.tokens.accessToken, result.tokens.refreshToken);

          // Set user
          set({
            user: result.user,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Ignore logout errors
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        // Check if we have a token
        const token = localStorage.getItem('accessToken');
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const userData = await api.getCurrentUser();
          set({
            user: {
              id: userData.id,
              email: userData.email,
              displayName: userData.displayName,
              avatarUrl: userData.avatarUrl,
              coins: userData.coins
            },
            isAuthenticated: true,
            isLoading: false
          });
        } catch {
          // Token invalid, clear it
          api.clearTokens();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user })
    }
  )
);

// Set up unauthorized handler
api.setOnUnauthorized(() => {
  useAuthStore.getState().logout();
});
