import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatchStore } from '../stores/matchStore.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { FieldView } from '../components/FieldView.tsx';

export function LiveMatchPage(): React.ReactElement {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { match, participants, subscribeToMatch, addGoal, completeMatch } = useMatchStore();

  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId);
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (match?.status === 'completed') navigate(`/match/${matchId}/result`, { replace: true });
  }, [match?.status, matchId, navigate]);

  if (!match || !user || !matchId) return <div className="p-4">Loading...</div>;

  async function handleGoal(side: 'red' | 'blue'): Promise<void> {
    const shouldComplete = await addGoal(matchId!, side);
    if (shouldComplete) {
      const newRed = side === 'red' ? match!.redScore + 1 : match!.redScore;
      const newBlue = side === 'blue' ? match!.blueScore + 1 : match!.blueScore;
      await completeMatch(matchId!, newRed, newBlue);
    }
  }

  async function handleFinish(): Promise<void> {
    await completeMatch(matchId!, match!.redScore, match!.blueScore);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-center">Live Match</h1>

      <FieldView match={match} participants={participants} />

      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="text-6xl font-bold text-red-600">{match.redScore}</div>
          <div className="text-sm text-gray-500 mt-1">Red</div>
        </div>
        <div className="text-2xl text-gray-300">vs</div>
        <div className="text-center">
          <div className="text-6xl font-bold text-blue-600">{match.blueScore}</div>
          <div className="text-sm text-gray-500 mt-1">Blue</div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => handleGoal('red')}
          className="flex-1 py-4 bg-red-600 text-white rounded-lg text-lg font-bold hover:bg-red-700 active:bg-red-800"
        >
          +1 Red
        </button>
        <button
          onClick={() => handleGoal('blue')}
          className="flex-1 py-4 bg-blue-600 text-white rounded-lg text-lg font-bold hover:bg-blue-700 active:bg-blue-800"
        >
          +1 Blue
        </button>
      </div>

      <button
        onClick={handleFinish}
        className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900"
      >
        Finish Match
      </button>
    </div>
  );
}
