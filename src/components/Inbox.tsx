import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInvitationStore } from "../stores/invitationStore";
import { useAuthStore } from "../stores/authStore";
import type { Invitation } from "../types";

export function Inbox() {
  const { user } = useAuthStore();
  const {
    pendingInvitations,
    inviterUsers,
    subscribeToInvitations,
    acceptInvitation,
    declineInvitation,
  } = useInvitationStore();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to invitations
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToInvitations(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToInvitations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAccept = async (invitation: Invitation) => {
    await acceptInvitation(invitation);
    navigate(`/match/${invitation.matchId}`);
    setIsOpen(false);
  };

  const handleDecline = async (invitation: Invitation) => {
    await declineInvitation(invitation);
  };

  const count = pendingInvitations.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        aria-label="Inbox"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-semibold">Match Invitations</h3>
          </div>

          {count === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No pending invitations
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {pendingInvitations.map((invitation) => {
                const inviter = inviterUsers[invitation.inviterUid];
                return (
                  <div
                    key={invitation.id}
                    className="p-3 border-b border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
                        {inviter?.username.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {inviter?.username || "Someone"} invited you
                        </div>
                        <div className="text-sm text-gray-400">
                          Match invitation
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAccept(invitation)}
                        className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(invitation)}
                        className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
