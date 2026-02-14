import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/leaderboard", label: "Leaderboard" },
    { path: "/friends", label: "Friends" },
    { path: "/matches", label: "Matches" },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-blue-400">
              Kicker Elo
            </Link>

            {user && (
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        location.pathname === item.path
                          ? "bg-gray-700 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 text-sm"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-medium">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-gray-400">
                        Elo: {user.elo}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={signOut}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile navigation */}
      {user && (
        <nav className="sm:hidden bg-gray-800 border-b border-gray-700">
          <div className="flex justify-around py-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  location.pathname === item.path
                    ? "bg-gray-700 text-white"
                    : "text-gray-300"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
