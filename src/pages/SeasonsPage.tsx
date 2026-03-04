import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSeasonStore } from '../stores/seasonStore.ts';

export function SeasonsPage(): React.ReactElement {
  const { seasons, fetchSeasons } = useSeasonStore();

  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Seasons</h1>

      {seasons.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No completed seasons yet</div>
      ) : (
        <div className="space-y-3">
          {seasons.map((s) => (
            <Link key={s.id} to={`/seasons/${s.id}`} className="block bg-white rounded-lg shadow p-4 hover:bg-gray-50">
              <h2 className="font-bold text-lg mb-3">{s.label}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Team Top 3</div>
                  {s.teamLeaderboard.slice(0, 3).map((p, i) => (
                    <div key={p.uid} className="text-sm">
                      <span className="text-gray-400">{i + 1}.</span> {p.username} <span className="font-medium">{p.teamElo}</span>
                    </div>
                  ))}
                  {s.teamLeaderboard.length === 0 && <div className="text-xs text-gray-400">No ranked players</div>}
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Solo Top 3</div>
                  {s.soloLeaderboard.slice(0, 3).map((p, i) => (
                    <div key={p.uid} className="text-sm">
                      <span className="text-gray-400">{i + 1}.</span> {p.username} <span className="font-medium">{p.soloElo}</span>
                    </div>
                  ))}
                  {s.soloLeaderboard.length === 0 && <div className="text-xs text-gray-400">No ranked players</div>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
