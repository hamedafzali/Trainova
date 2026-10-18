/**
 * Line chart with a value axis, date labels and the latest value in a lime
 * pill (Progress → Strength Progress). Decorative to assistive tech; the
 * caller states the latest value and change as text.
 */
export function StrengthChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  if (data.length === 0) {
    return <div className="grid h-40 place-items-center rounded-control bg-surface2 text-sm text-muted">Not enough data yet</div>;
  }
  const W = 340;
  const H = 170;
  const left = 34;
  const right = 14;
  const top = 30;
  const bottom = 26;
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(10, hi * 0.1);
  const step = niceStep(span / 3);
  const yMin = Math.floor((lo - (hi === lo ? span / 2 : 0)) / step) * step;
  const yMax = Math.max(yMin + step * 3, Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const x = (i: number) => (data.length === 1 ? (left + W - right) / 2 : left + (i / (data.length - 1)) * (W - left - right));
  const y = (v: number) => top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - top - bottom);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  const lx = x(data.length - 1);
  const ly = y(last.value);
  const pill = `${last.value} ${unit}`;
  const pw = pill.length * 6.6 + 14;
  const px = Math.min(W - pw - 2, Math.max(left, lx - pw / 2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="0.75" />
          <text x={left - 8} y={y(t) + 3.5} textAnchor="end" className="fill-inkSoft text-[10px] tabular-nums">
            {t}
          </text>
        </g>
      ))}
      <polyline points={pts} fill="none" className="stroke-accentFill" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 4.5 : 3.5} className="fill-accentFill" />
      ))}
      <circle cx={lx} cy={ly} r="7" fill="none" className="stroke-accentFill/50" strokeWidth="1.5" />
      <rect x={px} y={Math.max(2, ly - 30)} width={pw} height="19" rx="5" className="fill-surface2 stroke-accentFill/40" strokeWidth="0.75" />
      <text x={px + pw / 2} y={Math.max(2, ly - 30) + 13} textAnchor="middle" className="fill-accent text-[10.5px] font-medium tabular-nums">
        {pill}
      </text>
      {data.map((d, i) =>
        data.length <= 6 || i % Math.ceil(data.length / 5) === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-inkSoft text-[10px]">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
