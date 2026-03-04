import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSeasonStore } from "../stores/seasonStore";
import type { Season, Match } from "../types";

type Tab = "leaderboard" | "matches";

export function SeasonDetailPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { fetchSeasonById } = useSeasonStore();
  const [season, setSeason] = useState<Season | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("leaderboard");
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!seasonId) return;
    setLoading(true);
    fetchSeasonById(seasonId).then((s) => {
      setSeason(s);
      setLoading(false);
    });
  }, [seasonId, fetchSeasonById]);

  // Fetch matches lazily when the Matches tab is first opened
  useEffect(() => {
    if (activeTab !== "matches" || !seasonId || matches.length > 0) return;
    setMatchesLoading(true);
    const q = query(
      collection(db, "matches"),
      where("seasonId", "==", seasonId),
      where("status", "==", "completed"),
      orderBy("endedAt", "desc"),
      limit(10)
    );
    getDocs(q).then((snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === 10);
      setMatchesLoading(false);
    });
  }, [activeTab, seasonId, matches.length]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore || !seasonId) return;
    setLoadingMore(true);
    const q = query(
      collection(db, "matches"),
      where("seasonId", "==", seasonId),
      where("status", "==", "completed"),
      orderBy("endedAt", "desc"),
      startAfter(lastDoc),
      limit(10)
    );
    const snap = await getDocs(q);
    setMatches((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match)]);
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === 10);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading season...</div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">Season not found.</div>
        <Link to="/seasons" className="text-blue-400 hover:underline">
          Back to Seasons
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/seasons" className="text-sm text-gray-400 hover:text-white mb-1 block">
          ← Seasons
        </Link>
        <h1 className="text-2xl font-bold">{season.label}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(["leaderboard", "matches"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab */}
      {activeTab === "leaderboard" && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {season.leaderboard.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              No players participated this season.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Rank</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Player</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Elo</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 hidden sm:table-cell">W/L</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 hidden sm:table-cell">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {season.leaderboard.map((player, index) => {
                  const winRate =
                    player.matchesPlayed > 0
                      ? Math.round((player.wins / player.matchesPlayed) * 100)
                      : 0;
                  return (
                    <tr key={player.uid} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span
                          className={
                            index === 0
                              ? "text-yellow-400 font-medium"
                              : index === 1
                              ? "text-gray-300 font-medium"
                              : index === 2
                              ? "text-amber-600 font-medium"
                              : "text-gray-400"
                          }
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {player.username.charAt(0).toUpperCase()}
                          </div>
                          {player.username}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-blue-400">
                        {player.elo}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-green-400">{player.wins}</span>
                        <span className="text-gray-500">/</span>
                        <span className="text-red-400">{player.losses}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-300">
                        {winRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Matches Tab */}
      {activeTab === "matches" && (
        <div>
          {matchesLoading ? (
            <div className="flex justify-center py-12">
              <div className="text-gray-400">Loading matches...</div>
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
              No matches recorded for this season.
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => (
                <Link
                  key={match.id}
                  to={`/match/${match.id}/result`}
                  className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-red-400 text-xs mb-1">Red</div>
                      <div className="text-2xl font-bold">{match.redTeam.score}</div>
                    </div>
                    <div className="text-gray-500 text-sm">vs</div>
                    <div className="text-center">
                      <div className="text-blue-400 text-xs mb-1">Blue</div>
                      <div className="text-2xl font-bold">{match.blueTeam.score}</div>
                    </div>
                  </div>
                </Link>
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more matches"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
