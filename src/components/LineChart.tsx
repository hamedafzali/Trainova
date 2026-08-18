// Tiny dependency-free SVG line chart. Offline-safe, scales to container width.

// Optional trend color, defaulting to the blue action accent (this chart's
// original, still-correct behavior anywhere it isn't showing a directional
// trend — e.g. WorkoutAnalysis). Progress passes the same up/down/flat
// language its row sparkline and badge already use, so expanding a row
// doesn't switch the story to a different color.
const TREND_CLASSES: Record<"up" | "down" | "flat" | "accent", { stroke: string; guide: string; dotFaint: string; dot: string; halo: string; label: string; labelBg: string }> = {
  accent: { stroke: "stroke-accent", guide: "stroke-accent/20", dotFaint: "fill-accent/50", dot: "fill-accent", halo: "fill-accent/15", label: "fill-accent", labelBg: "fill-accent/15" },
  up: { stroke: "stroke-green", guide: "stroke-green/20", dotFaint: "fill-green/50", dot: "fill-green", halo: "fill-green/15", label: "fill-green", labelBg: "fill-green/15" },
  down: { stroke: "stroke-amber", guide: "stroke-amber/20", dotFaint: "fill-amber/50", dot: "fill-amber", halo: "fill-amber/15", label: "fill-amber", labelBg: "fill-amber/15" },
  flat: { stroke: "stroke-muted", guide: "stroke-muted/20", dotFaint: "fill-muted/50", dot: "fill-muted", halo: "fill-muted/15", label: "fill-muted", labelBg: "fill-muted/15" },
};

export function LineChart({
  data,
  unit,
  trend = "accent",
}: {
  data: { label: string; value: number }[];
  unit?: string;
  trend?: "up" | "down" | "flat" | "accent";
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-control bg-surface2 text-body-sm text-muted">
        Not enough data yet
      </div>
    );
  }

  const c = TREND_CLASSES[trend];
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
        className={c.guide}
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <polyline fill="none" className={c.stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {data.map((d, i) =>
        i === data.length - 1 ? null : (
          <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" className={c.dotFaint} />
        ),
      )}
      {/* latest value — the callout this chart exists to deliver */}
      <circle cx={lastX} cy={lastY} r="4" className={c.dot} />
      <circle cx={lastX} cy={lastY} r="7" className={c.halo} />

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
        <rect width={labelW} height="16" rx="8" className={c.labelBg} />
        <text x={labelW / 2} y="11.5" fontSize="10.5" fontWeight="700" textAnchor="middle" className={c.label}>
          {lastLabel}
        </text>
      </g>
    </svg>
  );
}
