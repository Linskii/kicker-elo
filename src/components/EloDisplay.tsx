interface Props {
  elo: number;
  matchesPlayed: number;
  required: number;
  roleName: string;
  isOwnProfile: boolean;
}

export function EloDisplay({ elo, matchesPlayed, required, roleName, isOwnProfile }: Props): React.ReactElement {
  if (matchesPlayed >= required) {
    return <span className="font-bold text-lg">{elo}</span>;
  }
  if (isOwnProfile) {
    const remaining = required - matchesPlayed;
    return <span className="text-sm text-gray-500">{remaining} more {roleName} matches to rank</span>;
  }
  return <span className="text-gray-400">&ndash;</span>;
}
