import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useMatchStore } from '../stores/matchStore.ts';
import { useAuthStore } from '../stores/authStore.ts';
import type { UserSeasonStats } from '../types/index.ts';
import { ELO_CONFIG } from '../utils/elo.ts';

export function MatchResultPage(): React.ReactElement {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { match, participants, subscribeToMatch, createRematch } = useMatchStore();
  const [seasonStats, setSeasonStats] = useState<Record<string, UserSeasonStats | null>>({});
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId);
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (!match?.seasonId) return;
    async function loadStats(): Promise<void> {
      const stats: Record<string, UserSeasonStats | null> = {};
      for (const uid of match!.participants) {
        const snap = await getDoc(doc(db, 'users', uid, 'seasonStats', match!.seasonId!));
        stats[uid] = snap.exists() ? (snap.data() as UserSeasonStats) : null;
      }
      setSeasonStats(stats);
    }
    loadStats();
  }, [match]);

  useEffect(() => {
    if (!match?.endedAt) return;
    const interval = setInterval(() => {
      const elapsed = Timestamp.now().toMillis() - match.endedAt!.toMillis();
      const remaining = Math.max(0, 10 * 60 * 1000 - elapsed);
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [match?.endedAt]);

  if (!match || !user || !matchId) return <div className="p-4">Loading...</div>;

  const redWon = match.redScore > match.blueScore;

  function formatPlayerChange(uid: string): React.ReactElement {
    const changes = match!.eloChanges?.[uid];
    if (!changes) return <span>-</span>;

    const stats = seasonStats[uid];
    const req = ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;

    if (match!.type === 'solo') {
      const isPlacement = (stats?.soloMatchesPlayed ?? 0) < req;
      if (isPlacement) return <span className="text-yellow-600 text-sm">Placement</span>;
      const d = Math.round(changes.soloEloDelta);
      return <span className={d >= 0 ? 'text-green-600' : 'text-red-600'}>{d >= 0 ? '+' : ''}{d}</span>;
    }

    const isAttacker = match!.redAttacker === uid || match!.blueAttacker === uid;
    if (isAttacker) {
      const isPlacement = (stats?.attackMatchesPlayed ?? 0) < req;
      if (isPlacement) return <span className="text-yellow-600 text-sm">Placement</span>;
      const d = Math.round(changes.attackEloDelta);
      return <span className={d >= 0 ? 'text-green-600' : 'text-red-600'}>{d >= 0 ? '+' : ''}{d}</span>;
    }
    const isPlacement = (stats?.defenseMatchesPlayed ?? 0) < req;
    if (isPlacement) return <span className="text-yellow-600 text-sm">Placement</span>;
    const d = Math.round(changes.defenseEloDelta);
    return <span className={d >= 0 ? 'text-green-600' : 'text-red-600'}>{d >= 0 ? '+' : ''}{d}</span>;
  }

  async function handleRematch(): Promise<void> {
    const newId = await createRematch(matchId!);
    navigate(`/match/${newId}`);
  }

  const canEdit = timeLeft > 0;
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Match Result</h1>

      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <div className={`text-5xl font-bold ${redWon ? 'text-red-600' : 'text-red-300'}`}>{match.redScore}</div>
          <div className="text-sm text-gray-500">Red {redWon ? '(Winner)' : ''}</div>
        </div>
        <div className="text-xl text-gray-300">-</div>
        <div className="text-center">
          <div className={`text-5xl font-bold ${!redWon ? 'text-blue-600' : 'text-blue-300'}`}>{match.blueScore}</div>
          <div className="text-sm text-gray-500">Blue {!redWon ? '(Winner)' : ''}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        {match.participants.map((uid) => {
          const p = participants[uid];
          if (!p) return null;
          return (
            <div key={uid} className="flex items-center justify-between p-3">
              <span className="text-sm font-medium">{p.username}</span>
              <span className="text-sm font-bold">{formatPlayerChange(uid)}</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRematch}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          Rematch
        </button>
        {canEdit && (
          <button
            onClick={() => navigate(`/match/${matchId}/edit`)}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            Edit ({minutes}:{String(seconds).padStart(2, '0')})
          </button>
        )}
      </div>
    </div>
  );
}
