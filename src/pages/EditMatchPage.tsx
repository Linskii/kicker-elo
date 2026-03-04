import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useMatchStore } from '../stores/matchStore.ts';
import { useAuthStore } from '../stores/authStore.ts';
import type { Match, TeamSlot, User } from '../types/index.ts';

function DraggablePlayer({ uid, username }: { uid: string; username: string }): React.ReactElement {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: uid });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`px-3 py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 cursor-grab ${isDragging ? 'opacity-50' : ''}`}>
      {username}
    </div>
  );
}

function DroppableSlot({ id, label, player, color }: { id: string; label: string; player: User | null; color: string }): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`border-2 border-dashed rounded-lg p-3 text-center min-h-[60px] flex flex-col items-center justify-center ${isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}>
      <div className={`text-xs font-medium mb-1 ${color}`}>{label}</div>
      {player ? <div className="text-sm font-bold">{player.username}</div> : <div className="text-xs text-gray-400">Drop here</div>}
    </div>
  );
}

export function EditMatchPage(): React.ReactElement {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { match, participants, subscribeToMatch, editCompletedMatch } = useMatchStore();
  const [localSlots, setLocalSlots] = useState<Record<string, string | null>>({});
  const [redScore, setRedScore] = useState(0);
  const [blueScore, setBlueScore] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId);
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (!match || initialized) return;
    if (match.status !== 'completed') {
      navigate(`/match/${matchId}`, { replace: true });
      return;
    }
    if (match.endedAt) {
      const elapsed = Timestamp.now().toMillis() - match.endedAt.toMillis();
      if (elapsed > 10 * 60 * 1000) {
        navigate(`/match/${matchId}/result`, { replace: true });
        return;
      }
    }
    setLocalSlots({
      redAttacker: match.redAttacker,
      redDefender: match.redDefender,
      blueAttacker: match.blueAttacker,
      blueDefender: match.blueDefender,
      playerRed: match.playerRed,
      playerBlue: match.playerBlue,
    });
    setRedScore(match.redScore);
    setBlueScore(match.blueScore);
    setInitialized(true);
  }, [match, initialized, matchId, navigate]);

  if (!match || !user || !matchId || !initialized) return <div className="p-4">Loading...</div>;

  const isSolo = match.type === 'solo';
  const slotsConfig: { id: TeamSlot; label: string; color: string }[] = isSolo
    ? [
        { id: 'playerRed', label: 'Red', color: 'text-red-600' },
        { id: 'playerBlue', label: 'Blue', color: 'text-blue-600' },
      ]
    : [
        { id: 'redAttacker', label: 'Red Attacker', color: 'text-red-600' },
        { id: 'redDefender', label: 'Red Defender', color: 'text-red-700' },
        { id: 'blueAttacker', label: 'Blue Attacker', color: 'text-blue-600' },
        { id: 'blueDefender', label: 'Blue Defender', color: 'text-blue-700' },
      ];

  function getSlotPlayer(slot: TeamSlot): User | null {
    const uid = localSlots[slot];
    return uid ? participants[uid] ?? null : null;
  }

  function handleDragStart(e: DragStartEvent): void { setActiveId(e.active.id as string); }

  function handleDragEnd(e: DragEndEvent): void {
    setActiveId(null);
    if (!e.over) return;
    const playerUid = e.active.id as string;
    const slot = e.over.id as string;
    setLocalSlots((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === playerUid) next[key] = null;
      }
      next[slot] = playerUid;
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const newSlots: Partial<Pick<Match, 'redAttacker' | 'redDefender' | 'blueAttacker' | 'blueDefender' | 'playerRed' | 'playerBlue'>> = {};
      for (const slot of slotsConfig) {
        (newSlots as Record<string, string | null>)[slot.id] = localSlots[slot.id] ?? null;
      }
      await editCompletedMatch(matchId!, newSlots, redScore, blueScore);
      navigate(`/match/${matchId}/result`, { replace: true });
    } catch {
      setSaving(false);
    }
  }

  const activePlayer = activeId ? participants[activeId] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Match</h1>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-wrap gap-2">
          {match.participants.map((uid) => {
            const p = participants[uid];
            if (!p) return null;
            return <DraggablePlayer key={uid} uid={uid} username={p.username} />;
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {slotsConfig.map((slot) => (
            <DroppableSlot key={slot.id} id={slot.id} label={slot.label} player={getSlotPlayer(slot.id)} color={slot.color} />
          ))}
        </div>

        <DragOverlay>
          {activePlayer ? <div className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-200 text-blue-800 shadow-lg">{activePlayer.username}</div> : null}
        </DragOverlay>
      </DndContext>

      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          <label className="text-xs text-gray-500">Red Score</label>
          <input
            type="number"
            min={0}
            value={redScore}
            onChange={(e) => setRedScore(Number(e.target.value))}
            className="block w-20 mx-auto text-center border rounded px-2 py-1 text-lg font-bold"
          />
        </div>
        <span className="text-gray-300 text-lg">-</span>
        <div className="text-center">
          <label className="text-xs text-gray-500">Blue Score</label>
          <input
            type="number"
            min={0}
            value={blueScore}
            onChange={(e) => setBlueScore(Number(e.target.value))}
            className="block w-20 mx-auto text-center border rounded px-2 py-1 text-lg font-bold"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || redScore === blueScore}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
