import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
    addGoal,
    swapRoles,
    startTimer,
  } = useMatchStore();

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

  const handleGoal = (team: "red" | "blue") => {
    if (matchId) {
      addGoal(matchId, team);
    }
  };

  const handleSwap = (team: "red" | "blue") => {
    if (matchId) {
      swapRoles(matchId, team);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Timer */}
      <div className="text-center">
        <div className="text-5xl font-mono font-bold">{formatTime(timer)}</div>
        <div className="text-gray-400 text-sm mt-1">Match Time</div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="text-red-400 text-lg font-medium mb-1">Red</div>
          <div className="text-6xl font-bold">{currentMatch.redTeam.score}</div>
        </div>
        <div className="text-2xl text-gray-500">vs</div>
        <div className="text-center">
          <div className="text-blue-400 text-lg font-medium mb-1">Blue</div>
          <div className="text-6xl font-bold">{currentMatch.blueTeam.score}</div>
        </div>
      </div>

      {/* Win condition hint */}
      <div className="text-center text-sm text-gray-400">
        First to 10, win by 2
      </div>

      {/* Goal Buttons */}
      <div className="grid grid-cols-2 gap-4">
        {/* Red Team Goals */}
        <div className="space-y-2">
          <button
            onClick={() => handleGoal("red")}
            className="w-full py-6 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg text-xl font-bold transition-colors"
          >
            + Red Goal
          </button>
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
              Swap Roles
            </button>
          )}
        </div>

        {/* Blue Team Goals */}
        <div className="space-y-2">
          <button
            onClick={() => handleGoal("blue")}
            className="w-full py-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg text-xl font-bold transition-colors"
          >
            + Blue Goal
          </button>
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
              Swap Roles
            </button>
          )}
        </div>
      </div>

      {/* Match Events */}
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
