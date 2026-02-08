import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function TopBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30 h-14">
      <div className="flex items-center justify-between h-full px-4">
        {/* Mobile logo */}
        <Link to="/" className="flex items-center gap-2 md:hidden">
          <span className="text-2xl">🎮</span>
          <span className="font-bold text-pokemon-electric">Pokemon MP</span>
        </Link>

        {/* Spacer for desktop (logo is in sidebar) */}
        <div className="hidden md:block" />

        {/* Right side: coins + user */}
        <div className="flex items-center gap-3">
          {/* Coin Balance */}
          <div className="flex items-center gap-2 bg-gray-700 px-3 py-1.5 rounded-full">
            <span className="text-pokemon-electric">🪙</span>
            <span className="font-bold text-sm">{user?.coins ?? 0}</span>
          </div>

          {/* User Menu */}
          <div className="relative group">
            <button className="flex items-center gap-2 hover:bg-gray-700 rounded-lg p-1.5 transition-colors">
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
              <span className="hidden lg:inline text-sm text-gray-300">
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
    </header>
  );
}
