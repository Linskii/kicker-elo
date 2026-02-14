import { create } from "zustand";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Invitation, User } from "../types";

interface InvitationState {
  pendingInvitations: Invitation[];
  inviterUsers: Record<string, User>;
  loading: boolean;

  subscribeToInvitations: (userUid: string) => () => void;
  acceptInvitation: (invitation: Invitation) => Promise<void>;
  declineInvitation: (invitation: Invitation) => Promise<void>;
}

export const useInvitationStore = create<InvitationState>((set, get) => ({
  pendingInvitations: [],
  inviterUsers: {},
  loading: false,

  subscribeToInvitations: (userUid) => {
    set({ loading: true });

    const q = query(
      collection(db, "invitations"),
      where("inviteeUid", "==", userUid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const invitations = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Invitation
      );

      // Fetch inviter user data
      const inviterIds = [...new Set(invitations.map((i) => i.inviterUid))];
      const inviterUsers: Record<string, User> = { ...get().inviterUsers };

      for (const uid of inviterIds) {
        if (!inviterUsers[uid]) {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            inviterUsers[uid] = { uid: userDoc.id, ...userDoc.data() } as User;
          }
        }
      }

      set({ pendingInvitations: invitations, inviterUsers, loading: false });
    });

    return unsubscribe;
  },

  acceptInvitation: async (invitation) => {
    const batch = writeBatch(db);

    // Update invitation status
    batch.update(doc(db, "invitations", invitation.id), {
      status: "accepted",
      respondedAt: serverTimestamp(),
    });

    // Update match: add to participants, remove from pendingInvitations
    batch.update(doc(db, "matches", invitation.matchId), {
      participants: arrayUnion(invitation.inviteeUid),
      pendingInvitations: arrayRemove(invitation.inviteeUid),
    });

    await batch.commit();
  },

  declineInvitation: async (invitation) => {
    const batch = writeBatch(db);

    // Update invitation status
    batch.update(doc(db, "invitations", invitation.id), {
      status: "declined",
      respondedAt: serverTimestamp(),
    });

    // Remove from match pendingInvitations
    batch.update(doc(db, "matches", invitation.matchId), {
      pendingInvitations: arrayRemove(invitation.inviteeUid),
    });

    await batch.commit();
  },
}));
