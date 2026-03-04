import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatchStore } from '../stores/matchStore.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { FieldView } from '../components/FieldView.tsx';
import { isValidFinalScore } from '../utils/elo.ts';

export function LiveMatchPage(): React.ReactElement {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { match, participants, subscribeToMatch, completeMatch } = useMatchStore();
  const [redScore, setRedScore] = useState('');
  const [blueScore, setBlueScore] = useState('');

  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId);
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (match?.status === 'completed') navigate(`/match/${matchId}/result`, { replace: true });
  }, [match?.status, matchId, navigate]);

  if (!match || !user || !matchId) return <div className="p-4">Loading...</div>;

  const redNum = redScore === '' ? 0 : parseInt(redScore, 10);
  const blueNum = blueScore === '' ? 0 : parseInt(blueScore, 10);
  const validScore = !isNaN(redNum) && !isNaN(blueNum) && isValidFinalScore(redNum, blueNum);

  async function handleFinish(): Promise<void> {
    if (!validScore) return;
    await completeMatch(matchId!, redNum, blueNum);
  }

  function handleScoreChange(
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ): void {
    if (value === '') {
      setter('');
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 99) {
      setter(String(num));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-center">Live Match</h1>

      <FieldView match={match} participants={participants} />

      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <label className="text-sm font-medium text-red-600 block mb-2">Red</label>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={redScore}
            onChange={(e) => handleScoreChange(e.target.value, setRedScore)}
            placeholder="0"
            className="w-24 h-20 text-center text-5xl font-bold border-2 border-red-300 rounded-lg focus:border-red-600 focus:outline-none text-red-600"
          />
        </div>
        <div className="text-2xl text-gray-300 mt-6">vs</div>
        <div className="text-center">
          <label className="text-sm font-medium text-blue-600 block mb-2">Blue</label>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={blueScore}
            onChange={(e) => handleScoreChange(e.target.value, setBlueScore)}
            placeholder="0"
            className="w-24 h-20 text-center text-5xl font-bold border-2 border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none text-blue-600"
          />
        </div>
      </div>

      {redScore !== '' && blueScore !== '' && !validScore && (
        <p className="text-center text-sm text-red-500">
          Invalid score. First to 10 (min 2-goal lead). Above 10, difference must be exactly 2.
        </p>
      )}

      <button
        onClick={handleFinish}
        disabled={!validScore}
        className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Finish Match
      </button>
    </div>
  );
}
