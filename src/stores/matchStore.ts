import { create } from 'zustand';
import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type {
  Match,
  User,
  TeamSlot,
  PlayerEloSnapshot,
  PlayerEloChange,
  UserSeasonStats,
  EloHistoryEntry,
} from '../types/index.ts';
import {
  marginMultiplier,
  calculateEloChange,
  computeNewRating,
  getKFactor,
  isTeamRanked,
  isSoloRanked,
  formatSeasonId,
} from '../utils/elo.ts';

interface MatchState {
  match: Match | null;
  participants: Record<string, User>;
  subscribeToMatch: (matchId: string) => () => void;
  createMatch: (creatorUid: string) => Promise<string>;
  invitePlayer: (matchId: string, friendUid: string) => Promise<void>;
  removePlayer: (matchId: string, playerUid: string) => Promise<void>;
  assignToTeam: (matchId: string, playerUid: string, slot: TeamSlot) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  completeMatch: (matchId: string, redScore: number, blueScore: number) => Promise<void>;
  editCompletedMatch: (
    matchId: string,
    newSlots: Partial<Pick<Match, 'redAttacker' | 'redDefender' | 'blueAttacker' | 'blueDefender' | 'playerRed' | 'playerBlue'>>,
    newRedScore: number,
    newBlueScore: number,
  ) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  createRematch: (matchId: string) => Promise<string>;
}

function buildEloHistoryEntry(
  endedAt: Timestamp,
  attackElo: number,
  defenseElo: number,
  soloElo: number,
): EloHistoryEntry {
  return { t: endedAt, a: attackElo, d: defenseElo, s: soloElo };
}

export const useMatchStore = create<MatchState>((set, _get) => ({
  match: null,
  participants: {},

  subscribeToMatch: (matchId) => {
    const matchRef = doc(db, 'matches', matchId);
    const participantUnsubs: Record<string, () => void> = {};

    const unsubMatch = onSnapshot(matchRef, (snap) => {
      if (!snap.exists()) {
        set({ match: null, participants: {} });
        return;
      }
      const matchData = { ...snap.data(), id: snap.id } as Match;
      set({ match: matchData });

      const currentParticipants = matchData.participants;
      for (const uid of Object.keys(participantUnsubs)) {
        if (!currentParticipants.includes(uid)) {
          participantUnsubs[uid]();
          delete participantUnsubs[uid];
          set((state) => {
            const next = { ...state.participants };
            delete next[uid];
            return { participants: next };
          });
        }
      }
      for (const uid of currentParticipants) {
        if (!participantUnsubs[uid]) {
          participantUnsubs[uid] = onSnapshot(doc(db, 'users', uid), (userSnap) => {
            if (userSnap.exists()) {
              set((state) => ({
                participants: {
                  ...state.participants,
                  [uid]: { ...userSnap.data(), uid: userSnap.id } as User,
                },
              }));
            }
          });
        }
      }
    });

    return () => {
      unsubMatch();
      for (const unsub of Object.values(participantUnsubs)) unsub();
    };
  },

  createMatch: async (creatorUid) => {
    const matchRef = doc(collection(db, 'matches'));
    const matchData: Omit<Match, 'id'> = {
      type: 'solo',
      status: 'lobby',
      createdBy: creatorUid,
      participants: [creatorUid],
      redAttacker: null,
      redDefender: null,
      blueAttacker: null,
      blueDefender: null,
      playerRed: null,
      playerBlue: null,
      redScore: 0,
      blueScore: 0,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };
    await setDoc(matchRef, matchData);
    return matchRef.id;
  },

  invitePlayer: async (matchId, friendUid) => {
    const matchRef = doc(db, 'matches', matchId);
    const snap = await getDoc(matchRef);
    if (!snap.exists()) return;
    const match = snap.data() as Match;
    const newCount = match.participants.length + 1;
    const updates: Record<string, unknown> = {
      participants: arrayUnion(friendUid),
    };
    if (newCount === 2) updates.type = 'solo';
    if (newCount >= 3) updates.type = 'team';
    await updateDoc(matchRef, updates);
  },

  removePlayer: async (matchId, playerUid) => {
    const matchRef = doc(db, 'matches', matchId);
    const snap = await getDoc(matchRef);
    if (!snap.exists()) return;
    const match = snap.data() as Match;

    const slotClears: Record<string, null> = {};
    const slotFields: TeamSlot[] = ['redAttacker', 'redDefender', 'blueAttacker', 'blueDefender', 'playerRed', 'playerBlue'];
    for (const slot of slotFields) {
      if (match[slot] === playerUid) slotClears[slot] = null;
    }

    const newParticipants = match.participants.filter((uid) => uid !== playerUid);
    if (newParticipants.length === 0) {
      await deleteDoc(matchRef);
      return;
    }

    const updates: Record<string, unknown> = {
      participants: arrayRemove(playerUid),
      ...slotClears,
    };
    if (newParticipants.length <= 2) updates.type = 'solo';
    await updateDoc(matchRef, updates);
  },

  assignToTeam: async (matchId, playerUid, slot) => {
    const matchRef = doc(db, 'matches', matchId);
    const snap = await getDoc(matchRef);
    if (!snap.exists()) return;
    const match = snap.data() as Match;

    const updates: Record<string, string | null> = {};
    const slotFields: TeamSlot[] = ['redAttacker', 'redDefender', 'blueAttacker', 'blueDefender', 'playerRed', 'playerBlue'];
    for (const s of slotFields) {
      if (match[s] === playerUid && s !== slot) updates[s] = null;
    }
    for (const s of slotFields) {
      if (s === slot && match[s] !== null && match[s] !== playerUid) {
        // Slot occupied by someone else — swap them out
      }
    }
    updates[slot] = playerUid;
    await updateDoc(matchRef, updates);
  },

  startMatch: async (matchId) => {
    await updateDoc(doc(db, 'matches', matchId), {
      status: 'live',
      startedAt: serverTimestamp(),
    });
  },

  completeMatch: async (matchId, redScore, blueScore) => {
    await runTransaction(db, async (txn) => {
      const configSnap = await txn.get(doc(db, 'config', 'seasons'));
      const seasonId = configSnap.exists()
        ? (configSnap.data() as { currentSeasonId: string }).currentSeasonId
        : formatSeasonId(new Date());

      const matchRef = doc(db, 'matches', matchId);
      const matchSnap = await txn.get(matchRef);
      if (!matchSnap.exists()) throw new Error('Match not found');
      const match = { ...matchSnap.data(), id: matchSnap.id } as Match;

      const playerUids = match.participants;
      const userDocs: Record<string, User> = {};
      const seasonStatsDocs: Record<string, UserSeasonStats | null> = {};

      for (const uid of playerUids) {
        const userSnap = await txn.get(doc(db, 'users', uid));
        if (!userSnap.exists()) throw new Error(`User ${uid} not found`);
        userDocs[uid] = { ...userSnap.data(), uid: userSnap.id } as User;

        const statsSnap = await txn.get(doc(db, 'users', uid, 'seasonStats', seasonId));
        seasonStatsDocs[uid] = statsSnap.exists() ? (statsSnap.data() as UserSeasonStats) : null;
      }

      const preMatchElos: Record<string, PlayerEloSnapshot> = {};
      for (const uid of playerUids) {
        const u = userDocs[uid];
        preMatchElos[uid] = {
          attackElo: u.attackElo,
          defenseElo: u.defenseElo,
          soloElo: u.soloElo,
        };
      }

      const redWon = redScore > blueScore;
      const mult = marginMultiplier(
        redWon ? redScore : blueScore,
        redWon ? blueScore : redScore,
      );

      const eloChanges: Record<string, PlayerEloChange> = {};

      if (match.type === 'solo') {
        const redUid = match.playerRed!;
        const blueUid = match.playerBlue!;
        const redElo = userDocs[redUid].soloElo;
        const blueElo = userDocs[blueUid].soloElo;

        const redK = getKFactor(seasonStatsDocs[redUid]?.soloMatchesPlayed ?? 0);
        const blueK = getKFactor(seasonStatsDocs[blueUid]?.soloMatchesPlayed ?? 0);

        const redActual = redWon ? 1 : 0;
        const blueActual = redWon ? 0 : 1;

        const redChange = calculateEloChange(redElo, blueElo, redActual, redK, mult);
        const blueChange = calculateEloChange(blueElo, redElo, blueActual, blueK, mult);

        eloChanges[redUid] = { attackEloDelta: 0, defenseEloDelta: 0, soloEloDelta: redChange };
        eloChanges[blueUid] = { attackEloDelta: 0, defenseEloDelta: 0, soloEloDelta: blueChange };
      } else {
        const redAtkUid = match.redAttacker!;
        const redDefUid = match.redDefender!;
        const blueAtkUid = match.blueAttacker!;
        const blueDefUid = match.blueDefender!;

        const redTeamRating = (userDocs[redAtkUid].attackElo + userDocs[redDefUid].defenseElo) / 2;
        const blueTeamRating = (userDocs[blueAtkUid].attackElo + userDocs[blueDefUid].defenseElo) / 2;

        const redActual = redWon ? 1 : 0;
        const blueActual = redWon ? 0 : 1;

        // Attackers
        const redAtkK = getKFactor(seasonStatsDocs[redAtkUid]?.attackMatchesPlayed ?? 0);
        const blueAtkK = getKFactor(seasonStatsDocs[blueAtkUid]?.attackMatchesPlayed ?? 0);
        const redAtkChange = calculateEloChange(redTeamRating, blueTeamRating, redActual, redAtkK, mult);
        const blueAtkChange = calculateEloChange(blueTeamRating, redTeamRating, blueActual, blueAtkK, mult);

        // Defenders
        const redDefK = getKFactor(seasonStatsDocs[redDefUid]?.defenseMatchesPlayed ?? 0);
        const blueDefK = getKFactor(seasonStatsDocs[blueDefUid]?.defenseMatchesPlayed ?? 0);
        const redDefChange = calculateEloChange(redTeamRating, blueTeamRating, redActual, redDefK, mult);
        const blueDefChange = calculateEloChange(blueTeamRating, redTeamRating, blueActual, blueDefK, mult);

        eloChanges[redAtkUid] = {
          attackEloDelta: redAtkChange,
          defenseEloDelta: 0,
          soloEloDelta: 0,
        };
        eloChanges[redDefUid] = {
          attackEloDelta: 0,
          defenseEloDelta: redDefChange,
          soloEloDelta: 0,
        };
        eloChanges[blueAtkUid] = {
          attackEloDelta: blueAtkChange,
          defenseEloDelta: 0,
          soloEloDelta: 0,
        };
        eloChanges[blueDefUid] = {
          attackEloDelta: 0,
          defenseEloDelta: blueDefChange,
          soloEloDelta: 0,
        };
      }

      // Write match
      const endedAt = Timestamp.now();
      txn.update(matchRef, {
        status: 'completed',
        seasonId,
        preMatchElos,
        eloChanges,
        redScore,
        blueScore,
        endedAt: serverTimestamp(),
      });

      // Update each player
      for (const uid of playerUids) {
        const u = userDocs[uid];
        const change = eloChanges[uid];
        const isWinner = (redWon && isOnRedTeam(match, uid)) || (!redWon && isOnBlueTeam(match, uid));

        const newAttackElo = computeNewRating(u.attackElo, change.attackEloDelta);
        const newDefenseElo = computeNewRating(u.defenseElo, change.defenseEloDelta);
        const newSoloElo = computeNewRating(u.soloElo, change.soloEloDelta);

        const statsRef = doc(db, 'users', uid, 'seasonStats', seasonId);
        const existing = seasonStatsDocs[uid];
        const newStats: UserSeasonStats = {
          seasonId,
          attackMatchesPlayed: (existing?.attackMatchesPlayed ?? 0) +
            (match.type === 'team' && (match.redAttacker === uid || match.blueAttacker === uid) ? 1 : 0),
          defenseMatchesPlayed: (existing?.defenseMatchesPlayed ?? 0) +
            (match.type === 'team' && (match.redDefender === uid || match.blueDefender === uid) ? 1 : 0),
          soloMatchesPlayed: (existing?.soloMatchesPlayed ?? 0) +
            (match.type === 'solo' ? 1 : 0),
        };
        txn.set(statsRef, newStats);

        const newTeamRanked = isTeamRanked(newStats);
        const newSoloRanked = isSoloRanked(newStats);

        const historyEntry = buildEloHistoryEntry(endedAt, newAttackElo, newDefenseElo, newSoloElo);

        txn.update(doc(db, 'users', uid), {
          attackElo: newAttackElo,
          defenseElo: newDefenseElo,
          soloElo: newSoloElo,
          wins: u.wins + (isWinner ? 1 : 0),
          losses: u.losses + (isWinner ? 0 : 1),
          careerWins: u.careerWins + (isWinner ? 1 : 0),
          careerLosses: u.careerLosses + (isWinner ? 0 : 1),
          teamRanked: newTeamRanked,
          soloRanked: newSoloRanked,
          eloHistory: arrayUnion(historyEntry),
        });
      }
    });
  },

  editCompletedMatch: async (matchId, newSlots, newRedScore, newBlueScore) => {
    await runTransaction(db, async (txn) => {
      const matchRef = doc(db, 'matches', matchId);
      const matchSnap = await txn.get(matchRef);
      if (!matchSnap.exists()) throw new Error('Match not found');
      const match = { ...matchSnap.data(), id: matchSnap.id } as Match;

      if (match.status !== 'completed') throw new Error('Match is not completed');
      if (!match.endedAt || !match.preMatchElos || !match.eloChanges) {
        throw new Error('Match missing completion data');
      }

      const now = Timestamp.now();
      const tenMinMs = 10 * 60 * 1000;
      if (now.toMillis() - match.endedAt.toMillis() > tenMinMs) {
        throw new Error('Edit window has expired');
      }

      const oldEloChanges = match.eloChanges;
      const preMatchElos = match.preMatchElos;
      const playerUids = match.participants;
      const oldRedWon = match.redScore > match.blueScore;

      // Read current user docs
      const userDocs: Record<string, User> = {};
      const seasonStatsDocs: Record<string, UserSeasonStats | null> = {};
      const seasonId = match.seasonId!;

      for (const uid of playerUids) {
        const userSnap = await txn.get(doc(db, 'users', uid));
        if (!userSnap.exists()) throw new Error(`User ${uid} not found`);
        userDocs[uid] = { ...userSnap.data(), uid: userSnap.id } as User;

        const statsSnap = await txn.get(doc(db, 'users', uid, 'seasonStats', seasonId));
        seasonStatsDocs[uid] = statsSnap.exists() ? (statsSnap.data() as UserSeasonStats) : null;
      }

      // Build updated match with new slots
      const updatedMatch: Match = {
        ...match,
        ...newSlots,
      };

      // Recalculate ELO from preMatchElos
      const newRedWon = newRedScore > newBlueScore;
      const mult = marginMultiplier(
        newRedWon ? newRedScore : newBlueScore,
        newRedWon ? newBlueScore : newRedScore,
      );

      const newEloChanges: Record<string, PlayerEloChange> = {};

      if (updatedMatch.type === 'solo') {
        const redUid = updatedMatch.playerRed!;
        const blueUid = updatedMatch.playerBlue!;
        const redElo = preMatchElos[redUid].soloElo;
        const blueElo = preMatchElos[blueUid].soloElo;

        const redK = getKFactor((seasonStatsDocs[redUid]?.soloMatchesPlayed ?? 1) - 1);
        const blueK = getKFactor((seasonStatsDocs[blueUid]?.soloMatchesPlayed ?? 1) - 1);

        const redChange = calculateEloChange(redElo, blueElo, newRedWon ? 1 : 0, redK, mult);
        const blueChange = calculateEloChange(blueElo, redElo, newRedWon ? 0 : 1, blueK, mult);

        newEloChanges[redUid] = { attackEloDelta: 0, defenseEloDelta: 0, soloEloDelta: redChange };
        newEloChanges[blueUid] = { attackEloDelta: 0, defenseEloDelta: 0, soloEloDelta: blueChange };
      } else {
        const redAtkUid = updatedMatch.redAttacker!;
        const redDefUid = updatedMatch.redDefender!;
        const blueAtkUid = updatedMatch.blueAttacker!;
        const blueDefUid = updatedMatch.blueDefender!;

        const redTeamRating = (preMatchElos[redAtkUid].attackElo + preMatchElos[redDefUid].defenseElo) / 2;
        const blueTeamRating = (preMatchElos[blueAtkUid].attackElo + preMatchElos[blueDefUid].defenseElo) / 2;

        const redActual = newRedWon ? 1 : 0;
        const blueActual = newRedWon ? 0 : 1;

        const redAtkK = getKFactor((seasonStatsDocs[redAtkUid]?.attackMatchesPlayed ?? 1) - 1);
        const blueAtkK = getKFactor((seasonStatsDocs[blueAtkUid]?.attackMatchesPlayed ?? 1) - 1);
        const redDefK = getKFactor((seasonStatsDocs[redDefUid]?.defenseMatchesPlayed ?? 1) - 1);
        const blueDefK = getKFactor((seasonStatsDocs[blueDefUid]?.defenseMatchesPlayed ?? 1) - 1);

        newEloChanges[redAtkUid] = { attackEloDelta: calculateEloChange(redTeamRating, blueTeamRating, redActual, redAtkK, mult), defenseEloDelta: 0, soloEloDelta: 0 };
        newEloChanges[redDefUid] = { attackEloDelta: 0, defenseEloDelta: calculateEloChange(redTeamRating, blueTeamRating, redActual, redDefK, mult), soloEloDelta: 0 };
        newEloChanges[blueAtkUid] = { attackEloDelta: calculateEloChange(blueTeamRating, redTeamRating, blueActual, blueAtkK, mult), defenseEloDelta: 0, soloEloDelta: 0 };
        newEloChanges[blueDefUid] = { attackEloDelta: 0, defenseEloDelta: calculateEloChange(blueTeamRating, redTeamRating, blueActual, blueDefK, mult), soloEloDelta: 0 };
      }

      // Update match document
      txn.update(matchRef, {
        ...newSlots,
        redScore: newRedScore,
        blueScore: newBlueScore,
        eloChanges: newEloChanges,
      });

      // Update each player: reverse old delta, apply new delta, fix wins/losses
      for (const uid of playerUids) {
        const u = userDocs[uid];
        const oldChange = oldEloChanges[uid];
        const newChange = newEloChanges[uid];

        // Reverse old, apply new
        const newAttackElo = computeNewRating(
          u.attackElo - Math.round(oldChange.attackEloDelta),
          newChange.attackEloDelta,
        );
        const newDefenseElo = computeNewRating(
          u.defenseElo - Math.round(oldChange.defenseEloDelta),
          newChange.defenseEloDelta,
        );
        const newSoloElo = computeNewRating(
          u.soloElo - Math.round(oldChange.soloEloDelta),
          newChange.soloEloDelta,
        );

        // Fix wins/losses
        const wasWinner = (oldRedWon && isOnRedTeam(match, uid)) || (!oldRedWon && isOnBlueTeam(match, uid));
        const isWinner = (newRedWon && isOnRedTeam(updatedMatch, uid)) || (!newRedWon && isOnBlueTeam(updatedMatch, uid));

        let winsAdj = 0;
        let lossesAdj = 0;
        if (wasWinner && !isWinner) { winsAdj = -1; lossesAdj = 1; }
        if (!wasWinner && isWinner) { winsAdj = 1; lossesAdj = -1; }

        // Update eloHistory — find entry matching endedAt and overwrite
        const newHistory = u.eloHistory.map((entry) => {
          if (entry.t.toMillis() === match.endedAt!.toMillis()) {
            return buildEloHistoryEntry(entry.t, newAttackElo, newDefenseElo, newSoloElo);
          }
          return entry;
        });

        txn.update(doc(db, 'users', uid), {
          attackElo: newAttackElo,
          defenseElo: newDefenseElo,
          soloElo: newSoloElo,
          wins: u.wins + winsAdj,
          losses: u.losses + lossesAdj,
          careerWins: u.careerWins + winsAdj,
          careerLosses: u.careerLosses + lossesAdj,
          eloHistory: newHistory,
        });
      }
    });
  },

  deleteMatch: async (matchId) => {
    await deleteDoc(doc(db, 'matches', matchId));
  },

  createRematch: async (matchId) => {
    const snap = await getDoc(doc(db, 'matches', matchId));
    if (!snap.exists()) throw new Error('Match not found');
    const old = snap.data() as Match;

    const newMatchRef = doc(collection(db, 'matches'));
    const newMatch: Omit<Match, 'id'> = {
      type: old.type,
      status: 'lobby',
      createdBy: old.createdBy,
      participants: old.participants,
      redAttacker: old.redAttacker,
      redDefender: old.redDefender,
      blueAttacker: old.blueAttacker,
      blueDefender: old.blueDefender,
      playerRed: old.playerRed,
      playerBlue: old.playerBlue,
      redScore: 0,
      blueScore: 0,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };
    await setDoc(newMatchRef, newMatch);
    return newMatchRef.id;
  },
}));

function isOnRedTeam(match: Match, uid: string): boolean {
  return match.playerRed === uid || match.redAttacker === uid || match.redDefender === uid;
}

function isOnBlueTeam(match: Match, uid: string): boolean {
  return match.playerBlue === uid || match.blueAttacker === uid || match.blueDefender === uid;
}

export { isOnRedTeam, isOnBlueTeam };
