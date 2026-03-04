import type { Timestamp } from 'firebase/firestore';

export interface EloHistoryEntry {
  t: Timestamp;
  a: number;
  d: number;
  s: number;
}

export interface User {
  uid: string;
  username: string;
  attackElo: number;
  defenseElo: number;
  soloElo: number;
  wins: number;
  losses: number;
  careerWins: number;
  careerLosses: number;
  teamRanked: boolean;
  soloRanked: boolean;
  eloHistory: EloHistoryEntry[];
  isAdmin?: boolean;
  createdAt: Timestamp;
}

export interface UserSeasonStats {
  seasonId: string;
  attackMatchesPlayed: number;
  defenseMatchesPlayed: number;
  soloMatchesPlayed: number;
}

export type MatchType = 'solo' | 'team';
export type MatchStatus = 'lobby' | 'live' | 'completed';

export type TeamSlot =
  | 'redAttacker'
  | 'redDefender'
  | 'blueAttacker'
  | 'blueDefender'
  | 'playerRed'
  | 'playerBlue';

export interface Match {
  id: string;
  type: MatchType;
  status: MatchStatus;
  createdBy: string;
  participants: string[];
  redAttacker: string | null;
  redDefender: string | null;
  blueAttacker: string | null;
  blueDefender: string | null;
  playerRed: string | null;
  playerBlue: string | null;
  redScore: number;
  blueScore: number;
  seasonId?: string;
  preMatchElos?: Record<string, PlayerEloSnapshot>;
  eloChanges?: Record<string, PlayerEloChange>;
  endedAt?: Timestamp;
  createdAt?: Timestamp;
  startedAt?: Timestamp;
}

export interface PlayerEloSnapshot {
  attackElo: number;
  defenseElo: number;
  soloElo: number;
}

export interface PlayerEloChange {
  attackEloDelta: number;
  defenseEloDelta: number;
  soloEloDelta: number;
}

export interface Relationship {
  id: string;
  users: [string, string];
  status: 'pending' | 'accepted';
  senderId: string;
  updatedAt: Timestamp;
}

export interface Season {
  id: string;
  label: string;
  year: number;
  month: number;
  status: 'completed';
  endedAt: Timestamp;
  teamLeaderboard: SeasonPlayer[];
  soloLeaderboard: SeasonPlayer[];
}

export interface SeasonPlayer {
  uid: string;
  username: string;
  attackElo: number;
  defenseElo: number;
  soloElo: number;
  teamElo: number;
  wins: number;
  losses: number;
}

export interface SeasonsConfig {
  currentSeasonId: string;
}
