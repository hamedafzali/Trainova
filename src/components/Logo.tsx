/** The Trainova mark (a T whose crossbar is a barbell) on an accent tile. Same drawing as public/icon.svg. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" className="fill-accentFill" />
      <g fill="currentColor" className="text-onAccent" transform="translate(20.5 20.5) scale(0.92)">
        <rect x="78" y="112" width="44" height="124" rx="14" />
        <rect x="130" y="134" width="30" height="80" rx="10" />
        <rect x="352" y="134" width="30" height="80" rx="10" />
        <rect x="390" y="112" width="44" height="124" rx="14" />
        <rect x="150" y="154" width="212" height="40" rx="10" />
        <rect x="224" y="174" width="64" height="230" rx="32" />
      </g>
    </svg>
  );
}
