// Compact, dependency-free trend line for list rows — no axes, no callouts,
// just shape + direction. Color encodes the same up/green, down/amber
// language used everywhere else trend appears (Coach, History), so a row's
// spark reads as the same signal as its badge without opening the chart.

const TREND_CLASSES: Record<"up" | "down" | "flat", { stroke: string; fill: string; dot: string }> = {
  up: { stroke: "stroke-green", fill: "fill-green/[0.14]", dot: "fill-green" },
  down: { stroke: "stroke-amber", fill: "fill-amber/[0.14]", dot: "fill-amber" },
  flat: { stroke: "stroke-muted", fill: "fill-muted/[0.1]", dot: "fill-muted" },
};

export function Sparkline({
  data,
  trend,
  height = 44,
}: {
  data: { value: number }[];
  trend: "up" | "down" | "flat";
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-caption text-muted" style={{ height }}>
        —
      </div>
    );
  }

  const W = 160;
  const H = height;
  const pad = 4;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${pad},${H - pad} ${points} ${W - pad},${H - pad}`;
  const c = TREND_CLASSES[trend];
  const lastX = x(data.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-hidden="true">
      <polygon points={area} className={c.fill} />
      <polyline
        fill="none"
        className={c.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="3" className={c.dot} />
    </svg>
  );
}
