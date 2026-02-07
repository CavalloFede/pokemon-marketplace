import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/shop', label: 'Shop', icon: '🛒' },
  { path: '/collection', label: 'Collection', icon: '📦' },
  { path: '/evolution', label: 'Evolution', icon: '✨' },
  { path: '/pokedex', label: 'Pokedex', icon: '📱' },
  { path: '/want-listings', label: 'Listings', icon: '📋' },
  { path: '/trades', label: 'Trades', icon: '🔄' },
  { path: '/trainers', label: 'Trainers', icon: '👥' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <span className="font-bold text-xl text-pokemon-electric hidden sm:inline">
                Pokemon Marketplace
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-pokemon-electric text-gray-900'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User Info */}
            <div className="flex items-center gap-4">
              {/* Coin Balance */}
              <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-full">
                <span className="text-pokemon-electric">🪙</span>
                <span className="font-bold">{user?.coins ?? 0}</span>
              </div>

              {/* User Menu */}
              <div className="relative group">
                <button className="flex items-center gap-2 hover:bg-gray-700 rounded-lg p-2 transition-colors">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-pokemon-electric rounded-full flex items-center justify-center text-gray-900 font-bold">
                      {user?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="hidden lg:inline text-sm">
                    {user?.displayName}
                  </span>
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="p-3 border-b border-gray-700">
                    <p className="font-bold truncate">{user?.displayName}</p>
                    <p className="text-sm text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/profile"
                      className="block px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors text-red-400"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 safe-area-pb">
        <div className="flex justify-around py-2">
          {navItems.slice(0, 6).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-1 ${
                location.pathname === item.path
                  ? 'text-pokemon-electric'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
