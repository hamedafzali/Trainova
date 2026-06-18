"use client";

import { useMemo } from "react";
import { useHydrated, useStore } from "@/lib/store";

export default function ProgressPage() {
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const prs = useStore((s) => s.prs);
  const exerciseById = useStore((s) => s.exerciseById);

  const grouped = useMemo(() => {
    const byExercise = new Map<string, typeof prs>();
    for (const pr of prs) {
      const list = byExercise.get(pr.exerciseId) ?? [];
      list.push(pr);
      byExercise.set(pr.exerciseId, list);
    }
    return [...byExercise.entries()];
  }, [prs]);

  const label = (k: string) =>
    k === "e1rm" ? "Est. 1RM" : k === "max_weight" ? "Top weight" : "Most reps";

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
          <p className="text-sm text-muted">Personal records.</p>
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
      ) : grouped.length === 0 ? (
        <div className="card text-center text-muted">
          Complete some sets to start setting records.
        </div>
      ) : (
        <ul className="space-y-2">
          {grouped.map(([exerciseId, list]) => (
            <li key={exerciseId} className="card">
              <p className="mb-2 font-semibold">{exerciseById(exerciseId)?.name ?? "Exercise"}</p>
              <div className="grid grid-cols-3 gap-2">
                {list.map((pr) => (
                  <div key={pr.kind} className="rounded-lg bg-surface2 p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {label(pr.kind)}
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {pr.kind === "max_reps" ? pr.value : `${pr.value}${units}`}
                    </p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
