import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useAuthStore } from '../stores/authStore.ts';
import { useMatchStore } from '../stores/matchStore.ts';
import { FieldView } from '../components/FieldView.tsx';
import { computeTeamElo } from '../utils/elo.ts';
import type { TeamSlot, User } from '../types/index.ts';

function DraggablePlayer({ uid, username, isAssigned }: { uid: string; username: string; isAssigned: boolean }): React.ReactElement {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: uid });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-3 py-2 rounded-lg text-sm font-medium cursor-grab select-none ${
        isAssigned ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {username}
    </div>
  );
}

function DroppableSlot({ id, label, player, color }: { id: string; label: string; player: User | null; color: string }): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-3 text-center min-h-[60px] flex flex-col items-center justify-center ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      }`}
    >
      <div className={`text-xs font-medium mb-1 ${color}`}>{label}</div>
      {player ? (
        <div className="text-sm font-bold">{player.username}</div>
      ) : (
        <div className="text-xs text-gray-400">Drop here</div>
      )}
    </div>
  );
}

function computeSuggestions(participants: Record<string, User>): { balanced: [string[], string[]]; lopsided: [string[], string[]] } | null {
  const uids = Object.keys(participants);
  if (uids.length !== 4) return null;

  const teamElos: Record<string, number> = {};
  for (const uid of uids) {
    const u = participants[uid];
    teamElos[uid] = computeTeamElo(u.attackElo, u.defenseElo, null) ?? 1000;
  }

  const splits: [string[], string[]][] = [
    [[uids[0], uids[1]], [uids[2], uids[3]]],
    [[uids[0], uids[2]], [uids[1], uids[3]]],
    [[uids[0], uids[3]], [uids[1], uids[2]]],
  ];

  const scored = splits.map((split) => {
    const avg1 = (teamElos[split[0][0]] + teamElos[split[0][1]]) / 2;
    const avg2 = (teamElos[split[1][0]] + teamElos[split[1][1]]) / 2;
    return { split, diff: Math.abs(avg1 - avg2) };
  });

  scored.sort((a, b) => a.diff - b.diff);
  return { balanced: scored[0].split, lopsided: scored[scored.length - 1].split };
}

export function MatchLobbyPage(): React.ReactElement {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { match, participants, subscribeToMatch, assignToTeam, startMatch, deleteMatch, removePlayer } = useMatchStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatch(matchId);
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (match?.status === 'live') navigate(`/match/${matchId}/live`, { replace: true });
  }, [match?.status, matchId, navigate]);

  if (!match || !user || !matchId) return <div className="p-4">Loading...</div>;

  const isSolo = match.participants.length <= 2;
  const isCreator = match.createdBy === user.uid;

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
    const uid = match![slot] as string | null;
    return uid ? participants[uid] ?? null : null;
  }

  function isAssigned(uid: string): boolean {
    const m = match!;
    return [m.redAttacker, m.redDefender, m.blueAttacker, m.blueDefender, m.playerRed, m.playerBlue].includes(uid);
  }

  const allSlotsFilled = slotsConfig.every((s) => match[s.id] !== null);

  function handleDragStart(e: DragStartEvent): void {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent): void {
    setActiveId(null);
    if (!e.over) return;
    const playerUid = e.active.id as string;
    const slot = e.over.id as TeamSlot;
    assignToTeam(matchId!, playerUid, slot);
  }

  function applySuggestion(teams: [string[], string[]]): void {
    const [team1, team2] = teams;
    const p = participants;
    // Team1 = red, Team2 = blue
    // Higher attackElo → attacker
    const redAtk = p[team1[0]]?.attackElo >= (p[team1[1]]?.attackElo ?? 0) ? team1[0] : team1[1];
    const redDef = redAtk === team1[0] ? team1[1] : team1[0];
    const blueAtk = p[team2[0]]?.attackElo >= (p[team2[1]]?.attackElo ?? 0) ? team2[0] : team2[1];
    const blueDef = blueAtk === team2[0] ? team2[1] : team2[0];
    assignToTeam(matchId!, redAtk, 'redAttacker');
    assignToTeam(matchId!, redDef, 'redDefender');
    assignToTeam(matchId!, blueAtk, 'blueAttacker');
    assignToTeam(matchId!, blueDef, 'blueDefender');
  }

  const suggestions = !isSolo ? computeSuggestions(participants) : null;
  const activePlayer = activeId ? participants[activeId] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isSolo ? 'Solo' : 'Team'} Match Lobby</h1>
        {isCreator && (
          <button onClick={() => { deleteMatch(matchId); navigate('/matches'); }} className="text-sm text-red-600 hover:text-red-800">
            Delete Lobby
          </button>
        )}
      </div>

      {!isCreator && (
        <button onClick={() => { removePlayer(matchId, user.uid); navigate('/matches'); }} className="text-sm text-gray-600 hover:text-gray-800">
          Leave Lobby
        </button>
      )}

      <FieldView match={match} participants={participants} />

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Player pool */}
        <div className="flex flex-wrap gap-2">
          {match.participants.map((uid) => {
            const p = participants[uid];
            if (!p) return null;
            return <DraggablePlayer key={uid} uid={uid} username={p.username} isAssigned={isAssigned(uid)} />;
          })}
        </div>

        {/* Slots */}
        <div className={`grid gap-3 ${isSolo ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {slotsConfig.map((slot) => (
            <DroppableSlot key={slot.id} id={slot.id} label={slot.label} player={getSlotPlayer(slot.id)} color={slot.color} />
          ))}
        </div>

        <DragOverlay>
          {activePlayer ? (
            <div className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-200 text-blue-800 shadow-lg">
              {activePlayer.username}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Team Suggestions */}
      {suggestions && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500">Suggest Teams</h3>
          <div className="flex gap-2">
            <button
              onClick={() => applySuggestion(suggestions.balanced)}
              className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"
            >
              Most Balanced
            </button>
            <button
              onClick={() => applySuggestion(suggestions.lopsided)}
              className="flex-1 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100"
            >
              Most Lopsided
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => startMatch(matchId)}
        disabled={!allSlotsFilled}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Start Match
      </button>
    </div>
  );
}
