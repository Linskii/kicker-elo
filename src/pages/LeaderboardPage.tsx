import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { User } from "../types";
import { useAuthStore } from "../stores/authStore";

export function LeaderboardPage() {
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const q = query(
        collection(db, "users"),
        orderBy("elo", "desc"),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(
        (doc) => ({ uid: doc.id, ...doc.data() }) as User
      );
      setPlayers(users);
      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                Player
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                Elo
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 hidden sm:table-cell">
                W/L
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 hidden sm:table-cell">
                Win Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {players.map((player, index) => {
              const winRate =
                player.matchesPlayed > 0
                  ? Math.round((player.wins / player.matchesPlayed) * 100)
                  : 0;
              const isCurrentUser = player.uid === currentUser?.uid;

              return (
                <tr
                  key={player.uid}
                  className={`${isCurrentUser ? "bg-blue-900/30" : ""}`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`${
                        index === 0
                          ? "text-yellow-400"
                          : index === 1
                            ? "text-gray-300"
                            : index === 2
                              ? "text-amber-600"
                              : "text-gray-400"
                      } font-medium`}
                    >
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <span className={isCurrentUser ? "font-semibold" : ""}>
                        {player.username}
                        {isCurrentUser && (
                          <span className="text-xs text-gray-400 ml-2">
                            (you)
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-semibold text-blue-400">
                      {player.elo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-green-400">{player.wins}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-red-400">{player.losses}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-gray-300">{winRate}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {players.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400">
            No players yet. Be the first to play!
          </div>
        )}
      </div>
    </div>
  );
}
