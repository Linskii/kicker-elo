import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";
import type { Match } from "../types";

export function MatchesPage() {
  const { user } = useAuthStore();
  const { deleteLobby } = useMatchStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "matches"),
      where("participants", "array-contains", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchList = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Match
      );
      setMatches(matchList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  const liveMatches = matches.filter((m) => m.status === "live");
  const lobbyMatches = matches.filter((m) => m.status === "lobby");
  const completedMatches = matches.filter((m) => m.status === "completed");

  const MatchCard = ({ match }: { match: Match }) => {
    const isRed = match.redTeam.attacker === user.uid || match.redTeam.defender === user.uid;
    const userTeam = isRed ? "red" : "blue";
    const eloChange = match.eloChanges?.[user.uid];
    const won = isRed
      ? match.redTeam.score > match.blueTeam.score
      : match.blueTeam.score > match.redTeam.score;
    const canDelete = match.status === "lobby";

    const handleDelete = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      await deleteLobby(match.id);
    };

    return (
      <Link
        to={`/match/${match.id}`}
        className="block bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              match.status === "live"
                ? "bg-green-600"
                : match.status === "lobby"
                  ? "bg-yellow-600"
                  : "bg-gray-600"
            }`}
          >
            {match.status.toUpperCase()}
          </span>
          {match.status === "completed" && eloChange !== undefined && (
            <span
              className={`font-mono font-semibold ${
                eloChange >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {eloChange >= 0 ? "+" : ""}
              {eloChange}
            </span>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete lobby"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          <div
            className={`text-center ${userTeam === "red" ? "font-semibold" : ""}`}
          >
            <div className="text-red-400 text-sm">Red</div>
            <div className="text-2xl font-bold">{match.redTeam.score}</div>
          </div>
          <div className="text-gray-500">vs</div>
          <div
            className={`text-center ${userTeam === "blue" ? "font-semibold" : ""}`}
          >
            <div className="text-blue-400 text-sm">Blue</div>
            <div className="text-2xl font-bold">{match.blueTeam.score}</div>
          </div>
        </div>

        {match.status === "completed" && (
          <div
            className={`text-center mt-2 text-sm ${
              won ? "text-green-400" : "text-red-400"
            }`}
          >
            {won ? "Victory" : "Defeat"}
          </div>
        )}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading matches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <Link
          to="/match/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          New Match
        </Link>
      </div>

      {liveMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-green-400">
            Live Matches
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {lobbyMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-yellow-400">
            In Lobby
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {lobbyMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Match History</h2>
        {completedMatches.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            No completed matches yet. Start playing!
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {completedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
