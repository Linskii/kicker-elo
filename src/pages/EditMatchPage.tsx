import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";

function isValidScore(red: number, blue: number): boolean {
  if (isNaN(red) || isNaN(blue) || red < 0 || blue < 0) return false;
  const max = Math.max(red, blue);
  const diff = Math.abs(red - blue);
  return max >= 10 && diff >= 2 && (max === 10 || diff === 2);
}

export function EditMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentMatch, participants, loading, subscribeToMatch, editCompletedMatch } =
    useMatchStore();

  const [redAttacker, setRedAttacker] = useState<string>("");
  const [redDefender, setRedDefender] = useState<string>("");
  const [blueAttacker, setBlueAttacker] = useState<string>("");
  const [blueDefender, setBlueDefender] = useState<string>("");
  const [redScore, setRedScore] = useState("");
  const [blueScore, setBlueScore] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = subscribeToMatch(matchId);
    return () => unsubscribe();
  }, [matchId, subscribeToMatch]);

  // Initialise form from match data once loaded
  useEffect(() => {
    if (!currentMatch) return;

    // Redirect if outside edit window or not a completed match
    const endedAtMs = currentMatch.endedAt?.toMillis() ?? 0;
    if (currentMatch.status !== "completed" || Date.now() - endedAtMs >= 10 * 60 * 1000) {
      navigate(`/match/${matchId}/result`, { replace: true });
      return;
    }

    setRedAttacker(currentMatch.redTeam.attacker ?? "");
    setRedDefender(currentMatch.redTeam.defender ?? "");
    setBlueAttacker(currentMatch.blueTeam.attacker ?? "");
    setBlueDefender(currentMatch.blueTeam.defender ?? "");
    setRedScore(String(currentMatch.redTeam.score));
    setBlueScore(String(currentMatch.blueTeam.score));
  }, [currentMatch, matchId, navigate]);

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

  const red = parseInt(redScore, 10);
  const blue = parseInt(blueScore, 10);
  const scoreValid = isValidScore(red, blue);
  const showScoreError = (redScore !== "" || blueScore !== "") && !scoreValid;

  // Build options for player selects: "none" + all participants
  const participantOptions = currentMatch.participants.map((uid) => ({
    uid,
    username: participants[uid]?.username ?? uid,
  }));

  const handleSubmit = async () => {
    if (!matchId || !scoreValid) return;
    setSubmitting(true);
    try {
      await editCompletedMatch(
        matchId,
        { attacker: redAttacker || null, defender: redDefender || null },
        { attacker: blueAttacker || null, defender: blueDefender || null },
        red,
        blue
      );
      navigate(`/match/${matchId}/result`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Match Result</h1>
        <p className="text-gray-400 text-sm mt-1">
          Changes are locked 10 minutes after the match ended.
        </p>
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

      <div className="text-center text-sm">
        {showScoreError ? (
          <span className="text-yellow-400">Winner needs 10+ goals and a 2-goal lead</span>
        ) : (
          <span className="text-gray-400">First to 10, win by 2</span>
        )}
      </div>

      {/* Team composition */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="text-red-400 font-semibold">Red Team</h2>
          <PlayerSelect
            label="Attacker"
            value={redAttacker}
            onChange={setRedAttacker}
            options={participantOptions}
          />
          <PlayerSelect
            label="Defender"
            value={redDefender}
            onChange={setRedDefender}
            options={participantOptions}
          />
        </div>
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="text-blue-400 font-semibold">Blue Team</h2>
          <PlayerSelect
            label="Attacker"
            value={blueAttacker}
            onChange={setBlueAttacker}
            options={participantOptions}
          />
          <PlayerSelect
            label="Defender"
            value={blueDefender}
            onChange={setBlueDefender}
            options={participantOptions}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/match/${matchId}/result`)}
          className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!scoreValid || submitting}
          className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function PlayerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { uid: string; username: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
      >
        <option value="">— empty —</option>
        {options.map((p) => (
          <option key={p.uid} value={p.uid}>
            {p.username}
          </option>
        ))}
      </select>
    </div>
  );
}
