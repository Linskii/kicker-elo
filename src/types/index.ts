import { Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  username: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  createdAt: Timestamp;
  isAdmin?: boolean;
}

export interface Relationship {
  id: string;
  users: [string, string];
  status: "pending" | "accepted";
  senderId: string;
  updatedAt: Timestamp;
}

export interface Team {
  attacker: string | null;
  defender: string | null;
  score: number;
}

export interface MatchEvent {
  type: "goal" | "swap";
  team?: "red" | "blue";
  playerUid?: string;
  time: Timestamp;
}

export interface Match {
  id: string;
  status: "lobby" | "live" | "completed";
  participants: string[];
  viewers?: string[];
  redTeam: Team;
  blueTeam: Team;
  events: MatchEvent[];
  eloChanges?: Record<string, number>;
  preMatchElos?: Record<string, number>;
  createdBy: string;
  createdAt?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  seasonId?: string;
}

export interface SeasonPlayer {
  uid: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

export interface Season {
  id: string;
  label: string;
  year: number;
  month: number;
  status: "completed";
  endedAt: Timestamp;
  leaderboard: SeasonPlayer[];
}

