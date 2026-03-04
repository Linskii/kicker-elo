import type { Match, User } from '../types/index.ts';

interface Props {
  match: Match;
  participants: Record<string, User>;
}

function PlayerCircle({ user, color, x, y }: { user: User | undefined; color: string; x: number; y: number }): React.ReactElement {
  const initials = user ? user.username.slice(0, 2).toUpperCase() : '??';
  return (
    <g>
      <circle cx={x} cy={y} r={20} fill={color} opacity={0.8} />
      <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{initials}</text>
    </g>
  );
}

export function FieldView({ match, participants }: Props): React.ReactElement {
  const isSolo = match.type === 'solo';

  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-md mx-auto rounded-lg overflow-hidden">
      {/* Field */}
      <rect x="0" y="0" width="300" height="200" fill="#2d8a4e" />
      {/* Center line */}
      <line x1="150" y1="0" x2="150" y2="200" stroke="white" strokeWidth="2" opacity="0.5" />
      {/* Center circle */}
      <circle cx="150" cy="100" r="30" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
      {/* Goals */}
      <rect x="0" y="70" width="15" height="60" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
      <rect x="285" y="70" width="15" height="60" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />

      {isSolo ? (
        <>
          <PlayerCircle user={match.playerRed ? participants[match.playerRed] : undefined} color="#dc2626" x={75} y={100} />
          <PlayerCircle user={match.playerBlue ? participants[match.playerBlue] : undefined} color="#2563eb" x={225} y={100} />
        </>
      ) : (
        <>
          <PlayerCircle user={match.redAttacker ? participants[match.redAttacker] : undefined} color="#dc2626" x={100} y={100} />
          <PlayerCircle user={match.redDefender ? participants[match.redDefender] : undefined} color="#b91c1c" x={40} y={100} />
          <PlayerCircle user={match.blueAttacker ? participants[match.blueAttacker] : undefined} color="#2563eb" x={200} y={100} />
          <PlayerCircle user={match.blueDefender ? participants[match.blueDefender] : undefined} color="#1d4ed8" x={260} y={100} />
        </>
      )}
    </svg>
  );
}
