import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { Inbox } from './Inbox.tsx';

const navItems = [
  { to: '/', label: 'Home', icon: 'H' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'L' },
  { to: '/matches', label: 'Matches', icon: 'M' },
  { to: '/friends', label: 'Friends', icon: 'F' },
  { to: '/profile', label: 'Profile', icon: 'P' },
];

export function Layout(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Desktop top bar */}
      <header className="hidden md:flex items-center justify-between bg-white border-b px-6 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-lg text-blue-600">Kicker ELO</Link>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm font-medium ${location.pathname === item.to ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {item.label}
              </Link>
            ))}
            {user?.isAdmin && (
              <Link to="/admin" className={`text-sm font-medium ${location.pathname === '/admin' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
                Admin
              </Link>
            )}
            <Link to="/seasons" className={`text-sm font-medium ${location.pathname.startsWith('/seasons') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
              Seasons
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-gray-600">{user.username}</span>}
          <Inbox />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-40">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center text-xs ${location.pathname === item.to ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <span className="text-lg font-bold">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
