import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import {
  signInWithGoogle,
  signOut as firebaseSignOut,
  getIdToken,
  onAuthChange,
  setMockLoggedIn,
  IS_MOCK_MODE
} from '../services/firebase';

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
  login: () => Promise<void>;
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

      login: async () => {
        set({ isLoading: true, error: null });
        try {
          // Sign in with Google via Firebase popup
          const result = await signInWithGoogle();

          if (!result) {
            throw new Error('Sign in cancelled');
          }

          // Set mock state if in mock mode
          if (IS_MOCK_MODE) {
            setMockLoggedIn(true);
          }

          // Send ID token to backend to authenticate and get user data
          const authResult = await api.authenticate(result.idToken);

          // Set user in store
          set({
            user: authResult.user,
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
          // Sign out from Firebase
          await firebaseSignOut();

          // Clear mock state if in mock mode
          if (IS_MOCK_MODE) {
            setMockLoggedIn(false);
          }

          // Notify backend
          await api.logout();
        } catch {
          // Ignore logout errors
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });

        try {
          // Get current Firebase ID token
          const idToken = await getIdToken();

          if (!idToken) {
            set({ isLoading: false, isAuthenticated: false, user: null });
            return;
          }

          // Verify with backend and get user data
          const userData = await api.getCurrentUser(idToken);

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
          // Token invalid or user not found
          if (IS_MOCK_MODE) {
            setMockLoggedIn(false);
          }
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

// Subscribe to Firebase auth state changes
onAuthChange((firebaseUser) => {
  const store = useAuthStore.getState();

  if (!firebaseUser && store.isAuthenticated) {
    // User signed out from Firebase
    store.logout();
  }
});

// Set up unauthorized handler for API
api.setOnUnauthorized(() => {
  useAuthStore.getState().logout();
});
