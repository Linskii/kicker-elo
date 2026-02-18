import { Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  username: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  createdAt: Timestamp;
}

export interface Relationship {
  id: string;
  users: [string, string];
  status: "pending" | "accepted";
  senderId: string;
  trusts: Record<string, boolean>;
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
  pendingInvitations?: string[];
  redTeam: Team;
  blueTeam: Team;
  events: MatchEvent[];
  eloChanges?: Record<string, number>;
  createdBy: string;
  createdAt?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
}

export interface Invitation {
  id: string;
  matchId: string;
  inviterUid: string;
  inviteeUid: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
  respondedAt?: Timestamp;
}
