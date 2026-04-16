export interface SeasonStatsLike {
  attackMatchesPlayed: number;
  defenseMatchesPlayed: number;
  soloMatchesPlayed: number;
}

export const ELO_CONFIG = {
  K_NORMAL: 32,
  K_PLACEMENT: 64,
  PLACEMENT_MATCHES_REQUIRED: 3,
  MAX_ELO_CHANGE: 50,
  C: 400,
  MARGIN_MULTIPLIER_MAX: 2.0,
  MARGIN_MIN_DIFF: 2,
  MARGIN_MAX_DIFF: 10,
} as const;

export function marginMultiplier(winnerScore: number, loserScore: number): number {
  const diff = Math.min(
    Math.max(Math.abs(winnerScore - loserScore), ELO_CONFIG.MARGIN_MIN_DIFF),
    ELO_CONFIG.MARGIN_MAX_DIFF,
  );
  return (
    1 +
    ((diff - ELO_CONFIG.MARGIN_MIN_DIFF) / (ELO_CONFIG.MARGIN_MAX_DIFF - ELO_CONFIG.MARGIN_MIN_DIFF)) *
      (ELO_CONFIG.MARGIN_MULTIPLIER_MAX - 1)
  );
}

/**
 * Zero-sum ELO change. Returns the integer delta for player A;
 * player B's delta is always the exact negation (−result).
 * K-factors are averaged so placement volatility is shared fairly.
 */
export function calculateZeroSumChange(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
  kA: number,
  kB: number,
  multiplier: number,
): number {
  const kAvg = (kA + kB) / 2;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / ELO_CONFIG.C));
  const actualA = aWon ? 1 : 0;
  const raw = kAvg * (actualA - expectedA) * multiplier;
  const clamped = Math.max(-ELO_CONFIG.MAX_ELO_CHANGE, Math.min(ELO_CONFIG.MAX_ELO_CHANGE, raw));
  return Math.round(clamped);
}

export function computeNewRating(oldRating: number, change: number): number {
  return Math.round(oldRating + change);
}

export function getKFactor(matchesPlayed: number): number {
  return matchesPlayed < ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED
    ? ELO_CONFIG.K_PLACEMENT
    : ELO_CONFIG.K_NORMAL;
}

export function computeTeamElo(
  attackElo: number,
  defenseElo: number,
  stats: SeasonStatsLike | null,
): number | null {
  const atkPlayed = stats?.attackMatchesPlayed ?? 0;
  const defPlayed = stats?.defenseMatchesPlayed ?? 0;
  const req = ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;

  if (atkPlayed >= req && defPlayed >= req) {
    return Math.round((attackElo + defenseElo) / 2);
  }
  if (atkPlayed >= req) {
    return attackElo;
  }
  if (defPlayed >= req) {
    return defenseElo;
  }
  return null;
}

export function isTeamRanked(stats: SeasonStatsLike | null): boolean {
  const req = ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;
  return (
    (stats?.attackMatchesPlayed ?? 0) >= req && (stats?.defenseMatchesPlayed ?? 0) >= req
  );
}

export function isSoloRanked(stats: SeasonStatsLike | null): boolean {
  return (stats?.soloMatchesPlayed ?? 0) >= ELO_CONFIG.PLACEMENT_MATCHES_REQUIRED;
}

export function checkWinCondition(redScore: number, blueScore: number): boolean {
  const maxScore = Math.max(redScore, blueScore);
  const diff = Math.abs(redScore - blueScore);
  if (maxScore >= 10 && diff >= 2) return true;
  return false;
}

export function isValidFinalScore(redScore: number, blueScore: number): boolean {
  const high = Math.max(redScore, blueScore);
  const low = Math.min(redScore, blueScore);
  if (high < 10) return false;
  if (high === 10) return low <= 8;
  return high - low === 2;
}

export function formatSeasonId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatSeasonLabel(seasonId: string): string {
  const [yearStr, monthStr] = seasonId.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
