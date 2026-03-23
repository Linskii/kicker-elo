import { create } from 'zustand';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { Season, SeasonsConfig, User, SeasonPlayer } from '../types/index.ts';
import { computeTeamElo, formatSeasonId, formatSeasonLabel } from '../utils/elo.ts';

interface SeasonState {
  seasons: Season[];
  currentSeasonConfig: SeasonsConfig | null;
  fetchSeasons: () => Promise<void>;
  fetchSeasonById: (seasonId: string) => Promise<Season | null>;
  fetchCurrentSeasonConfig: () => Promise<void>;
  adminInitSeason: () => Promise<void>;
  adminCloseSeason: () => Promise<void>;
  adminUpdateSeasonLabel: (seasonId: string, label: string) => Promise<void>;
}

export const useSeasonStore = create<SeasonState>((set, get) => ({
  seasons: [],
  currentSeasonConfig: null,

  fetchSeasons: async () => {
    const q = query(collection(db, 'seasons'), orderBy('endedAt', 'desc'));
    const snap = await getDocs(q);
    const seasons = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Season);
    set({ seasons });
  },

  fetchSeasonById: async (seasonId) => {
    const snap = await getDoc(doc(db, 'seasons', seasonId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as Season;
  },

  fetchCurrentSeasonConfig: async () => {
    const snap = await getDoc(doc(db, 'config', 'seasons'));
    if (snap.exists()) {
      set({ currentSeasonConfig: snap.data() as SeasonsConfig });
    }
  },

  adminInitSeason: async () => {
    const seasonId = formatSeasonId(new Date());
    await setDoc(doc(db, 'config', 'seasons'), { currentSeasonId: seasonId });
    await get().fetchCurrentSeasonConfig();
  },

  adminCloseSeason: async () => {
    await runTransaction(db, async (txn) => {
      const configRef = doc(db, 'config', 'seasons');
      const configSnap = await txn.get(configRef);
      if (!configSnap.exists()) throw new Error('Season config not found');
      const config = configSnap.data() as SeasonsConfig;
      const currentSeasonId = config.currentSeasonId;

      // Read all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: User[] = usersSnap.docs.map((d) => ({ ...d.data(), uid: d.id }) as User);

      // Read season stats for all users
      const statsMap: Record<string, { attackMatchesPlayed: number; defenseMatchesPlayed: number; soloMatchesPlayed: number }> = {};
      for (const user of users) {
        const statsSnap = await getDoc(doc(db, 'users', user.uid, 'seasonStats', currentSeasonId));
        if (statsSnap.exists()) {
          statsMap[user.uid] = statsSnap.data() as { attackMatchesPlayed: number; defenseMatchesPlayed: number; soloMatchesPlayed: number };
        }
      }

      // Build leaderboards
      const teamLeaderboard: SeasonPlayer[] = [];
      const soloLeaderboard: SeasonPlayer[] = [];

      for (const user of users) {
        const stats = statsMap[user.uid] ?? null;
        if (user.teamRanked) {
          const tElo = computeTeamElo(user.attackElo, user.defenseElo, stats);
          if (tElo !== null) {
            teamLeaderboard.push({
              uid: user.uid,
              username: user.username,
              attackElo: user.attackElo,
              defenseElo: user.defenseElo,
              soloElo: user.soloElo,
              teamElo: tElo,
              wins: user.wins,
              losses: user.losses,
            });
          }
        }
        if (user.soloRanked) {
          const tElo = computeTeamElo(user.attackElo, user.defenseElo, stats);
          soloLeaderboard.push({
            uid: user.uid,
            username: user.username,
            attackElo: user.attackElo,
            defenseElo: user.defenseElo,
            soloElo: user.soloElo,
            teamElo: tElo ?? 1000,
            wins: user.wins,
            losses: user.losses,
          });
        }
      }

      teamLeaderboard.sort((a, b) => b.teamElo - a.teamElo);
      soloLeaderboard.sort((a, b) => b.soloElo - a.soloElo);

      // Parse current season for label
      const label = formatSeasonLabel(currentSeasonId);
      const [yearStr, monthStr] = currentSeasonId.split('-');

      // Write season document
      txn.set(doc(db, 'seasons', currentSeasonId), {
        id: currentSeasonId,
        label,
        year: Number(yearStr),
        month: Number(monthStr),
        status: 'completed',
        endedAt: serverTimestamp(),
        teamLeaderboard,
        soloLeaderboard,
      });

      // Pick a new season ID that doesn't clash with the closed one or existing snapshots
      const baseId = formatSeasonId(new Date());
      let newSeasonId = baseId;
      let counter = 2;
      while (true) {
        if (newSeasonId !== currentSeasonId) {
          const existing = await txn.get(doc(db, 'seasons', newSeasonId));
          if (!existing.exists()) break;
        }
        newSeasonId = `${baseId}-${counter}`;
        counter++;
      }
      txn.update(configRef, { currentSeasonId: newSeasonId });

      // Reset all users — must use batch outside transaction
      // Since we can't do more than 500 writes in a transaction, use the transaction for smaller sets
      for (const user of users) {
        txn.update(doc(db, 'users', user.uid), {
          attackElo: 1000,
          defenseElo: 1000,
          soloElo: 1000,
          wins: 0,
          losses: 0,
          teamRanked: false,
          soloRanked: false,
        });
      }
    });

    // Refresh data
    await get().fetchSeasons();
    await get().fetchCurrentSeasonConfig();
  },

  adminUpdateSeasonLabel: async (seasonId, label) => {
    await updateDoc(doc(db, 'seasons', seasonId), { label });
    set((state) => ({
      seasons: state.seasons.map((s) => (s.id === seasonId ? { ...s, label } : s)),
    }));
  },
}));
