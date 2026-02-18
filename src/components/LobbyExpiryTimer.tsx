import { useEffect, useState, useRef } from "react";
import type { Timestamp } from "firebase/firestore";

const LOBBY_TIMEOUT_SECONDS = 30;

interface LobbyExpiryTimerProps {
  lastActivityAt: Timestamp | undefined;
  onExpire: () => void;
}

export function LobbyExpiryTimer({
  lastActivityAt,
  onExpire,
}: LobbyExpiryTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(LOBBY_TIMEOUT_SECONDS);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Store lastActivityAt timestamp as milliseconds to avoid object reference issues
  const lastActivityMs = lastActivityAt?.toMillis?.() ?? null;

  useEffect(() => {
    const calculateRemaining = () => {
      if (lastActivityMs === null) {
        return LOBBY_TIMEOUT_SECONDS;
      }
      const now = Date.now();
      const elapsed = Math.floor((now - lastActivityMs) / 1000);
      return Math.max(0, LOBBY_TIMEOUT_SECONDS - elapsed);
    };

    // Set initial value
    setRemainingSeconds(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivityMs]);

  const progress = remainingSeconds / LOBBY_TIMEOUT_SECONDS;
  const isWarning = progress <= 0.25;

  // SVG circle properties
  const size = 24;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex items-center gap-1.5">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-600"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-1000 ${
            isWarning ? "text-red-500" : "text-gray-400"
          }`}
        />
      </svg>
      <span
        className={`text-xs font-mono ${
          isWarning ? "text-red-500" : "text-gray-400"
        }`}
      >
        {remainingSeconds}s
      </span>
    </div>
  );
}
