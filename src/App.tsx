import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { Layout } from "./components/Layout";
import { AuthForm } from "./components/AuthForm";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { FriendsPage } from "./pages/FriendsPage";
import { MatchesPage } from "./pages/MatchesPage";
import { NewMatchPage } from "./pages/NewMatchPage";
import { MatchLobbyPage } from "./pages/MatchLobbyPage";
import { LiveMatchPage } from "./pages/LiveMatchPage";
import { MatchResultPage } from "./pages/MatchResultPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize, user, loading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initialize();
    return () => unsubscribe();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/kicker-elo">
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <AuthForm />
              </div>
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <HomePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Layout>
                <LeaderboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Layout>
                <FriendsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Layout>
                <MatchesPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/match/new"
          element={
            <ProtectedRoute>
              <Layout>
                <NewMatchPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/match/:matchId"
          element={
            <ProtectedRoute>
              <Layout>
                <MatchLobbyPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/match/:matchId/live"
          element={
            <ProtectedRoute>
              <Layout>
                <LiveMatchPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/match/:matchId/result"
          element={
            <ProtectedRoute>
              <Layout>
                <MatchResultPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
