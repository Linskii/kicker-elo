import type { User } from "../types";

interface FieldViewProps {
  redTeam: { attacker: User | null; defender: User | null };
  blueTeam: { attacker: User | null; defender: User | null };
}

function PlayerCircle({
  cx,
  cy,
  color,
  label,
}: {
  cx: number;
  cy: number;
  color: string;
  label: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={18} fill={color} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={12}
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

function initials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function FieldView({ redTeam, blueTeam }: FieldViewProps) {
  const stroke = "#51a2ff";
  const sw = 3;
  const cy = 140;

  return (
    <svg viewBox="0 0 560 280" className="w-full" style={{ maxHeight: 180 }}>
      {/* Field background */}
      <rect
        x={20} y={5} width={520} height={270}
        rx={10} fill="#364153" stroke={stroke} strokeWidth={sw}
      />
      {/* Left goal */}
      <rect
        x={20} y={105} width={18} height={70}
        fill="none" stroke={stroke} strokeWidth={sw}
      />
      {/* Right goal */}
      <rect
        x={522} y={105} width={18} height={70}
        fill="none" stroke={stroke} strokeWidth={sw}
      />
      {/* Center line */}
      <line x1={280} y1={5} x2={280} y2={275} stroke={stroke} strokeWidth={sw} />
      {/* Center circle */}
      <circle cx={280} cy={140} r={52} fill="none" stroke={stroke} strokeWidth={sw} />

      {/* Red Defender (near left/red goal) */}
      {redTeam.defender && (
        <PlayerCircle cx={65} cy={cy} color="#ef4444" label={initials(redTeam.defender.username)} />
      )}
      {/* Red Attacker */}
      {redTeam.attacker && (
        <PlayerCircle cx={185} cy={cy} color="#ef4444" label={initials(redTeam.attacker.username)} />
      )}
      {/* Blue Attacker */}
      {blueTeam.attacker && (
        <PlayerCircle cx={375} cy={cy} color="#3b82f6" label={initials(blueTeam.attacker.username)} />
      )}
      {/* Blue Defender (near right/blue goal) */}
      {blueTeam.defender && (
        <PlayerCircle cx={495} cy={cy} color="#3b82f6" label={initials(blueTeam.defender.username)} />
      )}
    </svg>
  );
}
