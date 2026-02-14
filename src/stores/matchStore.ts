import { create } from "zustand";
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Match, User, Relationship } from "../types";
import { calculateMatchEloChanges } from "../utils/elo";

interface MatchState {
  currentMatch: Match | null;
  participants: Record<string, User>;
  loading: boolean;
  error: string | null;
  timer: number;
  timerRunning: boolean;

  // Actions
  createMatch: (creatorUid: string) => Promise<string>;
  subscribeToMatch: (matchId: string) => () => void;
  invitePlayer: (matchId: string, playerUid: string, inviterUid: string) => Promise<void>;
  assignToTeam: (
    matchId: string,
    playerUid: string,
    team: "red" | "blue",
    role: "attacker" | "defender"
  ) => Promise<void>;
  removeFromTeam: (
    matchId: string,
    team: "red" | "blue",
    role: "attacker" | "defender"
  ) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  addGoal: (matchId: string, team: "red" | "blue") => Promise<void>;
  swapRoles: (matchId: string, team: "red" | "blue") => Promise<void>;
  completeMatch: (matchId: string, finalRedScore?: number, finalBlueScore?: number) => Promise<void>;

  // Timer
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => {
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  return {
    currentMatch: null,
    participants: {},
    loading: false,
    error: null,
    timer: 0,
    timerRunning: false,

    createMatch: async (creatorUid) => {
      const matchRef = doc(collection(db, "matches"));
      const newMatch: Omit<Match, "id"> = {
        status: "lobby",
        participants: [creatorUid],
        redTeam: { attacker: null, defender: null, score: 0 },
        blueTeam: { attacker: null, defender: null, score: 0 },
        events: [],
        createdBy: creatorUid,
      };

      await setDoc(matchRef, newMatch);
      return matchRef.id;
    },

    subscribeToMatch: (matchId) => {
      set({ loading: true });

      const unsubscribe = onSnapshot(
        doc(db, "matches", matchId),
        async (snapshot) => {
          if (snapshot.exists()) {
            const match = { id: snapshot.id, ...snapshot.data() } as Match;
            set({ currentMatch: match, loading: false });

            // Fetch participant details
            const participantIds = match.participants;
            const participantsMap: Record<string, User> = {};

            for (const uid of participantIds) {
              const userDoc = await getDoc(doc(db, "users", uid));
              if (userDoc.exists()) {
                participantsMap[uid] = {
                  uid: userDoc.id,
                  ...userDoc.data(),
                } as User;
              }
            }
            set({ participants: participantsMap });
          } else {
            set({ currentMatch: null, loading: false, error: "Match not found" });
          }
        }
      );

      return unsubscribe;
    },

    invitePlayer: async (matchId, playerUid, inviterUid) => {
      // Check if invitee trusts the inviter
      const ids = [inviterUid, playerUid].sort();
      const relationshipId = `${ids[0]}_${ids[1]}`;
      const relDoc = await getDoc(doc(db, "relationships", relationshipId));

      let inviteeTrustsInviter = false;
      if (relDoc.exists()) {
        const relationship = relDoc.data() as Relationship;
        inviteeTrustsInviter = relationship.trusts?.[playerUid] === true;
      }

      if (inviteeTrustsInviter) {
        // Auto-join: invitee trusts inviter, add directly to participants
        await updateDoc(doc(db, "matches", matchId), {
          participants: arrayUnion(playerUid),
        });
      } else {
        // Create invitation: invitee doesn't trust inviter
        const batch = writeBatch(db);

        // Add to pendingInvitations on match
        batch.update(doc(db, "matches", matchId), {
          pendingInvitations: arrayUnion(playerUid),
        });

        // Create invitation document
        const invitationRef = doc(collection(db, "invitations"));
        batch.set(invitationRef, {
          matchId,
          inviterUid,
          inviteeUid: playerUid,
          status: "pending",
          createdAt: serverTimestamp(),
        });

        await batch.commit();
      }
    },

    assignToTeam: async (matchId, playerUid, team, role) => {
      const match = get().currentMatch;
      if (!match) return;

      // Remove player from any existing position
      const updates: Record<string, unknown> = {};

      if (match.redTeam.attacker === playerUid) updates["redTeam.attacker"] = null;
      if (match.redTeam.defender === playerUid) updates["redTeam.defender"] = null;
      if (match.blueTeam.attacker === playerUid) updates["blueTeam.attacker"] = null;
      if (match.blueTeam.defender === playerUid) updates["blueTeam.defender"] = null;

      // Assign to new position
      updates[`${team}Team.${role}`] = playerUid;

      await updateDoc(doc(db, "matches", matchId), updates);
    },

    removeFromTeam: async (matchId, team, role) => {
      await updateDoc(doc(db, "matches", matchId), {
        [`${team}Team.${role}`]: null,
      });
    },

    startMatch: async (matchId) => {
      await updateDoc(doc(db, "matches", matchId), {
        status: "live",
        startedAt: serverTimestamp(),
      });
      get().startTimer();
    },

    addGoal: async (matchId, team) => {
      const match = get().currentMatch;
      if (!match || match.status !== "live") return;

      const currentScore = match[`${team}Team`].score;
      const newScore = currentScore + 1;
      const otherTeam = team === "red" ? "blue" : "red";
      const otherScore = match[`${otherTeam}Team`].score;

      await updateDoc(doc(db, "matches", matchId), {
        [`${team}Team.score`]: newScore,
        events: arrayUnion({
          type: "goal",
          team,
          time: new Date().toISOString(),
        }),
      });

      // Win condition: First to 10 with 2 point lead
      if (newScore >= 10 && newScore - otherScore >= 2) {
        // Pass the final scores to completeMatch since local state may be stale
        const finalRedScore = team === "red" ? newScore : match.redTeam.score;
        const finalBlueScore = team === "blue" ? newScore : match.blueTeam.score;
        await get().completeMatch(matchId, finalRedScore, finalBlueScore);
      }
    },

    swapRoles: async (matchId, team) => {
      const match = get().currentMatch;
      if (!match) return;

      const teamData = match[`${team}Team`];
      await updateDoc(doc(db, "matches", matchId), {
        [`${team}Team.attacker`]: teamData.defender,
        [`${team}Team.defender`]: teamData.attacker,
        events: arrayUnion({
          type: "swap",
          team,
          time: new Date().toISOString(),
        }),
      });
    },

    completeMatch: async (matchId, finalRedScore?, finalBlueScore?) => {
      const match = get().currentMatch;
      const participants = get().participants;
      if (!match) return;

      get().stopTimer();

      // Use provided final scores or fall back to match state
      const redScore = finalRedScore ?? match.redTeam.score;
      const blueScore = finalBlueScore ?? match.blueTeam.score;

      // Create team objects with correct final scores for Elo calculation
      const redTeamWithScore = { ...match.redTeam, score: redScore };
      const blueTeamWithScore = { ...match.blueTeam, score: blueScore };

      // Calculate Elo changes
      const userElos: Record<string, number> = {};
      for (const [uid, user] of Object.entries(participants)) {
        userElos[uid] = user.elo;
      }

      const eloChanges = calculateMatchEloChanges(
        redTeamWithScore,
        blueTeamWithScore,
        userElos
      );

      // Update match
      await updateDoc(doc(db, "matches", matchId), {
        status: "completed",
        endedAt: serverTimestamp(),
        eloChanges,
      });

      // Update each player's stats
      const redWon = redScore > blueScore;

      for (const [uid, change] of Object.entries(eloChanges)) {
        const user = participants[uid];
        if (!user) continue;

        const isRed =
          match.redTeam.attacker === uid || match.redTeam.defender === uid;
        const won = isRed ? redWon : !redWon;

        await updateDoc(doc(db, "users", uid), {
          elo: user.elo + change,
          matchesPlayed: user.matchesPlayed + 1,
          wins: user.wins + (won ? 1 : 0),
          losses: user.losses + (won ? 0 : 1),
        });
      }
    },

    startTimer: () => {
      if (timerInterval) clearInterval(timerInterval);
      set({ timerRunning: true });
      timerInterval = setInterval(() => {
        set((state) => ({ timer: state.timer + 1 }));
      }, 1000);
    },

    stopTimer: () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      set({ timerRunning: false });
    },

    resetTimer: () => {
      get().stopTimer();
      set({ timer: 0 });
    },
  };
});
