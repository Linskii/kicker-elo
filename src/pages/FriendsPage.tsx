import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore.ts';
import { useFriendStore } from '../stores/friendStore.ts';
import type { User } from '../types/index.ts';

export function FriendsPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const { friends, pendingIncoming, relationships, usernames, subscribeTo, sendFriendRequest, acceptFriendRequest, searchUsers } = useFriendStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeTo(user.uid);
  }, [user, subscribeTo]);

  async function handleSearch(): Promise<void> {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchUsers(searchQuery.trim());
    setSearchResults(results.filter((u) => u.uid !== user?.uid));
    setSearching(false);
  }

  function getRelationshipStatus(uid: string): string | null {
    const rel = relationships.find((r) => r.users.includes(uid));
    if (!rel) return null;
    return rel.status;
  }

  if (!user) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>

      {/* Search */}
      <div className="flex gap-2">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by username..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleSearch} disabled={searching} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Search
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow divide-y">
          {searchResults.map((u) => {
            const status = getRelationshipStatus(u.uid);
            return (
              <div key={u.uid} className="flex items-center justify-between p-3">
                <span className="text-sm font-medium">{u.username}</span>
                {status === 'accepted' ? (
                  <span className="text-xs text-green-600">Friends</span>
                ) : status === 'pending' ? (
                  <span className="text-xs text-yellow-600">Pending</span>
                ) : (
                  <button
                    onClick={() => sendFriendRequest(user.uid, u.uid)}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Add Friend
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Requests */}
      {pendingIncoming.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-gray-500 mb-2">Incoming Requests</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {pendingIncoming.map((r) => {
              const senderUid = r.users.find((uid) => uid !== user.uid) ?? r.senderId;
              return (
                <div key={r.id} className="flex items-center justify-between p-3">
                  <span className="text-sm">{usernames[senderUid] ?? senderUid}</span>
                  <button
                    onClick={() => acceptFriendRequest(r.id)}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Accept
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div>
        <h2 className="font-semibold text-sm text-gray-500 mb-2">Your Friends</h2>
        <div className="bg-white rounded-lg shadow divide-y">
          {friends.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No friends yet. Search to add some!</div>
          ) : (
            friends.map((r) => {
              const friendUid = r.users.find((uid) => uid !== user.uid) ?? '';
              return (
                <div key={r.id} className="flex items-center justify-between p-3">
                  <span className="text-sm">{usernames[friendUid] ?? friendUid}</span>
                  <span className="text-xs text-green-600">Friends</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
