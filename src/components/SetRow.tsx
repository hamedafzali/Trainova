"use client";

import { useStore } from "@/lib/store";
import type { WorkoutSet } from "@/domain/types";

/**
 * One logged set. Optimised for minimal taps: type weight, type reps, tap ✓.
 * The check both marks completion and triggers PR detection in the store.
 */
export function SetRow({ set, onPr }: { set: WorkoutSet; onPr: (kinds: string[]) => void }) {
  const updateSet = useStore((s) => s.updateSet);
  const completeSet = useStore((s) => s.completeSet);
  const removeSet = useStore((s) => s.removeSet);

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-1 py-1.5 ${
        set.completed ? "opacity-70" : ""
      }`}
    >
      <span className="w-6 text-center text-sm text-muted tabular-nums">{set.setIndex + 1}</span>

      <input
        type="number"
        inputMode="decimal"
        className="num flex-1"
        placeholder={set.plannedWeight != null ? String(set.plannedWeight) : "kg"}
        value={set.actualWeight ?? ""}
        onChange={(e) => updateSet(set.id, { actualWeight: num(e.target.value) })}
      />
      <span className="text-muted">×</span>
      <input
        type="number"
        inputMode="numeric"
        className="num flex-1"
        placeholder={set.plannedReps != null ? String(set.plannedReps) : "reps"}
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
          if (set.actualWeight == null) updateSet(set.id, { actualWeight: set.plannedWeight });
          if (set.actualReps == null) updateSet(set.id, { actualReps: set.plannedReps });
          const { newPrs } = completeSet(set.id);
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
