import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";

export function MatchResultPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuthStore();
  const { currentMatch, participants, loading, subscribeToMatch } =
    useMatchStore();

  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = subscribeToMatch(matchId);
    return () => unsubscribe();
  }, [matchId, subscribeToMatch]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading result...</div>
      </div>
    );
  }

  if (!currentMatch || !user) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Match not found</div>
      </div>
    );
  }

  const redWon = currentMatch.redTeam.score > currentMatch.blueTeam.score;
  const isUserRed =
    currentMatch.redTeam.attacker === user.uid ||
    currentMatch.redTeam.defender === user.uid;
  const userWon = isUserRed ? redWon : !redWon;
  const userEloChange = currentMatch.eloChanges?.[user.uid] || 0;

  const getPlayerResult = (uid: string) => {
    const player = participants[uid];
    const eloChange = currentMatch.eloChanges?.[uid] || 0;
    return { player, eloChange };
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Result Header */}
      <div className="text-center">
        <div
          className={`text-4xl font-bold mb-2 ${
            userWon ? "text-green-400" : "text-red-400"
          }`}
        >
          {userWon ? "Victory!" : "Defeat"}
        </div>
        <div
          className={`text-2xl font-mono ${
            userEloChange >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {userEloChange >= 0 ? "+" : ""}
          {userEloChange} Elo
        </div>
      </div>

      {/* Final Score */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-center gap-8">
          <div
            className={`text-center ${redWon ? "opacity-100" : "opacity-60"}`}
          >
            <div className="text-red-400 text-lg font-medium mb-1">
              Red {redWon && "🏆"}
            </div>
            <div className="text-5xl font-bold">
              {currentMatch.redTeam.score}
            </div>
          </div>
          <div className="text-2xl text-gray-500">-</div>
          <div
            className={`text-center ${!redWon ? "opacity-100" : "opacity-60"}`}
          >
            <div className="text-blue-400 text-lg font-medium mb-1">
              {!redWon && "🏆"} Blue
            </div>
            <div className="text-5xl font-bold">
              {currentMatch.blueTeam.score}
            </div>
          </div>
        </div>
      </div>

      {/* Player Results */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Red Team */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold mb-3">Red Team</h3>
          <div className="space-y-3">
            {currentMatch.redTeam.attacker && (
              <PlayerResultRow
                {...getPlayerResult(currentMatch.redTeam.attacker)}
                role="ATK"
              />
            )}
            {currentMatch.redTeam.defender && (
              <PlayerResultRow
                {...getPlayerResult(currentMatch.redTeam.defender)}
                role="DEF"
              />
            )}
          </div>
        </div>

        {/* Blue Team */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-blue-400 font-semibold mb-3">Blue Team</h3>
          <div className="space-y-3">
            {currentMatch.blueTeam.attacker && (
              <PlayerResultRow
                {...getPlayerResult(currentMatch.blueTeam.attacker)}
                role="ATK"
              />
            )}
            {currentMatch.blueTeam.defender && (
              <PlayerResultRow
                {...getPlayerResult(currentMatch.blueTeam.defender)}
                role="DEF"
              />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          to="/matches"
          className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-center font-medium"
        >
          Match History
        </Link>
        <Link
          to="/match/new"
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-center font-medium"
        >
          New Match
        </Link>
      </div>
    </div>
  );
}

function PlayerResultRow({
  player,
  eloChange,
  role,
}: {
  player: { username: string; elo: number } | undefined;
  eloChange: number;
  role: string;
}) {
  if (!player) return null;

  return (
    <div className="flex items-center justify-between bg-gray-700 p-2 rounded">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
          {player.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium">{player.username}</div>
          <div className="text-xs text-gray-400">{role}</div>
        </div>
      </div>
      <div
        className={`font-mono font-semibold ${
          eloChange >= 0 ? "text-green-400" : "text-red-400"
        }`}
      >
        {eloChange >= 0 ? "+" : ""}
        {eloChange}
      </div>
    </div>
  );
}
