import { create } from 'zustand';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { Relationship, User } from '../types/index.ts';

interface FriendState {
  relationships: Relationship[];
  pendingIncoming: Relationship[];
  friends: Relationship[];
  usernames: Record<string, string>;
  subscribeTo: (uid: string) => () => void;
  sendFriendRequest: (fromUid: string, toUid: string) => Promise<void>;
  acceptFriendRequest: (relationshipId: string) => Promise<void>;
  declineFriendRequest: (relationshipId: string, currentUid: string) => Promise<void>;
  searchUsers: (prefix: string) => Promise<User[]>;
}

function makeRelationshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export const useFriendStore = create<FriendState>((set) => ({
  relationships: [],
  pendingIncoming: [],
  friends: [],
  usernames: {},

  subscribeTo: (uid) => {
    const q = query(collection(db, 'relationships'), where('users', 'array-contains', uid));
    const unsub = onSnapshot(q, async (snap) => {
      const rels = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Relationship);

      const otherUids = new Set(rels.flatMap((r) => r.users).filter((u) => u !== uid));
      const known = useFriendStore.getState().usernames;
      const unknown = [...otherUids].filter((u) => !known[u]);

      const fetched: Record<string, string> = {};
      await Promise.all(
        unknown.map(async (u) => {
          const snap = await getDoc(doc(db, 'users', u));
          if (snap.exists()) {
            fetched[u] = (snap.data() as User).username;
          }
        }),
      );

      set({
        relationships: rels,
        pendingIncoming: rels.filter((r) => r.status === 'pending' && r.senderId !== uid),
        friends: rels.filter((r) => r.status === 'accepted'),
        usernames: { ...known, ...fetched },
      });
    });
    return unsub;
  },

  sendFriendRequest: async (fromUid, toUid) => {
    const id = makeRelationshipId(fromUid, toUid);
    await setDoc(doc(db, 'relationships', id), {
      id,
      users: [fromUid, toUid].sort(),
      status: 'pending',
      senderId: fromUid,
      updatedAt: serverTimestamp(),
    });
  },

  acceptFriendRequest: async (relationshipId) => {
    await updateDoc(doc(db, 'relationships', relationshipId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  },

  declineFriendRequest: async (relationshipId, _currentUid) => {
    await updateDoc(doc(db, 'relationships', relationshipId), {
      status: 'pending',
      updatedAt: serverTimestamp(),
    });
  },

  searchUsers: async (prefix) => {
    if (!prefix.trim()) return [];
    const lowered = prefix.toLowerCase();
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...d.data(), uid: d.id }) as User)
      .filter((u) => u.username.toLowerCase().startsWith(lowered));
  },
}));
