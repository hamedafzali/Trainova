"use client";

import { useMemo, useState } from "react";
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
  editable = false,
  onPr,
}: {
  sessionId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  readOnly?: boolean;
  editable?: boolean; // completed session → allow safe correction of logged rounds
  onPr: (kinds: string[]) => void;
}) {
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const completeSet = useStore((s) => s.completeSet);
  const editSet = useStore((s) => s.editSet);
  const revertSet = useStore((s) => s.revertSet);
  const lastPerformance = useStore((s) => s.lastPerformance);
  const startRest = useRestTimer((s) => s.start);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const DEFAULT_REPS = 10;
  const prevWeight = (idx: number) => last?.sets[idx]?.actualWeight ?? null;
  // The weight you used on your last completed round this session.
  const lastRoundWeight = (() => {
    const doneSets = sets.filter((x) => x.completed && x.actualWeight != null);
    return doneSets.length ? (doneSets[doneSets.length - 1].actualWeight as number) : null;
  })();
  const startWeight = (s: WorkoutSet) =>
    s.actualWeight ?? lastRoundWeight ?? s.targetWeight ?? prevWeight(s.setIndex) ?? 0;
  const startReps = (s: WorkoutSet) => s.actualReps ?? DEFAULT_REPS;

  const complete = (s: WorkoutSet) => {
    const w = s.actualWeight ?? startWeight(s);
    // reps default to 10; set the stepper to 0 to record "not counted".
    const r = s.actualReps ?? DEFAULT_REPS;
    const reps = r > 0 ? r : null;
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
                  <p className="text-[11px] text-muted">Reps (defaults to 10 — set 0 to skip)</p>
                  <Stepper
                    value={startReps(s)}
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

          if (editable && editingId === s.id) {
            return (
              <EditRoundRow
                key={s.id}
                set={s}
                units={units}
                onCancel={() => setEditingId(null)}
                onRevert={() => {
                  revertSet(s.id);
                  setEditingId(null);
                }}
                onSave={(w, r) => {
                  editSet(s.id, { actualWeight: w, actualReps: r > 0 ? r : null });
                  setEditingId(null);
                }}
              />
            );
          }

          return (
            <div
              key={s.id}
              onClick={() => editable && s.completed && setEditingId(s.id)}
              className={`flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm ${
                s.completed ? "bg-green/15 animate-completeWipe" : "bg-surface2/50"
              } ${editable && s.completed ? "cursor-pointer" : ""}`}
            >
              <span className="w-12 shrink-0 text-xs text-muted">Round {s.setIndex + 1}</span>
              <span className="flex-1 text-center text-base font-bold tabular-nums text-ink">
                {(s.completed ? s.actualWeight : s.targetWeight) ?? "–"} {units}
                {s.completed && s.actualReps ? (
                  <span className="text-sm font-normal text-muted"> × {s.actualReps}</span>
                ) : null}
                {s.editedAt && (
                  <span className="ml-1 align-middle text-[10px] uppercase text-amber">edited</span>
                )}
              </span>
              {editable && s.completed ? (
                <span className="text-xs text-accent">Edit</span>
              ) : s.completed ? (
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
      {editable && <p className="text-center text-[11px] text-muted">Tap a round to correct it</p>}
    </section>
  );
}

/** Inline corrector for a logged round; saving writes an audit entry. */
function EditRoundRow({
  set,
  units,
  onSave,
  onRevert,
  onCancel,
}: {
  set: WorkoutSet;
  units: string;
  onSave: (weight: number, reps: number) => void;
  onRevert: () => void;
  onCancel: () => void;
}) {
  const [w, setW] = useState(set.actualWeight ?? 0);
  const [r, setR] = useState(set.actualReps ?? 10);
  const step = units === "kg" ? 2.5 : 5;
  return (
    <div className="space-y-2 rounded-xl border border-accent/40 bg-bg/60 p-2.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Correct round {set.setIndex + 1}</span>
        {set.editedAt && (
          <button className="text-accent" onClick={onRevert}>
            Revert to original
          </button>
        )}
      </div>
      <Stepper value={w} step={step} unit={units} onChange={setW} />
      <div className="space-y-1">
        <p className="text-[11px] text-muted">How many times? (optional)</p>
        <Stepper value={r} step={1} min={0} unit="reps" onChange={setR} />
      </div>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary flex-1" onClick={() => onSave(w, r)}>
          Save
        </button>
      </div>
    </div>
  );
}
