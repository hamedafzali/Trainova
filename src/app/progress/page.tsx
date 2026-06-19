"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { DeviceAvatar } from "@/components/DeviceAvatar";
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
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
          <p className="text-sm text-muted">Your trend on every exercise.</p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-border text-sm">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`px-3 py-1.5 ${units === u ? "bg-accent text-onAccent" : "text-muted"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : exercises.length === 0 ? (
        <div className="card text-center text-sm text-muted">
          Complete some workouts to see your progress.
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            {(["topWeight", "volume"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  metric === m
                    ? "border-accent bg-accent text-onAccent"
                    : "border-border bg-surface2 text-inkSoft"
                }`}
              >
                {m === "topWeight" ? "Top weight" : "Volume"}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
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
              if (isTime) {
                series = hist.map((h) => ({ label: h.date, value: h.durationSec }));
                chartUnit = "s";
                label = "Longest holds";
                const best = Math.max(0, ...hist.map((h) => h.durationSec));
                subtitle = `best ${best}s · ${hist.length} sessions`;
              } else if (isCardio) {
                series = hist.map((h) => ({
                  label: h.date,
                  value: hasDistance ? h.distance : h.durationMin,
                }));
                label = hasDistance ? "Distance" : "Minutes";
                const best = Math.max(0, ...series.map((s) => s.value));
                subtitle = `best ${best}${hasDistance ? "" : " min"} · ${hist.length} sessions`;
              } else {
                series = hist.map((h) => ({
                  label: h.date,
                  value: metric === "topWeight" ? h.topWeight : Math.round(h.volume),
                }));
                chartUnit = metric === "topWeight" ? units : "";
                label = metric === "topWeight" ? "Top weight" : "Volume";
                subtitle = `best ${bests.maxWeight}${units}${
                  bests.e1rm ? ` · est 1RM ${Math.round(bests.e1rm)}${units}` : ""
                } · ${hist.length} sessions`;
              }

              return (
                <li key={exId} className="card">
                  <button
                    className="flex w-full items-center gap-2.5 text-left"
                    onClick={() => setOpen(expanded ? null : exId)}
                  >
                    <DeviceAvatar device={device} className="h-9 w-9 rounded-lg text-sm" />
                    <div className="flex-1">
                      <p className="font-semibold leading-tight">{ex?.name ?? "Exercise"}</p>
                      <p className="text-xs text-muted">{subtitle}</p>
                    </div>
                    <span className="text-xs text-muted">{expanded ? "▲" : "▼"}</span>
                  </button>

                  {expanded && (
                    <div className="mt-3 border-t border-border pt-3">
                      <LineChart data={series} unit={chartUnit} />
                      <p className="mt-1 text-center text-[11px] text-muted">
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
