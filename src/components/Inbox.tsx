import { useState, useEffect, useRef } from 'react';
import { useFriendStore } from '../stores/friendStore.ts';
import { useAuthStore } from '../stores/authStore.ts';

export function Inbox(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { pendingIncoming, subscribeTo, acceptFriendRequest } = useFriendStore();
  const user = useAuthStore((s) => s.user);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeTo(user.uid);
  }, [user, subscribeTo]);

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {pendingIncoming.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {pendingIncoming.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border z-50 max-h-80 overflow-y-auto">
          <div className="p-3 border-b font-semibold text-sm">Friend Requests</div>
          {pendingIncoming.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No pending requests</div>
          ) : (
            pendingIncoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border-b">
                <span className="text-sm">{r.senderId}</span>
                <button
                  onClick={() => acceptFriendRequest(r.id)}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Accept
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
