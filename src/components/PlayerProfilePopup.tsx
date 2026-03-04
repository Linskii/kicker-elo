import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { User, UserSeasonStats } from '../types/index.ts';
import { EloDisplay } from './EloDisplay.tsx';
import { ELO_CONFIG } from '../utils/elo.ts';
import { useSeasonStore } from '../stores/seasonStore.ts';

interface Props {
  uid: string;
  onClose: () => void;
}

export function PlayerProfilePopup({ uid, onClose }: Props): React.ReactElement {
  const [player, setPlayer] = useState<User | null>(null);
  const [stats, setStats] = useState<UserSeasonStats | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const config = useSeasonStore((s) => s.currentSeasonConfig);

  useEffect(() => {
    async function load(): Promise<void> {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        setPlayer({ ...userSnap.data(), uid: userSnap.id } as User);
      }
      if (config?.currentSeasonId) {
        const statsSnap = await getDoc(doc(db, 'users', uid, 'seasonStats', config.currentSeasonId));
        if (statsSnap.exists()) {
          setStats(statsSnap.data() as UserSeasonStats);
        }
      }
    }
    load();
  }, [uid, config]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  if (!player) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-lg p-6">Loading...</div></div>;

  const req = ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={ref} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 className="text-xl font-bold">{player.username}</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">Attack</div>
            <EloDisplay elo={player.attackElo} matchesPlayed={stats?.attackMatchesPlayed ?? 0} required={req} roleName="attack" isOwnProfile={false} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Defense</div>
            <EloDisplay elo={player.defenseElo} matchesPlayed={stats?.defenseMatchesPlayed ?? 0} required={req} roleName="defense" isOwnProfile={false} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Solo</div>
            <EloDisplay elo={player.soloElo} matchesPlayed={stats?.soloMatchesPlayed ?? 0} required={req} roleName="solo" isOwnProfile={false} />
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <div>Season: {player.wins}W / {player.losses}L</div>
          <div>Career: {player.careerWins}W / {player.careerLosses}L</div>
        </div>
        <button onClick={onClose} className="w-full py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm">Close</button>
      </div>
    </div>
  );
}
