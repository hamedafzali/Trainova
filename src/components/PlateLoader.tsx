"use client";

import { loadPlates, PLATES } from "@/domain/plates";
import type { Units } from "@/domain/types";

// Physical plate colours (IWF-style bumper coding), deliberately not theme
// tokens: they mirror the plates on the gym floor, in light and dark mode alike.
const PLATE_STYLE: Record<Units, Record<number, { fill: string; h: number; w: number }>> = {
  kg: {
    25: { fill: "#D7263D", h: 56, w: 9 },
    20: { fill: "#1F5FD1", h: 56, w: 8 },
    15: { fill: "#F2C230", h: 50, w: 7 },
    10: { fill: "#2E9E5B", h: 42, w: 6 },
    5: { fill: "#F4F4F4", h: 32, w: 5 },
    2.5: { fill: "#2A2A2A", h: 25, w: 4 },
    1.25: { fill: "#B8BEC6", h: 19, w: 3 },
  },
  lb: {
    45: { fill: "#1F5FD1", h: 56, w: 9 },
    35: { fill: "#F2C230", h: 52, w: 8 },
    25: { fill: "#2E9E5B", h: 46, w: 7 },
    10: { fill: "#F4F4F4", h: 36, w: 5 },
    5: { fill: "#2A2A2A", h: 28, w: 5 },
    2.5: { fill: "#B8BEC6", h: 22, w: 4 },
  },
};

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const CY = 34;
const SLEEVE = 92; // drawable sleeve length per side, in viewBox units

/** Mirrored barbell showing which plates to load for `total` (display units). */
export function PlateLoader({ total, bar, units }: { total: number; bar: number; units: Units }) {
  const load = loadPlates(total, bar, units);
  const styles = PLATE_STYLE[units];
  const width = load.perSide.reduce((n, p) => n + styles[p].w + 1, 0);
  const k = width > SLEEVE ? SLEEVE / width : 1;

  // Plates sit from the inner collar outward; x positions per side.
  let x = 0;
  const placed = load.perSide.map((p, i) => {
    const s = styles[p];
    const at = { p, i, x, w: s.w * k, h: s.h, fill: s.fill };
    x += (s.w + 1) * k;
    return at;
  });

  const counts = PLATES[units]
    .map((p) => ({ p, n: load.perSide.filter((q) => q === p).length }))
    .filter((c) => c.n > 0);

  const caption = load.belowBar
    ? `Lighter than the empty ${fmt(bar)} ${units} bar`
    : load.perSide.length === 0
      ? `Empty ${fmt(bar)} ${units} bar`
      : `Each side: ${load.perSide.map(fmt).join(" + ")} ${units}`;
  const extra = load.remainder > 0 ? ` · ${fmt(load.remainder)} ${units} not on standard plates` : "";

  const plate = (a: (typeof placed)[number], side: 1 | -1) => {
    const px = side === 1 ? 214 + a.x : 106 - a.x - a.w;
    return (
      <rect
        key={`${side}-${a.i}-${a.p}`}
        x={px}
        y={CY - a.h / 2}
        width={a.w}
        height={a.h}
        rx={1.5}
        fill={a.fill}
        className="stroke-ink/25 motion-safe:animate-popIn"
        strokeWidth={0.75}
        style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${a.i * 30}ms`, animationFillMode: "backwards" }}
      />
    );
  };

  return (
    <div className="rounded-control bg-surface2 px-3 pb-2.5 pt-1.5">
      <svg viewBox="0 0 320 68" className="h-auto w-full" role="img" aria-label={`Plate loading. ${caption}${extra}`}>
        {/* shaft and sleeves */}
        <rect x={110} y={CY - 2} width={100} height={4} rx={2} className="fill-muted/60" />
        <rect x={8} y={CY - 3.5} width={98} height={7} rx={2} className="fill-muted/80" />
        <rect x={214} y={CY - 3.5} width={98} height={7} rx={2} className="fill-muted/80" />
        {/* collars */}
        <rect x={104} y={CY - 8} width={6} height={16} rx={1.5} className="fill-inkSoft" />
        <rect x={210} y={CY - 8} width={6} height={16} rx={1.5} className="fill-inkSoft" />
        {placed.map((a) => plate(a, -1))}
        {placed.map((a) => plate(a, 1))}
      </svg>
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-inkSoft" aria-hidden>
          {caption}
          {extra && <span className="font-normal text-amber">{extra}</span>}
        </span>
        {counts.length > 0 && (
          <span className="flex flex-wrap gap-2 text-muted" aria-hidden>
            {counts.map((c) => (
              <span key={c.p} className="inline-flex items-center gap-1 tabular-nums">
                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/20" style={{ background: styles[c.p].fill }} />
                {fmt(c.p)}×{c.n}
              </span>
            ))}
          </span>
        )}
      </p>
    </div>
  );
}
