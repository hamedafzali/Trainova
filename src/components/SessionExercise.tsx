"use client";

import { useMemo } from "react";
import { SetRow } from "@/components/SetRow";
import { suggestNextLoad } from "@/domain/progression";
import { useStore } from "@/lib/store";
import type { WorkoutSet } from "@/domain/types";

/** All sets for a single exercise within the active session, plus its suggestion. */
export function SessionExercise({
  sessionId,
  exerciseId,
  sets,
  onPr,
}: {
  sessionId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  onPr: (kinds: string[]) => void;
}) {
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const addSet = useStore((s) => s.addSet);
  const lastPerformance = useStore((s) => s.lastPerformance);
  const missStreak = useStore((s) => s.missStreak);

  const ex = exerciseById(exerciseId);

  const suggestion = useMemo(() => {
    const last = lastPerformance(exerciseId, sessionId);
    const targetReps = sets[0]?.plannedReps ?? last?.targetReps ?? 8;
    return suggestNextLoad(last, units, {
      isCompound: ex?.isCompound ?? true,
      templateWeight: sets[0]?.plannedWeight ?? null,
      missStreak: missStreak(exerciseId, targetReps),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sessionId, units, sets.length]);

  return (
    <section className="card space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{ex?.name ?? "Exercise"}</h3>
        <span className="text-xs text-muted">
          {sets.filter((s) => s.completed).length}/{sets.length} done
        </span>
      </div>

      <p className="rounded-lg bg-accentDim/30 px-3 py-2 text-xs text-accent">
        💡 Suggested: <b>{suggestion.weight || "—"}{suggestion.weight ? units : ""}</b> ×{" "}
        {suggestion.reps} · {suggestion.reason}
      </p>

      <div className="divide-y divide-border/60">
        {sets.map((s) => (
          <SetRow key={s.id} set={s} onPr={onPr} />
        ))}
      </div>

      <button className="btn-ghost w-full" onClick={() => addSet(sessionId, exerciseId)}>
        + Add set
      </button>
    </section>
  );
}
