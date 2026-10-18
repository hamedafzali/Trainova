/**
 * Our own artwork for the "Today's Workout" card: a lit dumbbell on the dark
 * card, standing in for the reference's photo (no third-party photos).
 */
export function WorkoutArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMaxYMid slice" className={className} aria-hidden>
      <defs>
        <radialGradient id="wa-light" cx="78%" cy="30%" r="70%">
          <stop offset="0" stopColor="#2A3442" />
          <stop offset="0.55" stopColor="#141B25" />
          <stop offset="1" stopColor="#0A1119" />
        </radialGradient>
        <linearGradient id="wa-plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3A4452" />
          <stop offset="0.5" stopColor="#1A212B" />
          <stop offset="1" stopColor="#0D131B" />
        </linearGradient>
        <linearGradient id="wa-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C3E201" stopOpacity="0" />
          <stop offset="1" stopColor="#C3E201" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="wa-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#141B25" stopOpacity="1" />
          <stop offset="0.45" stopColor="#141B25" stopOpacity="0.7" />
          <stop offset="1" stopColor="#141B25" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#wa-light)" />
      {/* rack uprights */}
      <g opacity="0.35" fill="#2A3240">
        <rect x="236" y="0" width="10" height="260" />
        <rect x="372" y="0" width="10" height="260" />
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx="241" cy={18 + i * 28} r="2.2" fill="#0A1119" />
        ))}
      </g>
      <g transform="rotate(-18 300 150)">
        {/* handle */}
        <rect x="236" y="141" width="128" height="18" rx="6" fill="#262E3A" />
        <rect x="236" y="141" width="128" height="4" rx="2" fill="#4A5463" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={262 + i * 11} y="141" width="2" height="18" fill="#1A212B" />
        ))}
        {/* heads */}
        {[200, 364].map((x) => (
          <g key={x}>
            <rect x={x} y="96" width="36" height="108" rx="10" fill="url(#wa-plate)" />
            <rect x={x + (x > 300 ? 30 : 0)} y="100" width="6" height="100" rx="3" fill="url(#wa-rim)" />
            <rect x={x + 6} y="96" width="24" height="5" rx="2.5" fill="#4A5463" opacity="0.8" />
          </g>
        ))}
      </g>
      <rect width="400" height="260" fill="url(#wa-fade)" />
    </svg>
  );
}
