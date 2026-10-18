export const DONUT_COLORS = ["bg-chart1", "bg-chart2", "bg-chart3", "bg-chart4", "bg-chart5"] as const;
const STROKES = ["stroke-chart1", "stroke-chart2", "stroke-chart3", "stroke-chart4", "stroke-chart5"];

/** Ring chart of shares (percent, summing to 100). Decorative; callers list the values as text. */
export function Donut({ values, size = 148 }: { values: number[]; size?: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const gap = values.filter((v) => v > 0).length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="20" className="stroke-surface2" />
      {values.map((v, i) => {
        const len = (v / 100) * c;
        const seg = (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="20"
            className={STROKES[i % STROKES.length]}
            strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return v > 0 ? seg : null;
      })}
    </svg>
  );
}
