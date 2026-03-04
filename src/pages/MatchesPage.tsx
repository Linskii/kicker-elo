import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuthStore } from '../stores/authStore.ts';
import type { Match } from '../types/index.ts';

export function MatchesPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load(): Promise<void> {
      const q = query(
        collection(db, 'matches'),
        where('participants', 'array-contains', user!.uid),
      );
      const snap = await getDocs(q);
      const now = Timestamp.now().toMillis();
      const tenMin = 10 * 60 * 1000;

      const all = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }) as Match)
        .filter((m) => {
          if (m.status === 'lobby' || m.status === 'live') return true;
          if (m.status === 'completed' && m.endedAt) {
            return now - m.endedAt.toMillis() <= tenMin;
          }
          return false;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis() ?? 0;
          const bTime = b.createdAt?.toMillis() ?? 0;
          return bTime - aTime;
        });

      setMatches(all);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return <div>Loading...</div>;

  function getMatchLink(m: Match): string {
    if (m.status === 'lobby') return `/match/${m.id}`;
    if (m.status === 'live') return `/match/${m.id}/live`;
    return `/match/${m.id}/result`;
  }

  function getStatusBadge(status: string): React.ReactElement {
    const colors: Record<string, string> = {
      lobby: 'bg-yellow-100 text-yellow-800',
      live: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status]}`}>{status}</span>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Matches</h1>

      {matches.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <p>No active matches</p>
          <Link to="/match/new" className="text-blue-600 text-sm mt-2 inline-block">Start a new match</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <Link
              key={m.id}
              to={getMatchLink(m)}
              className="block bg-white rounded-lg shadow p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium capitalize">{m.type} Match</span>
                {getStatusBadge(m.status)}
              </div>
              {m.status === 'completed' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-600 font-bold">{m.redScore}</span>
                  <span className="text-gray-400">-</span>
                  <span className="text-blue-600 font-bold">{m.blueScore}</span>
                  {m.eloChanges && m.eloChanges[user.uid] && (
                    <span className="ml-auto text-xs">
                      {(() => {
                        const c = m.eloChanges[user.uid];
                        const d = Math.round(c.soloEloDelta || c.attackEloDelta || c.defenseEloDelta);
                        return <span className={d >= 0 ? 'text-green-600' : 'text-red-600'}>{d >= 0 ? '+' : ''}{d} ELO</span>;
                      })()}
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">{m.participants.length} players</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
