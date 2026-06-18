// Tiny dependency-free SVG line chart. Offline-safe, scales to container width.

export function LineChart({
  data,
  unit,
}: {
  data: { label: string; value: number }[];
  unit?: string;
}) {
  if (data.length === 0) return null;

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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="progress chart">
      {/* baseline grid */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#D6C4AE" strokeWidth="1" />
      <polyline fill="none" stroke="#BC6B47" strokeWidth="2.5" points={points} />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r="3" fill="#BC6B47" />
      ))}
      {/* max / min labels */}
      <text x={pad} y={12} fontSize="10" fill="#9A8B79">
        {max}
        {unit}
      </text>
      <text x={pad} y={H - pad - 2} fontSize="10" fill="#9A8B79">
        {min}
        {unit}
      </text>
      {/* latest value */}
      <text x={W - pad} y={y(last.value) - 6} fontSize="11" fontWeight="700" fill="#38302A" textAnchor="end">
        {last.value}
        {unit}
      </text>
    </svg>
  );
}
