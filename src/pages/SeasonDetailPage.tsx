import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSeasonStore } from '../stores/seasonStore.ts';
import { PlayerProfilePopup } from '../components/PlayerProfilePopup.tsx';
import type { Season } from '../types/index.ts';

type Tab = 'team' | 'solo';

export function SeasonDetailPage(): React.ReactElement {
  const { seasonId } = useParams<{ seasonId: string }>();
  const fetchSeasonById = useSeasonStore((s) => s.fetchSeasonById);
  const [season, setSeason] = useState<Season | null>(null);
  const [tab, setTab] = useState<Tab>('team');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) return;
    fetchSeasonById(seasonId).then((s) => setSeason(s));
  }, [seasonId, fetchSeasonById]);

  if (!season) return <div className="p-4">Loading...</div>;

  const entries = tab === 'team' ? season.teamLeaderboard : season.soloLeaderboard;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{season.label}</h1>

      <div className="flex gap-2">
        <button onClick={() => setTab('team')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'team' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Team</button>
        <button onClick={() => setTab('solo')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'solo' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Solo</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Player</th>
              {tab === 'team' ? (
                <>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Atk</th>
                  <th className="px-4 py-2 hidden sm:table-cell">Def</th>
                </>
              ) : (
                <th className="px-4 py-2">Solo</th>
              )}
              <th className="px-4 py-2">W/L</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.uid} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedUid(entry.uid)}>
                <td className="px-4 py-2 font-medium">{i + 1}</td>
                <td className="px-4 py-2">{entry.username}</td>
                {tab === 'team' ? (
                  <>
                    <td className="px-4 py-2 font-bold">{entry.teamElo}</td>
                    <td className="px-4 py-2 hidden sm:table-cell">{entry.attackElo}</td>
                    <td className="px-4 py-2 hidden sm:table-cell">{entry.defenseElo}</td>
                  </>
                ) : (
                  <td className="px-4 py-2 font-bold">{entry.soloElo}</td>
                )}
                <td className="px-4 py-2">{entry.wins}/{entry.losses}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No ranked players this season</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedUid && <PlayerProfilePopup uid={selectedUid} onClose={() => setSelectedUid(null)} />}
    </div>
  );
}
