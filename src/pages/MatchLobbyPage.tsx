import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useMatchStore } from "../stores/matchStore";
import type { User } from "../types";

function PlayerCard({
  player,
  isDragging,
}: {
  player: User;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 bg-gray-600 p-2 rounded-lg ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
        {player.username.charAt(0).toUpperCase()}
      </div>
      <div>
        <div className="text-sm font-medium">{player.username}</div>
        <div className="text-xs text-gray-400">Elo: {player.elo}</div>
      </div>
    </div>
  );
}

function DraggablePlayer({ player }: { player: User }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.uid,
    data: player,
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="cursor-grab">
      <PlayerCard player={player} isDragging={isDragging} />
    </div>
  );
}

function DroppableSlot({
  id,
  label,
  player,
  color,
}: {
  id: string;
  label: string;
  player: User | null;
  color: "red" | "blue";
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  const bgColor = color === "red" ? "bg-red-900/30" : "bg-blue-900/30";
  const borderColor =
    color === "red"
      ? isOver
        ? "border-red-400"
        : "border-red-600"
      : isOver
        ? "border-blue-400"
        : "border-blue-600";

  return (
    <div
      ref={setNodeRef}
      className={`${bgColor} border-2 ${borderColor} border-dashed rounded-lg p-3 min-h-[70px] transition-colors`}
    >
      <div
        className={`text-xs font-medium mb-2 ${color === "red" ? "text-red-400" : "text-blue-400"}`}
      >
        {label}
      </div>
      {player ? (
        <DraggablePlayer player={player} />
      ) : (
        <div className="text-gray-500 text-sm text-center py-2">
          Drop player here
        </div>
      )}
    </div>
  );
}

export function MatchLobbyPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentMatch,
    participants,
    loading,
    subscribeToMatch,
    assignToTeam,
    startMatch,
  } = useMatchStore();

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = subscribeToMatch(matchId);
    return () => unsubscribe();
  }, [matchId, subscribeToMatch]);

  useEffect(() => {
    if (!matchId) return;
    if (currentMatch?.status === "live") {
      navigate(`/match/${matchId}/live`);
    } else if (currentMatch?.status === "completed") {
      navigate(`/match/${matchId}/result`);
    }
  }, [currentMatch?.status, matchId, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading match...</div>
      </div>
    );
  }

  if (!currentMatch || !user) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Match not found</div>
      </div>
    );
  }

  const isCreator = currentMatch.createdBy === user.uid;

  // Get players not assigned to any team
  const assignedPlayers = [
    currentMatch.redTeam.attacker,
    currentMatch.redTeam.defender,
    currentMatch.blueTeam.attacker,
    currentMatch.blueTeam.defender,
  ].filter(Boolean);

  const unassignedPlayers = currentMatch.participants.filter(
    (uid) => !assignedPlayers.includes(uid)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over || !matchId) return;

    const playerUid = active.id as string;
    const [team, role] = (over.id as string).split("-") as [
      "red" | "blue",
      "attacker" | "defender",
    ];

    assignToTeam(matchId, playerUid, team, role);
  };

  const canStartMatch = () => {
    const redPlayers = [
      currentMatch.redTeam.attacker,
      currentMatch.redTeam.defender,
    ].filter(Boolean).length;
    const bluePlayers = [
      currentMatch.blueTeam.attacker,
      currentMatch.blueTeam.defender,
    ].filter(Boolean).length;

    // Valid configs: 1v1, 1v2, 2v1, 2v2
    return redPlayers >= 1 && bluePlayers >= 1;
  };

  const handleStartMatch = () => {
    if (matchId && canStartMatch()) {
      startMatch(matchId);
    }
  };

  const activePlayer = activeId ? participants[activeId] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Match Lobby</h1>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Unassigned Players Pool */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">
            Players ({currentMatch.participants.length})
          </h2>
          {unassignedPlayers.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-4">
              All players assigned to teams
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unassignedPlayers.map((uid) => {
                const player = participants[uid];
                if (!player) return null;
                return <DraggablePlayer key={uid} player={player} />;
              })}
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Red Team */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-3 text-red-400">Red Team</h2>
            <div className="space-y-3">
              <DroppableSlot
                id="red-attacker"
                label="Attacker"
                player={
                  currentMatch.redTeam.attacker
                    ? participants[currentMatch.redTeam.attacker]
                    : null
                }
                color="red"
              />
              <DroppableSlot
                id="red-defender"
                label="Defender"
                player={
                  currentMatch.redTeam.defender
                    ? participants[currentMatch.redTeam.defender]
                    : null
                }
                color="red"
              />
            </div>
          </div>

          {/* Blue Team */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-3 text-blue-400">Blue Team</h2>
            <div className="space-y-3">
              <DroppableSlot
                id="blue-attacker"
                label="Attacker"
                player={
                  currentMatch.blueTeam.attacker
                    ? participants[currentMatch.blueTeam.attacker]
                    : null
                }
                color="blue"
              />
              <DroppableSlot
                id="blue-defender"
                label="Defender"
                player={
                  currentMatch.blueTeam.defender
                    ? participants[currentMatch.blueTeam.defender]
                    : null
                }
                color="blue"
              />
            </div>
          </div>
        </div>

        <DragOverlay>
          {activePlayer ? <PlayerCard player={activePlayer} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Start Match Button */}
      {isCreator && (
        <button
          onClick={handleStartMatch}
          disabled={!canStartMatch()}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium"
        >
          {canStartMatch() ? "Start Match" : "Assign at least 1 player per team"}
        </button>
      )}
    </div>
  );
}
