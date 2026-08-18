"use client";

import { useMemo, useState } from "react";
import { totalVolume } from "@/domain/volume";
import type { WorkoutSession, WorkoutSet } from "@/domain/types";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

// Same green ramp used everywhere else volume-trending-up appears (Coach,
// Progress, History's weekly badge) — this widget's whole job is to make
// that one hue read as "more training happened," so it never reaches for a
// second color. Rest days are neutral surface, not a colored "zero" state —
// absence of training isn't a failure state to flag.
const BUCKET_CLASSES = [
  "bg-surface2 text-muted", // 0 · no session
  "bg-green/[0.16] text-ink", // 1 · low
  "bg-green/[0.38] text-ink", // 2 · medium
  "bg-green/[0.62] text-ink", // 3 · high
  "bg-green text-onStatus", // 4 · very high — the one solid fill, reuses the app's verified green/onStatus pairing
];

function dayKeyYMD(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Minimum days-with-training this month before the grid is considered
// informative enough to show. Below this, a mostly-empty 30-square grid
// reads as "broken" or "you're failing," not "keep going" — so a new user
// with 1-2 sessions gets an encouraging placeholder instead of a grid that's
// 90% blank squares.
const MIN_DAYS_FOR_GRID = 3;

export function VolumeHeatmap({
  sessions,
  sets,
  units,
}: {
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  units: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const { cells, dayVolumes, daysWithData, monthTotal } = useMemo(() => {
    const volumeByDay = new Map<string, number>();
    for (const s of sessions) {
      if (s.status === "archived") continue;
      const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
      if (mine.length === 0) continue;
      volumeByDay.set(s.date, (volumeByDay.get(s.date) ?? 0) + totalVolume(mine));
    }

    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);

    const monthKeys = out.filter((d): d is number => d != null).map((d) => dayKeyYMD(y, m, d));
    const monthVolumes = monthKeys.map((k) => volumeByDay.get(k) ?? 0).filter((v) => v > 0);
    const max = Math.max(0, ...monthVolumes);

    return {
      cells: out,
      dayVolumes: volumeByDay,
      daysWithData: monthVolumes.length,
      monthTotal: monthVolumes.reduce((a, b) => a + b, 0),
      max,
    };
  }, [sessions, sets, y, m]);

  const bucketFor = (vol: number, max: number) => {
    if (vol <= 0) return 0;
    if (max <= 0) return 0;
    const ratio = vol / max;
    if (ratio >= 0.85) return 4;
    if (ratio >= 0.55) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  };

  const max = Math.max(0, ...[...dayVolumes.values()]);
  const monthName = today.toLocaleDateString(undefined, { month: "long" });

  if (daysWithData < MIN_DAYS_FOR_GRID) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center space-y-2">
        <p className="text-2xl" aria-hidden>
          🌱
        </p>
        <p className="font-semibold text-ink">Your heatmap is still filling in</p>
        <p className="text-body-sm text-inkSoft max-w-xs mx-auto">
          {daysWithData === 0
            ? `Log a workout and ${monthName} will start shading in.`
            : `${daysWithData} day${daysWithData === 1 ? "" : "s"} logged so far this month — a few more and the grid gets useful.`}
        </p>
      </div>
    );
  }

  const selectedVol = selected ? dayVolumes.get(selected) ?? 0 : null;
  const selectedLabel = selected
    ? new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="rounded-card border border-border bg-surface shadow-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label text-muted">{monthName} volume</p>
          <p className="text-body-sm text-inkSoft mt-0.5">
            {Math.round(monthTotal).toLocaleString()} {units}·vol across {daysWithData} day
            {daysWithData === 1 ? "" : "s"}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-caption text-muted shrink-0" aria-hidden>
          <span>Less</span>
          {BUCKET_CLASSES.map((c, i) => (
            <span key={i} className={`h-3 w-3 rounded-[3px] ${c.split(" ")[0]}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase text-muted">
          {DOW.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <span key={i} />;
            const k = dayKeyYMD(y, m, d);
            const vol = dayVolumes.get(k) ?? 0;
            const bucket = bucketFor(vol, max);
            const isFuture = new Date(y, m, d) > today;
            const isSel = k === selected;
            return (
              <button
                key={i}
                disabled={isFuture}
                onClick={() => setSelected(isSel ? null : k)}
                aria-label={`${new Date(y, m, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}${vol > 0 ? `, ${Math.round(vol).toLocaleString()} ${units} volume` : ", rest day"}`}
                aria-pressed={isSel}
                className={`relative flex aspect-square items-center justify-center rounded-[6px] text-[11px] tabular-nums transition-colors ${
                  isFuture
                    ? "bg-transparent text-muted/40 cursor-default"
                    : `${BUCKET_CLASSES[bucket]} ${!isSel ? "hover:opacity-80" : ""}`
                } ${isSel ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex sm:hidden items-center justify-center gap-1.5 text-caption text-muted" aria-hidden>
        <span>Less</span>
        {BUCKET_CLASSES.map((c, i) => (
          <span key={i} className={`h-3 w-3 rounded-[3px] ${c.split(" ")[0]}`} />
        ))}
        <span>More</span>
      </div>

      <p className="text-body-sm text-center text-muted min-h-[1.25em]" aria-live="polite">
        {selected
          ? selectedVol && selectedVol > 0
            ? `${selectedLabel} · ${Math.round(selectedVol).toLocaleString()} ${units}·vol`
            : `${selectedLabel} · rest day`
          : "Tap a day for its volume"}
      </p>
    </div>
  );
}
