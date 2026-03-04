import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useSeasonStore } from "../stores/seasonStore";

export function SeasonsPage() {
  const { seasons, loading, fetchSeasons } = useSeasonStore();

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading seasons...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Seasons</h1>

      {seasons.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          No completed seasons yet. The first season ends at the last day of the month.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {seasons.map((season) => {
            const top3 = season.leaderboard.slice(0, 3);
            return (
              <Link
                key={season.id}
                to={`/seasons/${season.id}`}
                className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-5 transition-colors border border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">{season.label}</h2>
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    {season.leaderboard.length} players
                  </span>
                </div>

                <div className="space-y-1">
                  {top3.map((player, i) => (
                    <div key={player.uid} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            i === 0
                              ? "text-yellow-400 font-medium"
                              : i === 1
                              ? "text-gray-300 font-medium"
                              : "text-amber-600 font-medium"
                          }
                        >
                          #{i + 1}
                        </span>
                        <span>{player.username}</span>
                      </div>
                      <span className="font-mono text-blue-400">{player.elo}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-gray-500 text-right">
                  View leaderboard →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
