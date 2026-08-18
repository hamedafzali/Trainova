"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { Sparkline } from "@/components/Sparkline";
import { StatSkeleton } from "@/components/Skeleton";
import { useHydrated, useStore } from "@/lib/store";

export default function ProgressPage() {
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const exercisesWithHistory = useStore((s) => s.exercisesWithHistory);
  const exerciseHistory = useStore((s) => s.exerciseHistory);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceForExercise = useStore((s) => s.deviceForExercise);
  const bestsFor = useStore((s) => s.bestsFor);
  const [metric, setMetric] = useState<"topWeight" | "volume">("topWeight");
  const [open, setOpen] = useState<string | null>(null);

  const exercises = useMemo(
    () => (hydrated ? exercisesWithHistory() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated]
  );

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">Your trend on every exercise.</p>
        </div>
        <div className="flex overflow-hidden rounded-control border border-border text-sm shrink-0">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`px-4 py-2 font-semibold transition-colors ${
                units === u
                  ? "bg-accentFill text-onAccent"
                  : "bg-surface2 text-inkSoft hover:bg-border/60"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-4">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : exercises.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface text-center py-14 px-6 space-y-3">
          <p className="text-3xl" aria-hidden>
            📊
          </p>
          <p className="font-semibold text-lg text-ink">No trends yet</p>
          <p className="text-body-sm text-inkSoft max-w-xs mx-auto">
            Complete a few workouts for the same exercise and your progress
            will start showing up here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {(["topWeight", "volume"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  metric === m
                    ? "border-accentFill bg-accentFill text-onAccent"
                    : "border-border bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {m === "topWeight" ? "Top weight" : "Volume"}
              </button>
            ))}
          </div>

          {/* Full-bleed list, not a grid: ranked by how much you've actually
              trained each exercise (session count — the same "what matters
              most" signal Coach already uses to pick which exercises to
              surface), so the screen has one clear entry point instead of
              eight identical boxes. */}
          <ul key={metric} className="enter-fade space-y-3">
            {exercises
              .map((exId) => {
                const ex = exerciseById(exId);
                const device = deviceForExercise(exId);
                const hist = exerciseHistory(exId);
                const bests = bestsFor(exId);
                const first = hist[0];
                const latest = hist[hist.length - 1];

                // Pick the metric per exercise type.
                const isCardio = device?.category === "cardio";
                const isTime = ex?.mode === "time";
                const hasDistance = hist.some((h) => h.distance > 0);

                let series: { label: string; value: number }[];
                let chartUnit = "";
                let label: string;
                let subtitle: string;
                let headline: string;
                let headlineUnit: string;
                if (isTime) {
                  series = hist.map((h) => ({ label: h.date, value: h.durationSec }));
                  chartUnit = "s";
                  label = "Longest holds";
                  const best = Math.max(0, ...hist.map((h) => h.durationSec));
                  subtitle = `${hist.length} session${hist.length === 1 ? "" : "s"}`;
                  headline = `${best}`;
                  headlineUnit = "s best";
                } else if (isCardio) {
                  series = hist.map((h) => ({
                    label: h.date,
                    value: hasDistance ? h.distance : h.durationMin,
                  }));
                  label = hasDistance ? "Distance" : "Minutes";
                  const best = Math.max(0, ...series.map((s) => s.value));
                  subtitle = `${hist.length} session${hist.length === 1 ? "" : "s"}`;
                  headline = `${best}`;
                  headlineUnit = hasDistance ? " best" : " min best";
                } else {
                  series = hist.map((h) => ({
                    label: h.date,
                    value: metric === "topWeight" ? h.topWeight : Math.round(h.volume),
                  }));
                  chartUnit = metric === "topWeight" ? units : "";
                  label = metric === "topWeight" ? "Top weight" : "Volume";
                  subtitle = bests.e1rm
                    ? `est 1RM ${Math.round(bests.e1rm)}${units} · ${hist.length} sessions`
                    : `${hist.length} session${hist.length === 1 ? "" : "s"}`;
                  headline = `${bests.maxWeight}`;
                  headlineUnit = `${units} best`;
                }

                // Same trend classification as the Coach hero (±5% of first-vs-
                // latest logged value) so "trending up/down" reads as the same
                // green/amber everywhere it appears, not just in Coach.
                const trendPct =
                  series.length >= 2 && series[0].value !== 0
                    ? Math.round(((series[series.length - 1].value - series[0].value) / series[0].value) * 100)
                    : null;
                const trendUp = trendPct != null && trendPct >= 5;
                const trendDown = trendPct != null && trendPct <= -5;
                const trend: "up" | "down" | "flat" = trendUp ? "up" : trendDown ? "down" : "flat";

                return { exId, hist, series, chartUnit, label, subtitle, headline, headlineUnit, trendPct, trendUp, trendDown, trend, first, latest, ex };
              })
              .sort((a, b) => b.hist.length - a.hist.length)
              .map((row, i) => {
                const { exId, series, chartUnit, label, subtitle, headline, headlineUnit, trendPct, trendUp, trendDown, trend, first, latest, ex } = row;
                const expanded = open === exId;
                const featured = i === 0;

                return (
                  <li
                    key={exId}
                    className={`rounded-card border border-border bg-surface overflow-hidden ${
                      featured ? "shadow-elevated" : "shadow-card"
                    }`}
                  >
                    <button
                      className={`flex w-full items-center gap-5 text-left ${featured ? "p-6" : "p-5"}`}
                      onClick={() => setOpen(expanded ? null : exId)}
                      aria-expanded={expanded}
                    >
                      <div className="flex-1 min-w-0">
                        {featured && <p className="section-label text-muted mb-1">Most trained</p>}
                        <p className="font-semibold text-base leading-tight text-ink truncate">
                          {ex?.name ?? "Exercise"}
                        </p>
                        <p className="text-body-sm text-muted mt-1 flex items-center gap-1.5">
                          {subtitle}
                          {trendPct != null && (trendUp || trendDown) && (
                            <span className={trendUp ? "badge-success" : "badge-warning"}>
                              {trendUp ? "↑" : "↓"} {Math.abs(trendPct)}%
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-display leading-none tabular-nums text-ink">
                          {headline}
                          <span className="text-body-sm font-normal text-muted ml-1.5">{headlineUnit}</span>
                        </p>
                      </div>
                      <div className="w-24 sm:w-40 shrink-0">
                        <Sparkline data={series} trend={trend} height={featured ? 64 : 44} />
                      </div>
                      <span className="text-muted shrink-0" aria-hidden>
                        {expanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="border-t border-border p-5 pt-5 sm:p-6 sm:pt-5">
                        <LineChart data={series} unit={chartUnit} trend={trend} />
                        <p className="mt-3 text-center text-body-sm text-muted">
                          {label} per session · {first?.date} → {latest?.date}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </main>
  );
}
