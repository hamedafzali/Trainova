"use client";

import { useMemo } from "react";
import { Stepper } from "@/components/Stepper";
import { CompleteButton } from "@/components/CompleteButton";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { plateIncrement } from "@/domain/progression";
import { useStore } from "@/lib/store";
import { useRestTimer, defaultRest } from "@/lib/restTimer";
import { haptic } from "@/lib/haptics";
import type { WorkoutSet } from "@/domain/types";

/**
 * Focus-mode exercise card — WEIGHT ONLY. Each round (set) is just a weight; the
 * user adds rounds one by one with the weight they used. Completed rounds collapse
 * to a compact rail; the current round expands into a big keyboard-free stepper.
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
  const startRest = useRestTimer((s) => s.start);

  const ex = exerciseById(exerciseId);
  const device = deviceById(sets[0]?.deviceId ?? ex?.defaultDeviceId);
  const isCompound = ex?.isCompound ?? false;

  const last = useMemo(
    () => lastPerformance(exerciseId, sessionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, sessionId]
  );

  const done = sets.filter((s) => s.completed).length;
  const activeSet = readOnly ? undefined : sets.find((s) => !s.completed);

  const prevWeight = (idx: number) => last?.sets[idx]?.actualWeight ?? null;
  const startWeight = (s: WorkoutSet) =>
    s.actualWeight ?? prevWeight(s.setIndex) ?? s.targetWeight ?? 0;

  const complete = (s: WorkoutSet) => {
    const w = s.actualWeight ?? startWeight(s);
    // reps are optional; 0 / untouched means "not counted"
    const reps = s.actualReps && s.actualReps > 0 ? s.actualReps : null;
    updateSet(s.id, { actualWeight: w, actualReps: reps });
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

      {/* rounds (sets) */}
      <div className="space-y-1.5">
        {sets.map((s) => {
          const prev = prevWeight(s.setIndex);

          if (s === activeSet) {
            return (
              <div key={s.id} className="space-y-2 rounded-xl bg-bg/60 p-2.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Round {s.setIndex + 1}</span>
                  <span>
                    last time <b className="text-inkSoft">{prev != null ? `${prev} ${units}` : "—"}</b>
                  </span>
                </div>
                <Stepper
                  value={startWeight(s)}
                  step={plateIncrement(units)}
                  unit={units}
                  onChange={(v) => updateSet(s.id, { actualWeight: v })}
                />
                <div className="space-y-1">
                  <p className="text-[11px] text-muted">How many times? (optional)</p>
                  <Stepper
                    value={s.actualReps ?? 0}
                    step={1}
                    min={0}
                    unit="reps"
                    onChange={(v) => updateSet(s.id, { actualReps: v })}
                  />
                </div>
                <CompleteButton onComplete={() => complete(s)} />
              </div>
            );
          }

          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm ${
                s.completed ? "bg-green/15 animate-completeWipe" : "bg-surface2/50"
              }`}
            >
              <span className="w-12 shrink-0 text-xs text-muted">Round {s.setIndex + 1}</span>
              <span className="flex-1 text-center text-base font-bold tabular-nums text-ink">
                {(s.completed ? s.actualWeight : s.targetWeight) ?? "–"} {units}
                {s.completed && s.actualReps ? (
                  <span className="text-sm font-normal text-muted"> × {s.actualReps}</span>
                ) : null}
              </span>
              {s.completed ? (
                <button
                  aria-label="undo round"
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
          <button className="text-sm font-semibold text-accent" onClick={() => addSet(sessionId, exerciseId)}>
            + Add round
          </button>
          <span className="text-xs text-muted">{done} done</span>
        </div>
      )}
    </section>
  );
}
