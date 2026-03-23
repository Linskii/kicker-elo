import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { useSeasonStore } from '../stores/seasonStore.ts';

export function AdminPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { currentSeasonConfig, seasons, fetchCurrentSeasonConfig, fetchSeasons, adminInitSeason, adminCloseSeason, adminUpdateSeasonLabel } = useSeasonStore();
  const [closing, setClosing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) { navigate('/'); return; }
    fetchCurrentSeasonConfig();
    fetchSeasons();
  }, [user, navigate, fetchCurrentSeasonConfig, fetchSeasons]);

  async function handleClose(): Promise<void> {
    if (!confirm('Are you sure you want to close the current season?')) return;
    setClosing(true);
    try {
      await adminCloseSeason();
    } finally {
      setClosing(false);
    }
  }

  async function handleSaveLabel(): Promise<void> {
    if (!editingId || !editLabel.trim()) return;
    await adminUpdateSeasonLabel(editingId, editLabel.trim());
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm">
          Current Season: <span className="font-bold">{currentSeasonConfig?.currentSeasonId ?? 'N/A'}</span>
        </div>
        {currentSeasonConfig ? (
          <button
            onClick={handleClose}
            disabled={closing}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {closing ? 'Closing...' : 'Close Current Season'}
          </button>
        ) : (
          <button
            onClick={adminInitSeason}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Initialize First Season
          </button>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Completed Seasons</h2>
        {seasons.map((s) => (
          <div key={s.id} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
            {editingId === s.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
                <button onClick={handleSaveLabel} className="text-xs text-blue-600">Save</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">Cancel</button>
              </div>
            ) : (
              <>
                <span className="text-sm">{s.label} ({s.id})</span>
                <button onClick={() => { setEditingId(s.id); setEditLabel(s.label); }} className="text-xs text-blue-600">Edit Label</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
