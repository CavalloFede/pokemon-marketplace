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
const Evolution = lazy(() => import('./pages/Evolution'));
const WantListings = lazy(() => import('./pages/WantListings'));
const WantListingDetail = lazy(() => import('./pages/WantListingDetail'));
const MyWantListings = lazy(() => import('./pages/MyWantListings'));
const Login = lazy(() => import('./pages/Login'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Trainers = lazy(() => import('./pages/Trainers'));

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
          <Route path="evolution" element={<Evolution />} />
          <Route path="want-listings" element={<WantListings />} />
          <Route path="want-listings/:id" element={<WantListingDetail />} />
          <Route path="my-listings" element={<MyWantListings />} />
          <Route path="user/:userId" element={<UserProfile />} />
          <Route path="trainers" element={<Trainers />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
