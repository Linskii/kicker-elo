import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function isValidScore(red: number, blue: number): boolean {
  return (
    !isNaN(red) &&
    !isNaN(blue) &&
    red >= 0 &&
    blue >= 0 &&
    Math.max(red, blue) >= 10 &&
    Math.abs(red - blue) >= 2
  );
}

export function LiveMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentMatch,
    participants,
    loading,
    timer,
    subscribeToMatch,
    swapRoles,
    startTimer,
    completeMatch,
  } = useMatchStore();

  const [redScore, setRedScore] = useState("");
  const [blueScore, setBlueScore] = useState("");

  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = subscribeToMatch(matchId);
    return () => unsubscribe();
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (currentMatch?.status === "live") {
      startTimer();
    }
  }, [currentMatch?.status, startTimer]);

  useEffect(() => {
    if (currentMatch?.status === "completed" && matchId) {
      navigate(`/match/${matchId}/result`);
    }
  }, [currentMatch?.status, matchId, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading match...</div>
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

  const redAttacker = currentMatch.redTeam.attacker
    ? participants[currentMatch.redTeam.attacker]
    : null;
  const redDefender = currentMatch.redTeam.defender
    ? participants[currentMatch.redTeam.defender]
    : null;
  const blueAttacker = currentMatch.blueTeam.attacker
    ? participants[currentMatch.blueTeam.attacker]
    : null;
  const blueDefender = currentMatch.blueTeam.defender
    ? participants[currentMatch.blueTeam.defender]
    : null;

  const handleSwap = (team: "red" | "blue") => {
    if (matchId) swapRoles(matchId, team);
  };

  const red = parseInt(redScore, 10);
  const blue = parseInt(blueScore, 10);
  const valid = isValidScore(red, blue);
  const showError = (redScore !== "" || blueScore !== "") && !valid;

  const handleSubmit = () => {
    if (matchId && valid) completeMatch(matchId, red, blue);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Timer */}
      <div className="text-center">
        <div className="text-5xl font-mono font-bold">{formatTime(timer)}</div>
        <div className="text-gray-400 text-sm mt-1">Match Time</div>
      </div>

      {/* Score inputs */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="text-red-400 text-lg font-medium mb-2">Red</div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={redScore}
            onChange={(e) => setRedScore(e.target.value.replace(/\D/g, ""))}
            placeholder="—"
            className="w-24 h-20 text-5xl font-bold text-center bg-gray-800 border-2 border-red-500 rounded-xl focus:outline-none focus:border-red-300"
          />
        </div>
        <div className="text-3xl text-gray-500 mt-6">:</div>
        <div className="text-center">
          <div className="text-blue-400 text-lg font-medium mb-2">Blue</div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={blueScore}
            onChange={(e) => setBlueScore(e.target.value.replace(/\D/g, ""))}
            placeholder="—"
            className="w-24 h-20 text-5xl font-bold text-center bg-gray-800 border-2 border-blue-500 rounded-xl focus:outline-none focus:border-blue-300"
          />
        </div>
      </div>

      {/* Hint / validation */}
      <div className="text-center text-sm">
        {showError ? (
          <span className="text-yellow-400">
            Winner needs 10+ goals and a 2-goal lead
          </span>
        ) : (
          <span className="text-gray-400">First to 10, win by 2</span>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!valid}
        className="w-full py-4 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-xl font-bold transition-colors"
      >
        Submit Match
      </button>

      {/* Team info & swap */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {redAttacker && (
            <div className="text-center text-sm text-gray-400">
              ATK: {redAttacker.username}
            </div>
          )}
          {redDefender && (
            <div className="text-center text-sm text-gray-400">
              DEF: {redDefender.username}
            </div>
          )}
          {redAttacker && redDefender && (
            <button
              onClick={() => handleSwap("red")}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Swap Red Roles
            </button>
          )}
        </div>
        <div className="space-y-2">
          {blueAttacker && (
            <div className="text-center text-sm text-gray-400">
              ATK: {blueAttacker.username}
            </div>
          )}
          {blueDefender && (
            <div className="text-center text-sm text-gray-400">
              DEF: {blueDefender.username}
            </div>
          )}
          {blueAttacker && blueDefender && (
            <button
              onClick={() => handleSwap("blue")}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Swap Blue Roles
            </button>
          )}
        </div>
      </div>

      {/* Match Events (swaps only) */}
      {currentMatch.events.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Recent Events
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {[...currentMatch.events].reverse().slice(0, 5).map((event, i) => (
              <div key={i} className="text-sm flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    event.team === "red" ? "bg-red-500" : "bg-blue-500"
                  }`}
                />
                <span className="text-gray-300">
                  {event.type === "goal" ? "Goal" : "Role swap"} -{" "}
                  {event.team?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
