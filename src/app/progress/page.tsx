"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { DeviceAvatar } from "@/components/DeviceAvatar";
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
                  ? "bg-accent text-onAccent"
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
                    ? "border-accent bg-accent text-onAccent"
                    : "border-border bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {m === "topWeight" ? "Top weight" : "Volume"}
              </button>
            ))}
          </div>

          <ul key={metric} className="enter-fade grid grid-cols-1 gap-4 lg:grid-cols-2">
            {exercises.map((exId) => {
              const ex = exerciseById(exId);
              const device = deviceForExercise(exId);
              const hist = exerciseHistory(exId);
              const bests = bestsFor(exId);
              const expanded = open === exId;
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

              return (
                <li
                  key={exId}
                  className="rounded-card border border-border bg-surface shadow-card p-6"
                >
                  <button
                    className="flex w-full items-center gap-4 text-left"
                    onClick={() => setOpen(expanded ? null : exId)}
                  >
                    <DeviceAvatar device={device} className="h-11 w-11 rounded-control text-sm shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base leading-tight text-ink truncate">
                        {ex?.name ?? "Exercise"}
                      </p>
                      <p className="text-body-sm text-muted mt-1">{subtitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-h3 font-semibold tabular-nums text-ink">
                        {headline}
                        <span className="text-body-sm font-normal text-muted">
                          {" "}
                          {headlineUnit}
                        </span>
                      </p>
                      <p className="text-body-sm text-muted mt-1">
                        {expanded ? "▲" : "▼"}
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-5 border-t border-border pt-5">
                      <LineChart data={series} unit={chartUnit} />
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
