import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { useMatchStore } from '../stores/matchStore.ts';
import { useFriendStore } from '../stores/friendStore.ts';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { User } from '../types/index.ts';

export function NewMatchPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const { createMatch, invitePlayer } = useMatchStore();
  const { friends, subscribeTo } = useFriendStore();
  const navigate = useNavigate();
  const [friendUsers, setFriendUsers] = useState<User[]>([]);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeTo(user.uid);
  }, [user, subscribeTo]);

  useEffect(() => {
    async function loadFriendUsers(): Promise<void> {
      if (!user) return;
      const users: User[] = [];
      for (const r of friends) {
        const friendUid = r.users.find((uid) => uid !== user.uid);
        if (!friendUid) continue;
        const snap = await getDoc(doc(db, 'users', friendUid));
        if (snap.exists()) users.push({ ...snap.data(), uid: snap.id } as User);
      }
      setFriendUsers(users);
    }
    loadFriendUsers();
  }, [friends, user]);

  function toggleSelect(uid: string): void {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : prev.length < 3 ? [...prev, uid] : prev,
    );
  }

  async function handleCreate(): Promise<void> {
    if (!user || selectedUids.length === 0) return;
    setCreating(true);
    try {
      const matchId = await createMatch(user.uid);
      for (const uid of selectedUids) {
        await invitePlayer(matchId, uid);
      }
      navigate(`/match/${matchId}`);
    } catch {
      setCreating(false);
    }
  }

  if (!user) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Match</h1>
      <p className="text-sm text-gray-500">Select 1 or 3 friends to play with ({selectedUids.length} selected)</p>

      <div className="bg-white rounded-lg shadow divide-y">
        {friendUsers.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">Add friends first to start a match</div>
        ) : (
          friendUsers.map((f) => (
            <button
              key={f.uid}
              onClick={() => toggleSelect(f.uid)}
              className={`w-full flex items-center justify-between p-3 text-left ${selectedUids.includes(f.uid) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <span className="text-sm font-medium">{f.username}</span>
              {selectedUids.includes(f.uid) && (
                <span className="text-blue-600 text-sm">Selected</span>
              )}
            </button>
          ))
        )}
      </div>

      <button
        onClick={handleCreate}
        disabled={creating || (selectedUids.length !== 1 && selectedUids.length !== 3)}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {creating ? 'Creating...' : 'Create Match'}
      </button>
    </div>
  );
}
