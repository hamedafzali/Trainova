"use client";

import { useStore } from "@/lib/store";
import { useRestTimer } from "@/lib/restTimer";
import type { WorkoutSet } from "@/domain/types";

export interface PreviousSet {
  weight: number | null;
  reps: number | null;
}

/**
 * One logged set. Optimised for minimal taps: the "Previous" column shows what
 * you did on this same set last time (ghosted as the input placeholder), so you
 * just type to beat it, then tap ✓.
 */
export function SetRow({
  set,
  previous,
  restSeconds,
  onPr,
}: {
  set: WorkoutSet;
  previous?: PreviousSet;
  restSeconds: number;
  onPr: (kinds: string[]) => void;
}) {
  const updateSet = useStore((s) => s.updateSet);
  const completeSet = useStore((s) => s.completeSet);
  const removeSet = useStore((s) => s.removeSet);
  const startRest = useRestTimer((s) => s.start);

  const num = (v: string) => (v === "" ? null : Number(v));
  const prevWeight = previous?.weight ?? set.targetWeight;
  const prevReps = previous?.reps ?? set.targetReps;
  const prevLabel =
    previous && previous.weight != null
      ? `${previous.weight}×${previous.reps ?? "–"}`
      : "—";

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-1 py-1.5 ${
        set.completed ? "opacity-70" : ""
      }`}
    >
      <span className="w-5 text-center text-sm text-muted tabular-nums">{set.setIndex + 1}</span>

      <span className="w-14 shrink-0 text-center text-xs text-muted tabular-nums" title="last time">
        {prevLabel}
      </span>

      <input
        type="number"
        inputMode="decimal"
        className="num flex-1"
        placeholder={prevWeight != null ? String(prevWeight) : "kg"}
        value={set.actualWeight ?? ""}
        onChange={(e) => updateSet(set.id, { actualWeight: num(e.target.value) })}
      />
      <span className="text-muted">×</span>
      <input
        type="number"
        inputMode="numeric"
        className="num flex-1"
        placeholder={prevReps != null ? String(prevReps) : "reps"}
        value={set.actualReps ?? ""}
        onChange={(e) => updateSet(set.id, { actualReps: num(e.target.value) })}
      />

      <button
        aria-label="complete set"
        onClick={() => {
          if (set.completed) {
            updateSet(set.id, { completed: false });
            return;
          }
          // Empty fields fall back to last time's values, so a repeat set is one tap.
          if (set.actualWeight == null) updateSet(set.id, { actualWeight: prevWeight });
          if (set.actualReps == null) updateSet(set.id, { actualReps: prevReps });
          const { newPrs } = completeSet(set.id);
          startRest(restSeconds); // auto-start rest the moment a set is done
          if (newPrs.length) onPr(newPrs);
        }}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
          set.completed ? "bg-accent text-black" : "bg-surface2 text-muted"
        }`}
      >
        ✓
      </button>
      <button
        aria-label="remove set"
        onClick={() => removeSet(set.id)}
        className="shrink-0 px-1 text-muted"
      >
        ✕
      </button>
    </div>
  );
}
