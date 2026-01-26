import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const Collection = lazy(() => import('./pages/Collection'));
const Pokedex = lazy(() => import('./pages/Pokedex'));
const Profile = lazy(() => import('./pages/Profile'));
const Trades = lazy(() => import('./pages/Trades'));
const Login = lazy(() => import('./pages/Login'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pokemon-electric"></div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
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
