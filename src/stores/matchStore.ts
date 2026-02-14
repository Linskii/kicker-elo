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
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Match, User } from "../types";
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
  invitePlayer: (matchId: string, playerUid: string) => Promise<void>;
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
  completeMatch: (matchId: string) => Promise<void>;

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

    invitePlayer: async (matchId, playerUid) => {
      await updateDoc(doc(db, "matches", matchId), {
        participants: arrayUnion(playerUid),
      });
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
      await updateDoc(doc(db, "matches", matchId), {
        [`${team}Team.score`]: currentScore + 1,
        events: arrayUnion({
          type: "goal",
          team,
          time: new Date().toISOString(),
        }),
      });

      // Check win condition after update
      const newScore = currentScore + 1;
      const otherTeam = team === "red" ? "blue" : "red";
      const otherScore = match[`${otherTeam}Team`].score;

      // Win condition: First to 10 with 2 point lead
      if (newScore >= 10 && newScore - otherScore >= 2) {
        await get().completeMatch(matchId);
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

    completeMatch: async (matchId) => {
      const match = get().currentMatch;
      const participants = get().participants;
      if (!match) return;

      get().stopTimer();

      // Calculate Elo changes
      const userElos: Record<string, number> = {};
      for (const [uid, user] of Object.entries(participants)) {
        userElos[uid] = user.elo;
      }

      const eloChanges = calculateMatchEloChanges(
        match.redTeam,
        match.blueTeam,
        userElos
      );

      // Update match
      await updateDoc(doc(db, "matches", matchId), {
        status: "completed",
        endedAt: serverTimestamp(),
        eloChanges,
      });

      // Update each player's stats
      const redWon = match.redTeam.score > match.blueTeam.score;

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
