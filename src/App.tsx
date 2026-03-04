import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.ts';
import { Layout } from './components/Layout.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { FriendsPage } from './pages/FriendsPage.tsx';
import { MatchesPage } from './pages/MatchesPage.tsx';
import { NewMatchPage } from './pages/NewMatchPage.tsx';
import { MatchLobbyPage } from './pages/MatchLobbyPage.tsx';
import { LiveMatchPage } from './pages/LiveMatchPage.tsx';
import { MatchResultPage } from './pages/MatchResultPage.tsx';
import { EditMatchPage } from './pages/EditMatchPage.tsx';
import { SeasonsPage } from './pages/SeasonsPage.tsx';
import { SeasonDetailPage } from './pages/SeasonDetailPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';

export default function App(): React.ReactElement {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  return (
    <BrowserRouter basename="/kicker-elo">
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="match/new" element={<NewMatchPage />} />
          <Route path="match/:matchId" element={<MatchLobbyPage />} />
          <Route path="match/:matchId/live" element={<LiveMatchPage />} />
          <Route path="match/:matchId/result" element={<MatchResultPage />} />
          <Route path="match/:matchId/edit" element={<EditMatchPage />} />
          <Route path="seasons" element={<SeasonsPage />} />
          <Route path="seasons/:seasonId" element={<SeasonDetailPage />} />
          <Route path="admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
