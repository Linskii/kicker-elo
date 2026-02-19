import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { User, Match } from "../types";

interface PlayerProfilePopupProps {
  playerUid: string;
  onClose: () => void;
}

export function PlayerProfilePopup({
  playerUid,
  onClose,
}: PlayerProfilePopupProps) {
  const [player, setPlayer] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load player data and match history
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch player data
        const userDoc = await getDoc(doc(db, "users", playerUid));
        if (userDoc.exists()) {
          setPlayer({ uid: userDoc.id, ...userDoc.data() } as User);
        }

        // Fetch player's completed matches using the composite index
        const matchesQuery = query(
          collection(db, "matches"),
          where("participants", "array-contains", playerUid),
          where("status", "==", "completed"),
          orderBy("endedAt", "desc"),
          limit(10)
        );
        const matchesSnapshot = await getDocs(matchesQuery);
        const matchList = matchesSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Match
        );
        setMatches(matchList);
      } catch (error) {
        console.error("Error fetching player data:", error);
      }

      setLoading(false);
    };

    fetchData();
  }, [playerUid]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const winRate =
    player && player.matchesPlayed > 0
      ? Math.round((player.wins / player.matchesPlayed) * 100)
      : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={popupRef}
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Player Profile</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : !player ? (
          <div className="p-8 text-center text-gray-400">Player not found</div>
        ) : (
          <>
            {/* Profile Info */}
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{player.username}</h3>
                  <div className="text-gray-400 text-sm">
                    Member since{" "}
                    {player.createdAt?.toDate().toLocaleDateString() ||
                      "recently"}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {player.elo}
                  </div>
                  <div className="text-xs text-gray-400">Elo</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{player.matchesPlayed}</div>
                  <div className="text-xs text-gray-400">Matches</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {player.wins}
                  </div>
                  <div className="text-xs text-gray-400">Wins</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {player.losses}
                  </div>
                  <div className="text-xs text-gray-400">Losses</div>
                </div>
              </div>

              {/* Win Rate Bar */}
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="font-medium">{winRate}%</span>
                </div>
                <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${winRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Match History */}
            <div className="border-t border-gray-700">
              <div className="p-4 pb-2">
                <h4 className="font-semibold text-sm text-gray-300">
                  Recent Matches
                </h4>
              </div>

              {matches.length === 0 ? (
                <div className="px-4 pb-4 text-gray-400 text-sm">
                  No completed matches yet
                </div>
              ) : (
                <div className="px-4 pb-4 space-y-2">
                  {matches.map((match) => {
                    const isRed =
                      match.redTeam.attacker === playerUid ||
                      match.redTeam.defender === playerUid;
                    const won = isRed
                      ? match.redTeam.score > match.blueTeam.score
                      : match.blueTeam.score > match.redTeam.score;
                    const eloChange = match.eloChanges?.[playerUid];

                    return (
                      <div
                        key={match.id}
                        className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-8 rounded-full ${
                              won ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={`font-mono ${
                                isRed ? "text-red-400 font-semibold" : ""
                              }`}
                            >
                              {match.redTeam.score}
                            </span>
                            <span className="text-gray-500">-</span>
                            <span
                              className={`font-mono ${
                                !isRed ? "text-blue-400 font-semibold" : ""
                              }`}
                            >
                              {match.blueTeam.score}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {eloChange !== undefined && (
                            <span
                              className={`font-mono text-sm font-semibold ${
                                eloChange >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {eloChange >= 0 ? "+" : ""}
                              {eloChange}
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              won
                                ? "bg-green-600/20 text-green-400"
                                : "bg-red-600/20 text-red-400"
                            }`}
                          >
                            {won ? "W" : "L"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
