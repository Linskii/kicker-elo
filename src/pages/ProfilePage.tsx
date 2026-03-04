import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { useSeasonStore } from '../stores/seasonStore.ts';
import { EloDisplay } from '../components/EloDisplay.tsx';
import { ELO_CONFIG } from '../utils/elo.ts';
import type { UserSeasonStats } from '../types/index.ts';

export function ProfilePage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const updateUsername = useAuthStore((s) => s.updateUsername);
  const config = useSeasonStore((s) => s.currentSeasonConfig);
  const fetchConfig = useSeasonStore((s) => s.fetchCurrentSeasonConfig);
  const signOut = useAuthStore((s) => s.signOut);
  const [stats, setStats] = useState<UserSeasonStats | null>(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (!user || !config) return;
    async function load(): Promise<void> {
      const snap = await getDoc(doc(db, 'users', user!.uid, 'seasonStats', config!.currentSeasonId));
      if (snap.exists()) setStats(snap.data() as UserSeasonStats);
    }
    load();
  }, [user, config]);

  if (!user) return <div>Loading...</div>;

  const req = ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;
  const winRate = user.wins + user.losses > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0;

  async function saveName(): Promise<void> {
    if (newName.trim()) {
      await updateUsername(newName.trim());
      setEditing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border rounded px-2 py-1 text-lg font-bold"
              autoFocus
            />
            <button onClick={saveName} className="text-sm text-blue-600">Save</button>
            <button onClick={() => setEditing(false)} className="text-sm text-gray-500">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{user.username}</h1>
            <button onClick={() => { setNewName(user.username); setEditing(true); }} className="text-sm text-blue-600">Edit</button>
          </div>
        )}
      </div>

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
        <div className="text-sm">Season: {user.wins}W / {user.losses}L ({winRate}%)</div>
        <div className="text-sm">Career: {user.careerWins}W / {user.careerLosses}L</div>
      </div>

      <button onClick={signOut} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100">
        Sign Out
      </button>
    </div>
  );
}
