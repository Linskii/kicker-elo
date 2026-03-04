import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { computeTeamElo } from '../utils/elo.ts';
import { Inbox } from '../components/Inbox.tsx';
import { PlayerProfilePopup } from '../components/PlayerProfilePopup.tsx';
import type { User, UserSeasonStats } from '../types/index.ts';
import { useSeasonStore } from '../stores/seasonStore.ts';

type Tab = 'team' | 'solo';

interface LeaderboardEntry {
  uid: string;
  username: string;
  attackElo: number;
  defenseElo: number;
  soloElo: number;
  teamElo: number;
  wins: number;
  losses: number;
}

export function LeaderboardPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('team');
  const [teamEntries, setTeamEntries] = useState<LeaderboardEntry[]>([]);
  const [soloEntries, setSoloEntries] = useState<LeaderboardEntry[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const config = useSeasonStore((s) => s.currentSeasonConfig);
  const fetchConfig = useSeasonStore((s) => s.fetchCurrentSeasonConfig);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (!config) return;
    async function loadTeam(): Promise<void> {
      const q = query(collection(db, 'users'), where('teamRanked', '==', true));
      const snap = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      for (const d of snap.docs) {
        const u = d.data() as User;
        const statsSnap = await getDoc(doc(db, 'users', d.id, 'seasonStats', config!.currentSeasonId));
        const stats = statsSnap.exists() ? (statsSnap.data() as UserSeasonStats) : null;
        const tElo = computeTeamElo(u.attackElo, u.defenseElo, stats);
        if (tElo !== null) {
          entries.push({
            uid: d.id, username: u.username,
            attackElo: u.attackElo, defenseElo: u.defenseElo,
            soloElo: u.soloElo, teamElo: tElo,
            wins: u.wins, losses: u.losses,
          });
        }
      }
      entries.sort((a, b) => b.teamElo - a.teamElo);
      setTeamEntries(entries.slice(0, 50));
    }
    async function loadSolo(): Promise<void> {
      const q = query(collection(db, 'users'), where('soloRanked', '==', true), orderBy('soloElo', 'desc'), limit(50));
      const snap = await getDocs(q);
      setSoloEntries(snap.docs.map((d) => {
        const u = d.data() as User;
        return {
          uid: d.id, username: u.username,
          attackElo: u.attackElo, defenseElo: u.defenseElo,
          soloElo: u.soloElo, teamElo: 0,
          wins: u.wins, losses: u.losses,
        };
      }));
    }
    loadTeam();
    loadSolo();
  }, [config]);

  const entries = tab === 'team' ? teamEntries : soloEntries;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <div className="md:hidden"><Inbox /></div>
      </div>

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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No ranked players yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedUid && <PlayerProfilePopup uid={selectedUid} onClose={() => setSelectedUid(null)} />}
    </div>
  );
}
