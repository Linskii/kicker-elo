import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// Elo calculation constants
const K = 32; // K-factor: how much a single match affects rating
const C = 400; // Scaling constant for expected score calculation

interface Team {
  attacker: string | null;
  defender: string | null;
  score: number;
}

interface MatchData {
  status: "lobby" | "live" | "completed";
  participants: string[];
  redTeam: Team;
  blueTeam: Team;
  eloChanges?: Record<string, number>;
}

interface UserData {
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

/**
 * Calculate expected score using Elo formula
 * E = 1 / (1 + 10^((Rb - Ra) / C))
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / C));
}

/**
 * Calculate team's average Elo rating
 */
function getTeamRating(team: Team, userElos: Record<string, number>): number {
  const players = [team.attacker, team.defender].filter(Boolean) as string[];
  if (players.length === 0) return 1000;

  const totalElo = players.reduce((sum, uid) => sum + (userElos[uid] || 1000), 0);
  return totalElo / players.length;
}

/**
 * Get all player UIDs from a team
 */
function getTeamPlayers(team: Team): string[] {
  return [team.attacker, team.defender].filter(Boolean) as string[];
}

/**
 * Cloud Function: Calculate and update Elo when a match completes
 */
export const onMatchCompleted = onDocumentUpdated(
  "matches/{matchId}",
  async (event) => {
    const beforeData = event.data?.before.data() as MatchData | undefined;
    const afterData = event.data?.after.data() as MatchData | undefined;

    if (!beforeData || !afterData) {
      console.log("Missing data, skipping");
      return;
    }

    // Only process when match transitions to 'completed'
    if (beforeData.status === "completed" || afterData.status !== "completed") {
      return;
    }

    // Don't recalculate if eloChanges already exist
    if (afterData.eloChanges && Object.keys(afterData.eloChanges).length > 0) {
      console.log("Elo already calculated, skipping");
      return;
    }

    console.log(`Processing match completion: ${event.params.matchId}`);

    const { redTeam, blueTeam, participants } = afterData;

    // Fetch current Elo ratings for all participants
    const userElos: Record<string, number> = {};
    const userDocs = await Promise.all(
      participants.map((uid) => db.collection("users").doc(uid).get())
    );

    userDocs.forEach((doc) => {
      if (doc.exists) {
        userElos[doc.id] = (doc.data() as UserData).elo || 1000;
      } else {
        userElos[doc.id] = 1000;
      }
    });

    // Calculate team ratings
    const redRating = getTeamRating(redTeam, userElos);
    const blueRating = getTeamRating(blueTeam, userElos);

    // Determine winner (actual scores: 1 for win, 0 for loss)
    const redWon = redTeam.score > blueTeam.score;
    const redActual = redWon ? 1 : 0;
    const blueActual = redWon ? 0 : 1;

    // Calculate expected scores
    const redExpected = expectedScore(redRating, blueRating);
    const blueExpected = expectedScore(blueRating, redRating);

    // Calculate Elo changes for each team
    const redEloChange = Math.round(K * (redActual - redExpected));
    const blueEloChange = Math.round(K * (blueActual - blueExpected));

    // Build eloChanges map and update users
    const eloChanges: Record<string, number> = {};
    const batch = db.batch();

    const redPlayers = getTeamPlayers(redTeam);
    const bluePlayers = getTeamPlayers(blueTeam);

    // Update red team players
    for (const uid of redPlayers) {
      eloChanges[uid] = redEloChange;
      const userRef = db.collection("users").doc(uid);
      batch.update(userRef, {
        elo: FieldValue.increment(redEloChange),
        matchesPlayed: FieldValue.increment(1),
        ...(redWon ? { wins: FieldValue.increment(1) } : { losses: FieldValue.increment(1) }),
      });
    }

    // Update blue team players
    for (const uid of bluePlayers) {
      eloChanges[uid] = blueEloChange;
      const userRef = db.collection("users").doc(uid);
      batch.update(userRef, {
        elo: FieldValue.increment(blueEloChange),
        matchesPlayed: FieldValue.increment(1),
        ...(redWon ? { losses: FieldValue.increment(1) } : { wins: FieldValue.increment(1) }),
      });
    }

    // Update match document with Elo changes
    batch.update(event.data!.after.ref, { eloChanges });

    await batch.commit();

    console.log(`Elo updated for match ${event.params.matchId}:`, eloChanges);
  }
);
