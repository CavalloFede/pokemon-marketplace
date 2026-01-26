import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const Collection = lazy(() => import('./pages/Collection'));
const Pokedex = lazy(() => import('./pages/Pokedex'));
const Profile = lazy(() => import('./pages/Profile'));
const Trades = lazy(() => import('./pages/Trades'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./components/auth/AuthCallback'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
    </div>
  );
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  // Check auth on app mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="collection" element={<Collection />} />
          <Route path="pokedex" element={<Pokedex />} />
          <Route path="profile" element={<Profile />} />
          <Route path="trades" element={<Trades />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
