"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { PERIOD_LABEL, type Period, type PeriodKind } from "@/domain/periodStats";

const short = (k: string) => new Date(k + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "This Week ▾  ‹ ›": choose the period length, then step back and forward through it. */
export function PeriodPicker({
  kind,
  offset,
  period,
  onKind,
  onOffset,
}: {
  kind: PeriodKind;
  offset: number;
  period: Period;
  onKind: (k: PeriodKind) => void;
  onOffset: (n: number) => void;
}) {
  const range = `${short(period.from)} – ${short(period.to)}`;
  return (
    <div className="flex items-center gap-1">
      <label className="relative">
        <span className="sr-only">Period</span>
        <select
          value={kind}
          onChange={(e) => onKind(e.target.value as PeriodKind)}
          className="min-h-11 appearance-none rounded-control bg-surface2 py-2 pl-4 pr-10 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {(Object.keys(PERIOD_LABEL) as PeriodKind[]).map((k) => (
            <option key={k} value={k}>
              {PERIOD_LABEL[k]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink" aria-hidden />
      </label>
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-control text-inkSoft hover:text-ink"
        onClick={() => onOffset(offset + 1)}
        aria-label="Previous period"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <span className="min-w-0 truncate text-xs tabular-nums text-muted" aria-live="polite">
        {offset === 0 ? "" : range}
      </span>
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-control text-inkSoft hover:text-ink disabled:opacity-30"
        onClick={() => onOffset(offset - 1)}
        disabled={offset === 0}
        aria-label="Next period"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
