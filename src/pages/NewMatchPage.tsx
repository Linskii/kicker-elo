import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";
import type { Relationship, User } from "../types";

export function NewMatchPage() {
  const { user } = useAuthStore();
  const { createMatch, invitePlayer, currentMatch, subscribeToMatch } =
    useMatchStore();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<User[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);

  // Auto-create match on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const init = async () => {
      try {
        const newMatchId = await createMatch(user.uid);
        if (!cancelled) setMatchId(newMatchId);
      } catch (error) {
        console.error("Error creating match:", error);
      } finally {
        if (!cancelled) setCreating(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [user, createMatch]);

  // Fetch friends
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "relationships"),
      where("users", "array-contains", user.uid),
      where("status", "==", "accepted")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const relationships = snapshot.docs.map(
        (doc) => doc.data() as Relationship
      );

      const friendIds = relationships
        .flatMap((r) => r.users)
        .filter((uid) => uid !== user.uid);

      if (friendIds.length > 0) {
        const friendsList: User[] = [];
        for (const uid of friendIds) {
          const userDoc = await getDocs(
            query(collection(db, "users"), where("__name__", "==", uid))
          );
          if (!userDoc.empty) {
            friendsList.push({
              uid,
              ...userDoc.docs[0].data(),
            } as User);
          }
        }
        setFriends(friendsList);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to match after creation
  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = subscribeToMatch(matchId);
    return () => unsubscribe();
  }, [matchId, subscribeToMatch]);

  const handleInvite = async (friendUid: string) => {
    if (!matchId || !user) return;
    await invitePlayer(matchId, friendUid);
  };

  const getPlayerStatus = (friendUid: string): "ready" | "not_invited" => {
    if (!currentMatch) return "not_invited";
    if (currentMatch.participants.includes(friendUid)) return "ready";
    return "not_invited";
  };

  const handleGoToLobby = () => {
    if (matchId) {
      navigate(`/match/${matchId}`);
    }
  };

  if (!user) return null;

  if (creating || !matchId) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold">New Match</h1>
        <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
          Creating lobby...
        </div>
      </div>
    );
  }

  // After match is created - invite friends
  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Invite Players</h1>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-4">
          Invited: {currentMatch?.participants.length || 1} player(s)
        </div>

        {friends.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            No friends to invite. Add friends first!
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => {
              const status = getPlayerStatus(friend.uid);
              return (
                <div
                  key={friend.uid}
                  className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{friend.username}</div>
                      <div className="text-sm text-gray-400">
                        Elo: {friend.elo}
                      </div>
                    </div>
                  </div>
                  {status === "ready" ? (
                    <span className="px-2 py-0.5 text-xs rounded-full border bg-green-500/20 text-green-400 border-green-500/50">
                      Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInvite(friend.uid)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Invite
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={handleGoToLobby}
        className="w-full py-3 rounded-lg font-medium transition-colors bg-green-600 hover:bg-green-700"
      >
        Go to Lobby
      </button>
    </div>
  );
}
