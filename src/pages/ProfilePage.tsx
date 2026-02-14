import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../stores/authStore";

export function ProfilePage() {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    if (!username.trim() || username === user.username) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        username: username.trim(),
      });
      setEditing(false);
    } catch (error) {
      console.error("Error updating username:", error);
    } finally {
      setSaving(false);
    }
  };

  const winRate =
    user.matchesPlayed > 0
      ? Math.round((user.wins / user.matchesPlayed) * 100)
      : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                  {saving ? "..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setUsername(user.username);
                    setEditing(false);
                  }}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{user.username}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Edit
                </button>
              </div>
            )}
            <div className="text-gray-400 text-sm">
              Member since{" "}
              {user.createdAt?.toDate().toLocaleDateString() || "recently"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{user.elo}</div>
            <div className="text-sm text-gray-400">Elo Rating</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{user.matchesPlayed}</div>
            <div className="text-sm text-gray-400">Matches</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{user.wins}</div>
            <div className="text-sm text-gray-400">Wins</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{user.losses}</div>
            <div className="text-sm text-gray-400">Losses</div>
          </div>
        </div>

        <div className="mt-4 bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Win Rate</span>
            <span className="font-medium">{winRate}%</span>
          </div>
          <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
