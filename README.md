# Kicker ELO

A web app for tracking foosball (kicker) match results and player ratings using the ELO rating system. Players can create matches, track live scores, manage friends, and compete on a global leaderboard.

## Features

- **ELO Rating System** — Ratings update automatically after each match using the standard ELO formula (K=32)
- **Match Modes** — Supports 1v1, 1v2, and 2v2 configurations with attacker/defender roles
- **Live Scoring** — Real-time goal tracking with a first-to-10 (by 2) win condition and match timer
- **Drag-and-Drop Team Assignment** — Assign players to red/blue teams and swap roles in the lobby
- **Leaderboard** — Top 50 players ranked by ELO with win/loss records
- **Player Profiles** — Per-player stats and paginated match history
- **Friends System** — Search players by username, send/accept friend requests, and view friends' ratings
- **Notifications** — In-app inbox for pending friend requests

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS |
| Routing | React Router 7 |
| State | Zustand |
| Drag & Drop | @dnd-kit |
| Backend | Firebase (Auth + Firestore) |
| Build | Vite |

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Authentication enabled

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file in the project root with your Firebase config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Project Structure

```
src/
├── pages/          # Route-level page components
├── components/     # Reusable UI components
├── stores/         # Zustand stores (auth, match)
├── types/          # TypeScript interfaces
├── utils/          # ELO calculation logic
└── lib/            # Firebase initialization
```

## Match Flow

1. **Create** — A player opens a new match lobby
2. **Lobby** — Players are dragged into team slots (red/blue, attacker/defender)
3. **Live** — Match starts; goals are recorded in real time
4. **Result** — First team to 10 goals with a 2-goal lead wins; ELO ratings update automatically

## ELO Formula

```
Expected = 1 / (1 + 10 ^ ((opponent_elo - player_elo) / 400))
New ELO  = Old ELO + 32 × (result - expected)
```

Team ELO is the average of the two players' ratings. Individual ELO changes are bounded to ±50 per match.

