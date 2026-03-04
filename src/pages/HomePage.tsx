import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { useSeasonStore } from '../stores/seasonStore.ts';
import { EloDisplay } from '../components/EloDisplay.tsx';
import { ELO_CONFIG, computeTeamElo } from '../utils/elo.ts';
import type { UserSeasonStats } from '../types/index.ts';

export function HomePage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const config = useSeasonStore((s) => s.currentSeasonConfig);
  const fetchConfig = useSeasonStore((s) => s.fetchCurrentSeasonConfig);
  const [stats, setStats] = useState<UserSeasonStats | null>(null);
  const [teamRank, setTeamRank] = useState<number | null>(null);
  const [soloRank, setSoloRank] = useState<number | null>(null);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (!user || !config) return;
    async function load(): Promise<void> {
      const statsSnap = await getDoc(doc(db, 'users', user!.uid, 'seasonStats', config!.currentSeasonId));
      if (statsSnap.exists()) setStats(statsSnap.data() as UserSeasonStats);

      if (user!.teamRanked) {
        const q = query(collection(db, 'users'), where('teamRanked', '==', true));
        const snap = await getDocs(q);
        const all = snap.docs.map((d) => {
          const data = d.data();
          return { uid: d.id, teamElo: computeTeamElo(data.attackElo as number, data.defenseElo as number, null) ?? 0 };
        });
        all.sort((a, b) => b.teamElo - a.teamElo);
        const idx = all.findIndex((p) => p.uid === user!.uid);
        setTeamRank(idx >= 0 ? idx + 1 : null);
      }
      if (user!.soloRanked) {
        const q = query(collection(db, 'users'), where('soloRanked', '==', true), orderBy('soloElo', 'desc'));
        const snap = await getDocs(q);
        const idx = snap.docs.findIndex((d) => d.id === user!.uid);
        setSoloRank(idx >= 0 ? idx + 1 : null);
      }
    }
    load();
  }, [user, config]);

  if (!user) return <div>Loading...</div>;

  const req = ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;
  const winRate = user.wins + user.losses > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome, {user.username}</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Attack ELO</div>
          <EloDisplay elo={user.attackElo} matchesPlayed={stats?.attackMatchesPlayed ?? 0} required={req} roleName="attack" isOwnProfile />
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Defense ELO</div>
          <EloDisplay elo={user.defenseElo} matchesPlayed={stats?.defenseMatchesPlayed ?? 0} required={req} roleName="defense" isOwnProfile />
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Solo ELO</div>
          <EloDisplay elo={user.soloElo} matchesPlayed={stats?.soloMatchesPlayed ?? 0} required={req} roleName="solo" isOwnProfile />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        {teamRank !== null && <div className="text-sm">Team Rank: <span className="font-bold">#{teamRank}</span></div>}
        {soloRank !== null && <div className="text-sm">Solo Rank: <span className="font-bold">#{soloRank}</span></div>}
        <div className="text-sm">Season: {user.wins}W / {user.losses}L ({winRate}%)</div>
        <div className="text-sm">Career: {user.careerWins}W / {user.careerLosses}L</div>
      </div>

      <Link
        to="/match/new"
        className="block w-full py-3 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700"
      >
        Start New Match
      </Link>
    </div>
  );
}
