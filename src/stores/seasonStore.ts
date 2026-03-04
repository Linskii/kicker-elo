import { create } from "zustand";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Season, SeasonPlayer } from "../types";

// --- Utility helpers ---

function getYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function makeLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

async function buildLeaderboardSnapshot(): Promise<SeasonPlayer[]> {
  const q = query(collection(db, "users"), orderBy("elo", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      username: data.username,
      elo: data.elo,
      wins: data.wins,
      losses: data.losses,
      matchesPlayed: data.matchesPlayed,
    };
  });
}

async function resetAllUserElos(): Promise<void> {
  const usersSnap = await getDocs(collection(db, "users"));
  const BATCH_SIZE = 500;
  const docs = usersSnap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const userDoc of docs.slice(i, i + BATCH_SIZE)) {
      batch.update(userDoc.ref, { elo: 1000 });
    }
    await batch.commit();
  }
}

// --- Exported: called from matchStore before completing a match ---

export async function checkAndTransitionSeason(): Promise<string> {
  const todayYearMonth = getYearMonth(new Date());
  const configRef = doc(db, "config", "seasons");

  const configSnap = await getDoc(configRef);

  // Bootstrap: no config doc yet
  if (!configSnap.exists()) {
    await setDoc(configRef, { currentSeasonId: todayYearMonth });
    return todayYearMonth;
  }

  const currentSeasonId = configSnap.data().currentSeasonId as string;

  // Fast path: still in the same month
  if (currentSeasonId === todayYearMonth) {
    return todayYearMonth;
  }

  // Month changed — snapshot leaderboard before entering transaction
  const leaderboardSnapshot = await buildLeaderboardSnapshot();
  const oldSeasonRef = doc(db, "seasons", currentSeasonId);
  const [year, month] = currentSeasonId.split("-").map(Number);
  const label = makeLabel(currentSeasonId);

  let shouldResetElos = false;

  await runTransaction(db, async (transaction) => {
    const txConfigSnap = await transaction.get(configRef);
    const txCurrentId = txConfigSnap.exists()
      ? (txConfigSnap.data().currentSeasonId as string)
      : null;

    // Another client already completed the transition
    if (txCurrentId === todayYearMonth) return;

    const oldSeasonSnap = await transaction.get(oldSeasonRef);

    if (!oldSeasonSnap.exists()) {
      // We are the first client to close this season
      shouldResetElos = true;
      transaction.set(oldSeasonRef, {
        id: currentSeasonId,
        label,
        year,
        month,
        status: "completed",
        endedAt: serverTimestamp(),
        leaderboard: leaderboardSnapshot,
      });
    }

    transaction.update(configRef, { currentSeasonId: todayYearMonth });
  });

  if (shouldResetElos) {
    await resetAllUserElos();
  }

  return todayYearMonth;
}

// --- Admin-only actions ---

export async function adminCloseSeason(): Promise<void> {
  const configRef = doc(db, "config", "seasons");
  const configSnap = await getDoc(configRef);

  const todayYearMonth = getYearMonth(new Date());
  const currentSeasonId = configSnap.exists()
    ? (configSnap.data().currentSeasonId as string)
    : todayYearMonth;

  const leaderboardSnapshot = await buildLeaderboardSnapshot();
  const [year, month] = currentSeasonId.split("-").map(Number);
  const label = makeLabel(currentSeasonId);

  await setDoc(doc(db, "seasons", currentSeasonId), {
    id: currentSeasonId,
    label,
    year,
    month,
    status: "completed",
    endedAt: serverTimestamp(),
    leaderboard: leaderboardSnapshot,
  });

  await updateDoc(configRef, { currentSeasonId: todayYearMonth });
  await resetAllUserElos();
}

export async function adminBootstrapPastSeason(yearMonth: string): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error("Invalid format. Use YYYY-MM.");
  }

  const seasonRef = doc(db, "seasons", yearMonth);
  const existing = await getDoc(seasonRef);
  if (existing.exists()) {
    throw new Error(`Season ${yearMonth} already exists.`);
  }

  const leaderboardSnapshot = await buildLeaderboardSnapshot();
  const [year, month] = yearMonth.split("-").map(Number);
  const label = makeLabel(yearMonth);

  await setDoc(seasonRef, {
    id: yearMonth,
    label,
    year,
    month,
    status: "completed",
    endedAt: serverTimestamp(),
    leaderboard: leaderboardSnapshot,
  });
}

export async function adminDeleteSeason(seasonId: string): Promise<void> {
  await deleteDoc(doc(db, "seasons", seasonId));
}

export async function adminUpdateSeasonLabel(seasonId: string, label: string): Promise<void> {
  await updateDoc(doc(db, "seasons", seasonId), { label });
}

// --- Zustand store for reading seasons in the UI ---

interface SeasonState {
  seasons: Season[];
  loading: boolean;
  fetchSeasons: () => Promise<void>;
  fetchSeasonById: (seasonId: string) => Promise<Season | null>;
}

export const useSeasonStore = create<SeasonState>((set) => ({
  seasons: [],
  loading: false,

  fetchSeasons: async () => {
    set({ loading: true });
    try {
      // No orderBy needed — sort client-side to avoid requiring a composite index
      const snap = await getDocs(query(collection(db, "seasons"), limit(24)));
      const seasons = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Season)
        .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
      set({ seasons, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchSeasonById: async (seasonId: string) => {
    try {
      const snap = await getDoc(doc(db, "seasons", seasonId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Season;
    } catch {
      return null;
    }
  },
}));
