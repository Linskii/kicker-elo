import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function HomePage() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user.username}!
        </h1>
        <p className="text-gray-400">Ready for a match?</p>
      </div>

      {/* Stats Card */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Your Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{user.elo}</div>
            <div className="text-sm text-gray-400">Elo Rating</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{user.matchesPlayed}</div>
            <div className="text-sm text-gray-400">Matches</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{user.wins}</div>
            <div className="text-sm text-gray-400">Wins</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{user.losses}</div>
            <div className="text-sm text-gray-400">Losses</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          to="/match/new"
          className="bg-blue-600 hover:bg-blue-700 rounded-lg p-6 text-center transition-colors"
        >
          <div className="text-2xl mb-2">+</div>
          <div className="font-semibold">Create Match</div>
          <div className="text-sm text-blue-200">
            Start a new 1v1, 1v2, or 2v2 game
          </div>
        </Link>

        <Link
          to="/leaderboard"
          className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 text-center transition-colors border border-gray-700"
        >
          <div className="text-2xl mb-2">🏆</div>
          <div className="font-semibold">Leaderboard</div>
          <div className="text-sm text-gray-400">See top players</div>
        </Link>
      </div>
    </div>
  );
}
