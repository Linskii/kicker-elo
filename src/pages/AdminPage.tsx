import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useSeasonStore } from "../stores/seasonStore";
import {
  adminCloseSeason,
  adminBootstrapPastSeason,
  adminDeleteSeason,
  adminUpdateSeasonLabel,
} from "../stores/seasonStore";
import { Navigate } from "react-router-dom";

export function AdminPage() {
  const { user } = useAuthStore();
  const { seasons, fetchSeasons } = useSeasonStore();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Bootstrap form
  const [bootstrapMonth, setBootstrapMonth] = useState("");

  // Edit label form
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const notify = (text: string, error = false) => {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 4000);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await fetchSeasons();
      notify("Done!");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const handleCloseSeason = () => {
    if (!confirm("Close the current season, snapshot the leaderboard, and reset all ELOs to 1000?")) return;
    run(adminCloseSeason);
  };

  const handleBootstrap = () => {
    if (!bootstrapMonth) return;
    run(() => adminBootstrapPastSeason(bootstrapMonth));
    setBootstrapMonth("");
  };

  const handleDelete = (seasonId: string) => {
    if (!confirm(`Delete season ${seasonId}? This cannot be undone.`)) return;
    run(() => adminDeleteSeason(seasonId));
  };

  const handleEditLabel = (season: { id: string; label: string }) => {
    setEditingSeasonId(season.id);
    setEditLabel(season.label);
  };

  const handleSaveLabel = () => {
    if (!editingSeasonId || !editLabel.trim()) return;
    run(() => adminUpdateSeasonLabel(editingSeasonId, editLabel.trim()));
    setEditingSeasonId(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.error ? "bg-red-900 text-red-200" : "bg-green-900 text-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Close current season */}
      <section className="bg-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Close Current Season</h2>
        <p className="text-sm text-gray-400">
          Snapshots the current leaderboard, marks the season as completed, and resets all player ELOs to 1000.
        </p>
        <button
          onClick={handleCloseSeason}
          disabled={busy}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          Close Season &amp; Reset ELOs
        </button>
      </section>

      {/* Bootstrap past season */}
      <section className="bg-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Bootstrap Past Season</h2>
        <p className="text-sm text-gray-400">
          Creates a completed season document for a past month using the current leaderboard as a snapshot.
          Does not reset ELOs.
        </p>
        <div className="flex gap-2">
          <input
            type="month"
            value={bootstrapMonth}
            onChange={(e) => setBootstrapMonth(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleBootstrap}
            disabled={busy || !bootstrapMonth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            Create Season
          </button>
        </div>
      </section>

      {/* Manage existing seasons */}
      <section className="bg-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Existing Seasons</h2>
          <button
            onClick={fetchSeasons}
            disabled={busy}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {seasons.length === 0 ? (
          <p className="text-sm text-gray-400">No seasons yet. Click Refresh to load.</p>
        ) : (
          <ul className="space-y-3">
            {seasons.map((season) => (
              <li key={season.id} className="flex items-center justify-between gap-4">
                {editingSeasonId === season.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-sm"
                    />
                    <button
                      onClick={handleSaveLabel}
                      disabled={busy}
                      className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg text-xs transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSeasonId(null)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-lg text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium">{season.label}</span>
                      <span className="text-xs text-gray-500 ml-2">{season.id}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEditLabel(season)}
                        disabled={busy}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg text-xs transition-colors"
                      >
                        Edit label
                      </button>
                      <button
                        onClick={() => handleDelete(season.id)}
                        disabled={busy}
                        className="px-3 py-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded-lg text-xs transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
