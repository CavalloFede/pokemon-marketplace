import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const primaryItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/shop', label: 'Shop', icon: '🛒' },
  { path: '/collection', label: 'Collection', icon: '📦' },
  { path: '/want-listings', label: 'Listings', icon: '📋' },
];

const moreItems = [
  { path: '/evolution', label: 'Evolution', icon: '✨' },
  { path: '/pokedex', label: 'Pokedex', icon: '📱' },
  { path: '/trades', label: 'Trades', icon: '🔄' },
  { path: '/trainers', label: 'Trainers', icon: '👥' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export default function MobileBottomNav() {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const isMoreActive = moreItems.some((item) => location.pathname === item.path);

  const handleLogout = async () => {
    setShowMore(false);
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Backdrop */}
      {showMore && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More Sheet */}
      {showMore && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
          <div className="bg-gray-800 border-t border-gray-700 rounded-t-2xl px-4 pt-3 pb-2">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />

            <div className="grid grid-cols-3 gap-2 mb-2">
              {moreItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                    location.pathname === item.path
                      ? 'bg-pokemon-electric/10 text-pokemon-electric'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex flex-col items-center gap-1 p-3 rounded-xl text-red-400 hover:bg-gray-700 transition-colors"
              >
                <span className="text-xl">🚪</span>
                <span className="text-xs">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-30 safe-area-pb">
        <div className="flex justify-around py-2">
          {primaryItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-1 min-w-0 ${
                location.pathname === item.path
                  ? 'text-pokemon-electric'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center p-1 min-w-0 ${
              isMoreActive || showMore ? 'text-pokemon-electric' : 'text-gray-400'
            }`}
          >
            <span className="text-lg">•••</span>
            <span className="text-[10px] mt-0.5">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
