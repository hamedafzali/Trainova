/** Circular progress with the percentage in the middle (Home → Weekly Progress). */
export function ProgressRing({ value, size = 112, label }: { value: number; size?: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" className="stroke-surface2" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-accentFill transition-[stroke-dashoffset] duration-700 ease-standard"
        />
      </svg>
      <p className="absolute inset-0 grid place-items-center font-display text-[1.9rem] font-bold text-accent" aria-hidden>
        <span>
          {Math.round(pct * 100)}
          <span className="align-top text-base">%</span>
        </span>
      </p>
    </div>
  );
}
