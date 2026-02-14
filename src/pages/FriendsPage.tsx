import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../stores/authStore";
import type { Relationship, User } from "../types";

export function FriendsPage() {
  const { user } = useAuthStore();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Subscribe to relationships where current user is involved
    const q = query(
      collection(db, "relationships"),
      where("users", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rels = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Relationship
      );
      setRelationships(rels);

      // Fetch user data for all friends
      const friendIds = rels.flatMap((r) =>
        r.users.filter((uid) => uid !== user.uid)
      );
      const uniqueIds = [...new Set(friendIds)];

      if (uniqueIds.length > 0) {
        const usersMap: Record<string, User> = {};
        for (const uid of uniqueIds) {
          const userDoc = await getDocs(
            query(collection(db, "users"), where("__name__", "==", uid))
          );
          if (!userDoc.empty) {
            usersMap[uid] = {
              uid,
              ...userDoc.docs[0].data(),
            } as User;
          }
        }
        setUsers(usersMap);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async () => {
    if (!searchUsername.trim() || !user) return;

    setSearching(true);
    const q = query(
      collection(db, "users"),
      where("username", "==", searchUsername.trim())
    );
    const snapshot = await getDocs(q);
    const results = snapshot.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }) as User)
      .filter((u) => u.uid !== user.uid);
    setSearchResults(results);
    setSearching(false);
  };

  const sendFriendRequest = async (friendUid: string) => {
    if (!user) return;

    // Create alphabetically sorted ID to prevent duplicates
    const ids = [user.uid, friendUid].sort();
    const relationshipId = `${ids[0]}_${ids[1]}`;

    await setDoc(doc(db, "relationships", relationshipId), {
      users: ids,
      status: "pending",
      senderId: user.uid,
      trusts: { [user.uid]: false, [friendUid]: false },
      updatedAt: serverTimestamp(),
    });

    setSearchResults([]);
    setSearchUsername("");
  };

  const acceptRequest = async (relationshipId: string) => {
    await updateDoc(doc(db, "relationships", relationshipId), {
      status: "accepted",
      updatedAt: serverTimestamp(),
    });
  };

  const removeFriend = async (relationshipId: string) => {
    await deleteDoc(doc(db, "relationships", relationshipId));
  };

  const toggleTrust = async (relationshipId: string, currentTrust: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, "relationships", relationshipId), {
      [`trusts.${user.uid}`]: !currentTrust,
      updatedAt: serverTimestamp(),
    });
  };

  if (!user) return null;

  const pendingReceived = relationships.filter(
    (r) => r.status === "pending" && r.senderId !== user.uid
  );
  const pendingSent = relationships.filter(
    (r) => r.status === "pending" && r.senderId === user.uid
  );
  const friends = relationships.filter((r) => r.status === "accepted");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>

      {/* Search */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add Friend</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by username..."
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            {searching ? "..." : "Search"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((result) => {
              const existingRel = relationships.find((r) =>
                r.users.includes(result.uid)
              );
              return (
                <div
                  key={result.uid}
                  className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {result.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{result.username}</div>
                      <div className="text-sm text-gray-400">
                        Elo: {result.elo}
                      </div>
                    </div>
                  </div>
                  {existingRel ? (
                    <span className="text-sm text-gray-400">
                      {existingRel.status === "pending"
                        ? "Request pending"
                        : "Already friends"}
                    </span>
                  ) : (
                    <button
                      onClick={() => sendFriendRequest(result.uid)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Received */}
      {pendingReceived.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Friend Requests</h2>
          <div className="space-y-2">
            {pendingReceived.map((rel) => {
              const friendUid = rel.users.find((uid) => uid !== user.uid)!;
              const friend = users[friendUid];
              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {friend?.username.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="font-medium">
                        {friend?.username || "Loading..."}
                      </div>
                      <div className="text-sm text-gray-400">
                        Elo: {friend?.elo || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(rel.id)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => removeFriend(rel.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Sent */}
      {pendingSent.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Sent Requests</h2>
          <div className="space-y-2">
            {pendingSent.map((rel) => {
              const friendUid = rel.users.find((uid) => uid !== user.uid)!;
              const friend = users[friendUid];
              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {friend?.username.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="font-medium">
                      {friend?.username || "Loading..."}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFriend(rel.id)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Friends ({friends.length})</h2>
        {loading ? (
          <div className="text-gray-400 text-center py-4">Loading...</div>
        ) : friends.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            No friends yet. Search for players above!
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((rel) => {
              const friendUid = rel.users.find((uid) => uid !== user.uid)!;
              const friend = users[friendUid];
              const isTrusted = rel.trusts[user.uid];

              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {friend?.username.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="font-medium">
                        {friend?.username || "Loading..."}
                      </div>
                      <div className="text-sm text-gray-400">
                        Elo: {friend?.elo || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label
                      className="flex items-center gap-2 cursor-pointer"
                      title="Trust allows auto-join to match lobbies"
                    >
                      <span className="text-sm text-gray-400">
                        {isTrusted ? "Trusted" : "Trust"}
                      </span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isTrusted}
                          onChange={() => toggleTrust(rel.id, isTrusted)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-green-600 transition-colors duration-300"></div>
                        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 peer-checked:translate-x-5"></div>
                      </div>
                    </label>
                    <button
                      onClick={() => removeFriend(rel.id)}
                      className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
