import { useEffect, useState, useCallback } from "react";
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
import { LobbyExpiryTimer } from "../components/LobbyExpiryTimer";
import type { Match } from "../types";

export function MatchesPage() {
  const { user } = useAuthStore();
  const { deleteMatch } = useMatchStore();
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

  const handleLobbyExpire = useCallback(
    (matchId: string) => {
      deleteMatch(matchId);
    },
    [deleteMatch]
  );

  const MatchCard = ({ match }: { match: Match }) => {
    const isRed = match.redTeam.attacker === user.uid || match.redTeam.defender === user.uid;
    const userTeam = isRed ? "red" : "blue";
    const eloChange = match.eloChanges?.[user.uid];
    const won = isRed
      ? match.redTeam.score > match.blueTeam.score
      : match.blueTeam.score > match.redTeam.score;

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
          {match.status === "lobby" && (
            <LobbyExpiryTimer
              lastActivityAt={match.lastActivityAt}
              onExpire={() => handleLobbyExpire(match.id)}
            />
          )}
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
