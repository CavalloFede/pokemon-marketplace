import { Link, useLocation } from 'react-router-dom';

interface NavItemProps {
  path: string;
  label: string;
  icon: string;
  collapsed?: boolean;
  onClick?: () => void;
}

export default function NavItem({ path, label, icon, collapsed = false, onClick }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === path;

  return (
    <Link
      to={path}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
        isActive
          ? 'bg-pokemon-electric/10 text-pokemon-electric border-l-2 border-pokemon-electric'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white border-l-2 border-transparent'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
          {label}
        </span>
      )}
    </Link>
  );
}
