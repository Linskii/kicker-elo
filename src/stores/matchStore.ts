import { create } from "zustand";
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc,
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
  completeMatch: (matchId: string, finalRedScore?: number, finalBlueScore?: number) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  editCompletedMatch: (
    matchId: string,
    newRedTeam: { attacker: string | null; defender: string | null },
    newBlueTeam: { attacker: string | null; defender: string | null },
    newRedScore: number,
    newBlueScore: number
  ) => Promise<void>;

  // Lobby viewer tracking
  joinLobby: (matchId: string, userUid: string) => Promise<void>;
  leaveLobby: (matchId: string, userUid: string) => Promise<void>;
  deleteLobby: (matchId: string) => Promise<void>;

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
      const newMatch = {
        status: "lobby" as const,
        participants: [creatorUid],
        redTeam: { attacker: null, defender: null, score: 0 },
        blueTeam: { attacker: null, defender: null, score: 0 },
        events: [],
        createdBy: creatorUid,
        createdAt: serverTimestamp(),
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
      // Friends are always trusted - auto-join directly to participants
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

      // Snapshot pre-match ELOs and calculate changes
      const preMatchElos: Record<string, number> = {};
      for (const [uid, user] of Object.entries(participants)) {
        preMatchElos[uid] = user.elo;
      }

      const eloChanges = calculateMatchEloChanges(
        redTeamWithScore,
        blueTeamWithScore,
        preMatchElos
      );

      // Update match - include final scores so the result page displays them correctly
      await updateDoc(doc(db, "matches", matchId), {
        status: "completed",
        endedAt: serverTimestamp(),
        eloChanges,
        preMatchElos,
        "redTeam.score": redScore,
        "blueTeam.score": blueScore,
      });

      // Update each player's stats using fresh Firestore data to avoid stale-state permission errors
      const redWon = redScore > blueScore;

      for (const [uid, change] of Object.entries(eloChanges)) {
        const freshSnap = await getDoc(doc(db, "users", uid));
        if (!freshSnap.exists()) continue;
        const freshUser = { uid: freshSnap.id, ...freshSnap.data() } as User;

        const isRed =
          match.redTeam.attacker === uid || match.redTeam.defender === uid;
        const won = isRed ? redWon : !redWon;

        await updateDoc(doc(db, "users", uid), {
          elo: freshUser.elo + change,
          matchesPlayed: freshUser.matchesPlayed + 1,
          wins: freshUser.wins + (won ? 1 : 0),
          losses: freshUser.losses + (won ? 0 : 1),
        });
      }
    },

    deleteMatch: async (matchId) => {
      const matchRef = doc(db, "matches", matchId);
      const matchSnap = await getDoc(matchRef);
      if (!matchSnap.exists()) return;
      const match = matchSnap.data() as Match;
      if (match.status !== "live") return;
      await deleteDoc(matchRef);
    },

    editCompletedMatch: async (matchId, newRedTeam, newBlueTeam, newRedScore, newBlueScore) => {
      const matchSnap = await getDoc(doc(db, "matches", matchId));
      if (!matchSnap.exists()) return;
      const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

      const oldEloChanges = match.eloChanges ?? {};
      const preMatchElos = match.preMatchElos ?? {};
      const oldRedWon = match.redTeam.score > match.blueTeam.score;
      const newRedWon = newRedScore > newBlueScore;

      const newRedTeamWithScore = { ...newRedTeam, score: newRedScore };
      const newBlueTeamWithScore = { ...newBlueTeam, score: newBlueScore };

      const newEloChanges = calculateMatchEloChanges(
        newRedTeamWithScore,
        newBlueTeamWithScore,
        preMatchElos
      );

      // Only update players who were on a team in the old or new match
      const teamPlayerUids = new Set([
        ...Object.keys(oldEloChanges),
        ...Object.keys(newEloChanges),
      ]);

      // Fetch current user data for team players only
      const userDocs: Record<string, User> = {};
      for (const uid of teamPlayerUids) {
        const ud = await getDoc(doc(db, "users", uid));
        if (ud.exists()) userDocs[uid] = { uid: ud.id, ...ud.data() } as User;
      }

      // Update match document
      await updateDoc(doc(db, "matches", matchId), {
        redTeam: newRedTeamWithScore,
        blueTeam: newBlueTeamWithScore,
        eloChanges: newEloChanges,
      });

      // Apply net ELO delta and update wins/losses if outcome changed
      for (const uid of teamPlayerUids) {
        const user = userDocs[uid];
        if (!user) continue;

        const oldChange = oldEloChanges[uid] ?? 0;
        const newChange = newEloChanges[uid] ?? 0;
        const netEloDelta = newChange - oldChange;

        const wasOnOldRed =
          match.redTeam.attacker === uid || match.redTeam.defender === uid;
        const isOnNewRed =
          newRedTeam.attacker === uid || newRedTeam.defender === uid;
        const oldWon = wasOnOldRed ? oldRedWon : !oldRedWon;
        const newWon = isOnNewRed ? newRedWon : !newRedWon;

        const winsDelta = (newWon ? 1 : 0) - (oldWon ? 1 : 0);
        const lossesDelta = (newWon ? 0 : 1) - (oldWon ? 0 : 1);

        await updateDoc(doc(db, "users", uid), {
          elo: user.elo + netEloDelta,
          wins: user.wins + winsDelta,
          losses: user.losses + lossesDelta,
        });
      }
    },

    joinLobby: async (matchId, userUid) => {
      const matchRef = doc(db, "matches", matchId);
      const matchSnap = await getDoc(matchRef);
      if (!matchSnap.exists()) return;
      if (matchSnap.data().status !== "lobby") return;
      await updateDoc(matchRef, {
        viewers: arrayUnion(userUid),
      });
    },

    leaveLobby: async (matchId, userUid) => {
      const matchRef = doc(db, "matches", matchId);
      const matchSnap = await getDoc(matchRef);

      if (!matchSnap.exists()) return;

      const match = matchSnap.data() as Match;

      // Only delete if match is still in lobby status
      if (match.status !== "lobby") return;

      const currentViewers = match.viewers || [];
      const newViewers = currentViewers.filter((uid: string) => uid !== userUid);

      if (newViewers.length === 0) {
        // Last viewer left, delete the lobby
        await deleteDoc(matchRef);
      } else {
        // Remove this viewer
        await updateDoc(matchRef, {
          viewers: arrayRemove(userUid),
        });
      }
    },

    deleteLobby: async (matchId) => {
      const matchRef = doc(db, "matches", matchId);
      const matchSnap = await getDoc(matchRef);

      if (!matchSnap.exists()) return;

      const match = matchSnap.data() as Match;

      // Only delete if match is still in lobby status
      if (match.status !== "lobby") return;

      await deleteDoc(matchRef);
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
