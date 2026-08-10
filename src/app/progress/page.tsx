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
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">Your trend on every exercise.</p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-white/10 text-sm shrink-0">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`px-4 py-2 font-semibold transition-colors ${
                units === u
                  ? "bg-blue-600 text-white"
                  : "bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-white/50">Loading…</div>
      ) : exercises.length === 0 ? (
        <div className="card text-center py-12 text-base text-white/50">
          Complete some workouts to see your progress.
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
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
                }`}
              >
                {m === "topWeight" ? "Top weight" : "Volume"}
              </button>
            ))}
          </div>

          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => setOpen(expanded ? null : exId)}
                  >
                    <DeviceAvatar device={device} className="h-10 w-10 rounded-lg text-sm" />
                    <div className="flex-1">
                      <p className="font-semibold leading-tight text-white">{ex?.name ?? "Exercise"}</p>
                      <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
                    </div>
                    <span className="text-xs text-white/50">{expanded ? "▲" : "▼"}</span>
                  </button>

                  {expanded && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <LineChart data={series} unit={chartUnit} />
                      <p className="mt-2 text-center text-[11px] text-white/40">
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
