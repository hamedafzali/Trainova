// Tiny dependency-free SVG line chart. Offline-safe, scales to container width.

export function LineChart({
  data,
  unit,
}: {
  data: { label: string; value: number }[];
  unit?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-control bg-surface2 text-body-sm text-muted">
        Not enough data yet
      </div>
    );
  }

  const W = 320;
  const H = 96;
  const pad = 10;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) =>
    data.length === 1 ? W / 2 : pad + (i / (data.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  const lastX = x(data.length - 1);
  const lastY = y(last.value);
  const lastLabel = `${last.value}${unit ?? ""}`;
  const labelW = Math.max(28, lastLabel.length * 6.5 + 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="progress chart">
      {/* single restrained baseline — no gridline clutter */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-border" strokeWidth="1" />
      {/* guide from baseline up to the latest point */}
      <line
        x1={lastX}
        y1={H - pad}
        x2={lastX}
        y2={lastY}
        className="stroke-accent/20"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <polyline fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {data.map((d, i) =>
        i === data.length - 1 ? null : (
          <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" className="fill-accent/50" />
        ),
      )}
      {/* latest value — the callout this chart exists to deliver */}
      <circle cx={lastX} cy={lastY} r="4" className="fill-accent" />
      <circle cx={lastX} cy={lastY} r="7" className="fill-accent/15" />

      {/* max / min scale labels */}
      <text x={pad} y={12} fontSize="10" className="fill-muted">
        {max}
        {unit}
      </text>
      <text x={pad} y={H - pad - 2} fontSize="10" className="fill-muted">
        {min}
        {unit}
      </text>

      {/* latest value callout, anchored so it never runs off the right edge */}
      <g transform={`translate(${Math.min(lastX, W - pad - labelW)}, ${Math.max(2, lastY - 20)})`}>
        <rect width={labelW} height="16" rx="8" className="fill-accent/15" />
        <text x={labelW / 2} y="11.5" fontSize="10.5" fontWeight="700" textAnchor="middle" className="fill-accent">
          {lastLabel}
        </text>
      </g>
    </svg>
  );
}
