"use client";

import { useMemo } from "react";
import { Stepper } from "@/components/Stepper";
import { CompleteButton } from "@/components/CompleteButton";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { suggestNextLoad, plateIncrement } from "@/domain/progression";
import { useStore } from "@/lib/store";
import { useRestTimer, defaultRest } from "@/lib/restTimer";
import { haptic } from "@/lib/haptics";
import type { WorkoutSet } from "@/domain/types";

/**
 * Focus-mode exercise card. Completed sets collapse to a compact rail; the first
 * incomplete set expands into big keyboard-free steppers + a swipe/tap complete.
 * Completing auto-advances to the next set.
 */
export function SessionExercise({
  sessionId,
  exerciseId,
  sets,
  readOnly = false,
  onPr,
}: {
  sessionId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  readOnly?: boolean;
  onPr: (kinds: string[]) => void;
}) {
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const completeSet = useStore((s) => s.completeSet);
  const lastPerformance = useStore((s) => s.lastPerformance);
  const missStreak = useStore((s) => s.missStreak);
  const startRest = useRestTimer((s) => s.start);

  const ex = exerciseById(exerciseId);
  const device = deviceById(sets[0]?.deviceId ?? ex?.defaultDeviceId);
  const isCompound = ex?.isCompound ?? false;

  const last = useMemo(
    () => lastPerformance(exerciseId, sessionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, sessionId]
  );

  const suggestion = useMemo(() => {
    const targetReps = sets[0]?.targetReps ?? last?.targetReps ?? 8;
    return suggestNextLoad(last, units, {
      isCompound,
      templateWeight: sets[0]?.targetWeight ?? null,
      missStreak: missStreak(exerciseId, targetReps),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sessionId, units, sets.length]);

  const done = sets.filter((s) => s.completed).length;
  const activeSet = readOnly ? undefined : sets.find((s) => !s.completed);

  const prevFor = (idx: number) => last?.sets[idx];

  const startWeight = (s: WorkoutSet) =>
    s.actualWeight ?? prevFor(s.setIndex)?.actualWeight ?? s.targetWeight ?? suggestion.weight ?? 0;
  const startReps = (s: WorkoutSet) =>
    s.actualReps ?? prevFor(s.setIndex)?.actualReps ?? s.targetReps ?? suggestion.reps ?? 8;

  const complete = (s: WorkoutSet) => {
    const w = s.actualWeight ?? startWeight(s);
    const r = s.actualReps ?? startReps(s);
    updateSet(s.id, { actualWeight: w, actualReps: r });
    const { newPrs } = completeSet(s.id);
    startRest(defaultRest(isCompound));
    if (newPrs.length) {
      haptic("pr");
      onPr(newPrs);
    } else {
      haptic("tick");
    }
  };

  return (
    <section className="card space-y-3">
      {/* header */}
      <div className="flex items-center gap-2.5">
        <DeviceAvatar device={device} className="h-10 w-10 rounded-lg text-sm" />
        <div className="flex-1">
          <h3 className="font-semibold leading-tight text-ink">{ex?.name ?? "Exercise"}</h3>
          {device && (
            <p className="text-[11px] text-muted">
              {device.name}
              {device.machineNumber ? ` · No.${device.machineNumber}` : ""}
            </p>
          )}
        </div>
        {/* progress dots */}
        <div className="flex items-center gap-1">
          {sets.map((s) => (
            <span
              key={s.id}
              className={`h-2 w-2 rounded-full ${
                s.completed ? "bg-green" : s === activeSet ? "bg-accent" : "border border-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* sets */}
      <div className="space-y-1.5">
        {sets.map((s) => {
          const prev = prevFor(s.setIndex);
          const prevLabel =
            prev && prev.actualWeight != null ? `${prev.actualWeight}×${prev.actualReps ?? "–"}` : "—";

          if (s === activeSet) {
            return (
              <div key={s.id} className="space-y-2 rounded-xl bg-bg/60 p-2.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    Set {s.setIndex + 1} of {sets.length}
                  </span>
                  <span>
                    prev <b className="text-inkSoft">{prevLabel}</b>
                  </span>
                </div>
                <Stepper
                  value={startWeight(s)}
                  step={plateIncrement(units)}
                  unit={units}
                  onChange={(v) => updateSet(s.id, { actualWeight: v })}
                />
                <Stepper
                  value={startReps(s)}
                  step={1}
                  unit="reps"
                  onChange={(v) => updateSet(s.id, { actualReps: v })}
                />
                <CompleteButton onComplete={() => complete(s)} />
              </div>
            );
          }

          // compact row (completed or upcoming)
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm ${
                s.completed ? "bg-green/15 animate-completeWipe" : "bg-surface2/50"
              }`}
            >
              <span className="w-5 text-center text-xs text-muted tabular-nums">{s.setIndex + 1}</span>
              <span className="w-14 shrink-0 text-center text-xs text-muted tabular-nums">{prevLabel}</span>
              <span className="flex-1 text-center font-semibold tabular-nums text-ink">
                {s.completed
                  ? `${s.actualWeight ?? "–"} ${units} × ${s.actualReps ?? "–"}`
                  : `${s.targetWeight ?? "–"} × ${s.targetReps ?? "–"}`}
              </span>
              {s.completed ? (
                <button
                  aria-label="undo set"
                  onClick={() => !readOnly && updateSet(s.id, { completed: false })}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-green text-onAccent"
                >
                  ✓
                </button>
              ) : (
                <span className="h-7 w-7 rounded-lg border border-border" />
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between">
          <button className="text-sm text-accent" onClick={() => addSet(sessionId, exerciseId)}>
            + Add set
          </button>
          <span className="text-xs text-muted">
            {done}/{sets.length} done
          </span>
        </div>
      )}
    </section>
  );
}
