import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileBottomNav from './MobileBottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area — offset for collapsed sidebar on desktop */}
      <div className="md:ml-16">
        <TopBar />
        <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
