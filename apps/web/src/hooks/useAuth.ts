import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    setCoins,
    clearError
  } = useAuthStore();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const initiateLogin = async () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const { loginUrl } = await api.getLoginUrl(redirectUri);
    window.location.href = loginUrl;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    initiateLogin,
    setCoins,
    clearError
  };
}

/**
 * Hook for handling OAuth callback
 */
export function useAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const errorParam = params.get('error');

      if (errorParam) {
        navigate('/login?error=' + encodeURIComponent(errorParam));
        return;
      }

      if (!code) {
        navigate('/login');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        await login(code, redirectUri);
        navigate('/');
      } catch {
        navigate('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [location.search, login, navigate]);

  return { isLoading, error };
}

/**
 * Hook that redirects to login if not authenticated
 */
export function useRequireAuth() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return { isAuthenticated, isLoading };
}
