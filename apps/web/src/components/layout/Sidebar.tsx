import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const navGroups = [
  {
    label: 'Main',
    items: [
      { path: '/', label: 'Home', icon: '🏠' },
      { path: '/shop', label: 'Shop', icon: '🛒' },
    ],
  },
  {
    label: 'My Pokemon',
    items: [
      { path: '/collection', label: 'Collection', icon: '📦' },
      { path: '/evolution', label: 'Evolution', icon: '✨' },
      { path: '/pokedex', label: 'Pokedex', icon: '📱' },
    ],
  },
  {
    label: 'Trading',
    items: [
      { path: '/want-listings', label: 'Listings', icon: '📋' },
      { path: '/trades', label: 'Trades', icon: '🔄' },
      { path: '/trainers', label: 'Trainers', icon: '👥' },
    ],
  },
];

const labelClasses = (expanded: boolean) =>
  `text-sm font-medium truncate transition-[opacity] duration-300 ${
    expanded ? 'opacity-100 delay-75' : 'opacity-0'
  }`;

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`hidden md:flex flex-col fixed left-0 top-0 h-full border-r border-gray-700 z-40 overflow-hidden transition-[width] duration-300 ease-in-out ${
        expanded ? 'w-56' : 'w-16'
      }`}
      style={{ backgroundColor: '#1a1d23' }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 px-4 h-14 border-b border-gray-700 flex-shrink-0 overflow-hidden">
        <span className="text-2xl flex-shrink-0">🎮</span>
        <span className={`font-bold text-pokemon-electric whitespace-nowrap transition-opacity duration-300 ${expanded ? 'opacity-100 delay-75' : 'opacity-0'}`}>
          Pokemon MP
        </span>
      </Link>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        {navGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="border-t border-gray-700 my-2 mx-2" />}
            <p className={`text-[10px] uppercase text-gray-500 font-semibold px-3 mb-1 tracking-wider whitespace-nowrap transition-opacity duration-300 ${expanded ? 'opacity-100 delay-75' : 'opacity-0 h-0 mb-0 overflow-hidden'}`}>
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center gap-3 rounded-lg transition-colors duration-150 my-0.5 overflow-hidden ${
                    expanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
                  } ${
                    isActive
                      ? 'bg-pokemon-electric/10 text-pokemon-electric border-l-2 border-pokemon-electric'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <span className={labelClasses(expanded)}>{item.label}</span>
                  {!expanded && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 whitespace-nowrap z-50 pointer-events-none">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: Profile + Logout */}
      <div className="border-t border-gray-700 px-2 py-2 flex-shrink-0">
        <Link
          to="/profile"
          className={`group relative flex items-center gap-3 rounded-lg transition-colors duration-150 my-0.5 overflow-hidden ${
            expanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
          } ${
            location.pathname === '/profile'
              ? 'bg-pokemon-electric/10 text-pokemon-electric border-l-2 border-pokemon-electric'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'
          }`}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-6 h-6 bg-pokemon-electric rounded-full flex items-center justify-center text-gray-900 text-xs font-bold flex-shrink-0">
              {user?.displayName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <span className={labelClasses(expanded)}>{user?.displayName || 'Profile'}</span>
          {!expanded && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 whitespace-nowrap z-50 pointer-events-none">
              Profile
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className={`group relative flex items-center gap-3 rounded-lg transition-colors duration-150 my-0.5 w-full text-red-400 hover:bg-gray-800 border-l-2 border-transparent overflow-hidden ${
            expanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'
          }`}
        >
          <span className="text-lg flex-shrink-0">🚪</span>
          <span className={labelClasses(expanded)}>Logout</span>
          {!expanded && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 whitespace-nowrap z-50 pointer-events-none">
              Logout
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
