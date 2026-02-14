// Elo calculation constants
const K = 32; // K-factor: how much a single match affects rating
const C = 400; // Scaling constant for expected score calculation

/**
 * Calculate expected score using Elo formula
 * E = 1 / (1 + 10^((Rb - Ra) / C))
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / C));
}

/**
 * Calculate new Elo rating after a match
 * Rnew = Rold + K × (Actual - Expected)
 */
export function calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number // 1 for win, 0 for loss
): number {
  return Math.round(currentRating + K * (actualScore - expectedScore));
}

/**
 * Calculate Elo change (delta) for a match
 */
export function calculateEloChange(
  currentRating: number,
  opponentRating: number,
  won: boolean
): number {
  const expected = expectedScore(currentRating, opponentRating);
  const actual = won ? 1 : 0;
  return Math.round(K * (actual - expected));
}

export interface Team {
  attacker: string | null;
  defender: string | null;
  score: number;
}

export interface EloChanges {
  [uid: string]: number;
}

/**
 * Calculate team's average Elo rating
 */
export function getTeamRating(
  team: Team,
  userElos: Record<string, number>
): number {
  const players = [team.attacker, team.defender].filter(Boolean) as string[];
  if (players.length === 0) return 1000;

  const totalElo = players.reduce(
    (sum, uid) => sum + (userElos[uid] || 1000),
    0
  );
  return totalElo / players.length;
}

/**
 * Get all player UIDs from a team
 */
export function getTeamPlayers(team: Team): string[] {
  return [team.attacker, team.defender].filter(Boolean) as string[];
}

/**
 * Calculate Elo changes for all players in a match
 */
export function calculateMatchEloChanges(
  redTeam: Team,
  blueTeam: Team,
  userElos: Record<string, number>
): EloChanges {
  const redRating = getTeamRating(redTeam, userElos);
  const blueRating = getTeamRating(blueTeam, userElos);

  const redWon = redTeam.score > blueTeam.score;
  const redExpected = expectedScore(redRating, blueRating);
  const blueExpected = expectedScore(blueRating, redRating);

  const redEloChange = Math.round(K * ((redWon ? 1 : 0) - redExpected));
  const blueEloChange = Math.round(K * ((redWon ? 0 : 1) - blueExpected));

  const eloChanges: EloChanges = {};

  for (const uid of getTeamPlayers(redTeam)) {
    eloChanges[uid] = redEloChange;
  }

  for (const uid of getTeamPlayers(blueTeam)) {
    eloChanges[uid] = blueEloChange;
  }

  return eloChanges;
}
