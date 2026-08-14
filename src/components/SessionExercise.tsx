"use client";

import { useMemo, useState, useRef } from "react";
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
  const removeSet = useStore((s) => s.removeSet);
  const completeSet = useStore((s) => s.completeSet);
  const editSet = useStore((s) => s.editSet);
  const revertSet = useStore((s) => s.revertSet);
  const lastPerformance = useStore((s) => s.lastPerformance);
  const startRest = useRestTimer((s) => s.start);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipingSetId, setSwipingSetId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const ex = exerciseById(exerciseId);
  const device = deviceById(sets[0]?.deviceId ?? ex?.defaultDeviceId);
  const isCompound = ex?.isCompound ?? false;

  const last = useMemo(
    () => lastPerformance(exerciseId, sessionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, sessionId],
  );

  const done = sets.filter((s) => s.completed).length;
  const activeSet = readOnly ? undefined : sets.find((s) => !s.completed);

  const DEFAULT_REPS = 10;
  const prevWeight = (idx: number) => last?.sets[idx]?.actualWeight ?? null;
  // The weight you used on your last completed round this session.
  const lastRoundWeight = (() => {
    const doneSets = sets.filter((x) => x.completed && x.actualWeight != null);
    return doneSets.length
      ? (doneSets[doneSets.length - 1].actualWeight as number)
      : null;
  })();
  const startWeight = (s: WorkoutSet) =>
    s.actualWeight ??
    lastRoundWeight ??
    s.targetWeight ??
    prevWeight(s.setIndex) ??
    0;
  const startReps = (s: WorkoutSet) => s.actualReps ?? DEFAULT_REPS;

  const complete = (s: WorkoutSet) => {
    const w = s.actualWeight ?? startWeight(s);
    // reps default to 10; set the stepper to 0 to record "not counted".
    const r = s.actualReps ?? DEFAULT_REPS;
    const reps = r > 0 ? r : null;
    updateSet(s.id, { actualWeight: w, actualReps: reps, rpe: s.rpe ?? 8 });
    const { newPrs } = completeSet(s.id);
    startRest(defaultRest(isCompound));
    if (newPrs.length) {
      haptic("pr");
      onPr(newPrs);
    } else {
      haptic("tick");
    }
  };

  // Touch handlers for swipe-to-complete
  const handleTouchStart = (e: React.TouchEvent, setId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipingSetId(setId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingSetId) return;

    const touchX = e.touches[0].clientX;
    const deltaX = touchX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only allow horizontal swipes (prevent vertical scrolling interference)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setSwipeOffset(Math.max(-100, Math.min(100, deltaX)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, s: WorkoutSet) => {
    if (!swipingSetId) return;

    // Swipe right to complete (positive offset)
    if (swipeOffset > 50) {
      complete(s);
      haptic("tick");
    }

    // Reset swipe state
    setSwipeOffset(0);
    setSwipingSetId(null);
  };

  // ── Cardio (treadmill etc.): minutes / speed / incline / distance ──
  const isCardio = device?.category === "cardio";
  const lastCardio = (() => {
    const d = sets.filter((x) => x.completed && x.durationMin != null);
    return d.length ? d[d.length - 1] : null;
  })();
  const startDur = (s: WorkoutSet) =>
    s.durationMin ?? lastCardio?.durationMin ?? 20;
  const startSpeed = (s: WorkoutSet) => s.speed ?? lastCardio?.speed ?? 6;
  const startIncline = (s: WorkoutSet) => s.incline ?? lastCardio?.incline ?? 0;
  const startDistance = (s: WorkoutSet) =>
    s.distance ?? lastCardio?.distance ?? 0;

  const completeCardio = (s: WorkoutSet) => {
    const dist = startDistance(s);
    updateSet(s.id, {
      durationMin: startDur(s),
      speed: startSpeed(s) || null,
      incline: startIncline(s) || null,
      distance: dist > 0 ? dist : null,
    });
    completeSet(s.id);
    haptic("tick");
  };

  // ── Timed holds (plank, dead-hang): duration in seconds, no weight ──
  const isTime = ex?.mode === "time" && !isCardio;
  const lastHold = (() => {
    const d = sets.filter((x) => x.completed && x.durationSec != null);
    return d.length ? d[d.length - 1] : null;
  })();
  const startHold = (s: WorkoutSet) =>
    s.durationSec ?? lastHold?.durationSec ?? 30;
  const completeTime = (s: WorkoutSet) => {
    updateSet(s.id, { durationSec: startHold(s) });
    completeSet(s.id);
    startRest(60);
    haptic("tick");
  };

  return (
    <section className="card space-y-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <DeviceAvatar
          device={device}
          className="h-10 w-10 rounded-control text-sm"
        />
        <div className="flex-1">
          <h3 className="text-h3 leading-tight text-ink">
            {ex?.name ?? "Exercise"}
          </h3>
          {device && (
            <p className="text-[11px] text-muted">
              {device.name}
              {device.machineNumber ? ` · No.${device.machineNumber}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {sets.map((s) => (
            <span
              key={s.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                s.completed
                  ? "bg-green"
                  : s === activeSet
                    ? "bg-accent"
                    : "border border-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* rounds (sets) */}
      <div className="space-y-2">
        {sets.map((s) => {
          const prev = prevWeight(s.setIndex);

          if (s === activeSet && isTime) {
            return (
              <div key={s.id} className="space-y-5 rounded-card bg-bg/60 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted">
                    Hold {s.setIndex + 1}
                    {lastHold?.durationSec != null && (
                      <>
                        {" "}
                        · last <b className="text-inkSoft">{lastHold.durationSec}s</b>
                      </>
                    )}
                  </p>
                  <button
                    className="text-xs text-danger transition-opacity active:opacity-60"
                    onClick={() => removeSet(s.id)}
                  >
                    Remove
                  </button>
                </div>
                <CardioField
                  label="Seconds"
                  value={startHold(s)}
                  step={5}
                  min={5}
                  unit="sec"
                  onChange={(v) => updateSet(s.id, { durationSec: v })}
                />
                <CompleteButton onComplete={() => completeTime(s)} />
              </div>
            );
          }

          if (s === activeSet && isCardio) {
            return (
              <div key={s.id} className="space-y-5 rounded-card bg-bg/60 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted">
                    Cardio
                    {lastCardio?.durationMin != null && (
                      <>
                        {" "}
                        · last <b className="text-inkSoft">{lastCardio.durationMin} min</b>
                      </>
                    )}
                  </p>
                  <button
                    className="text-xs text-danger transition-opacity active:opacity-60"
                    onClick={() => removeSet(s.id)}
                  >
                    Remove
                  </button>
                </div>
                <CardioField
                  label="Minutes"
                  value={startDur(s)}
                  step={1}
                  min={1}
                  unit="min"
                  onChange={(v) => updateSet(s.id, { durationMin: v })}
                />
                <CardioField
                  label="Speed"
                  value={startSpeed(s)}
                  step={0.5}
                  min={0}
                  unit="spd"
                  onChange={(v) => updateSet(s.id, { speed: v })}
                />
                <CardioField
                  label="Incline"
                  value={startIncline(s)}
                  step={0.5}
                  min={0}
                  unit="%"
                  onChange={(v) => updateSet(s.id, { incline: v })}
                />
                <CardioField
                  label="Distance (optional)"
                  value={startDistance(s)}
                  step={0.1}
                  min={0}
                  unit="dist"
                  onChange={(v) => updateSet(s.id, { distance: v })}
                />
                <CompleteButton onComplete={() => completeCardio(s)} />
              </div>
            );
          }

          if (s === activeSet) {
            return (
              <div
                key={s.id}
                className="space-y-6 rounded-card bg-bg/60 p-5"
                onTouchStart={(e) => handleTouchStart(e, s.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => handleTouchEnd(e, s)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted">
                    Round {s.setIndex + 1}
                    {prev != null && (
                      <>
                        {" "}
                        · last <b className="text-inkSoft">{prev} {units}</b>
                      </>
                    )}
                  </p>
                  <button
                    className="text-xs text-danger transition-opacity active:opacity-60"
                    onClick={() => removeSet(s.id)}
                  >
                    Remove
                  </button>
                </div>

                <Stepper
                  value={startWeight(s)}
                  step={plateIncrement(units)}
                  unit={units}
                  size="lg"
                  onChange={(v) => updateSet(s.id, { actualWeight: v })}
                />

                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted">
                    Reps (defaults to 10 — set 0 to skip)
                  </p>
                  <Stepper
                    value={startReps(s)}
                    step={1}
                    min={0}
                    unit="reps"
                    onChange={(v) => updateSet(s.id, { actualReps: v })}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted">
                    RPE (6=easy, 7=moderate, 8=standard, 9=hard, 10=max)
                  </p>
                  <div className="flex gap-1.5">
                    {[6, 7, 8, 9, 10].map((rpe) => (
                      <button
                        key={rpe}
                        onClick={() => updateSet(s.id, { rpe })}
                        className={`flex-1 rounded-control py-2.5 text-sm font-semibold transition-transform duration-100 active:scale-95 ${
                          s.rpe === rpe
                            ? "bg-accent text-onAccent"
                            : "bg-surface2 text-inkSoft"
                        }`}
                      >
                        {rpe}
                      </button>
                    ))}
                  </div>
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
                  editSet(s.id, {
                    actualWeight: w,
                    actualReps: r > 0 ? r : null,
                  });
                  setEditingId(null);
                }}
              />
            );
          }

          return (
            <div
              key={s.id}
              onClick={() => editable && s.completed && setEditingId(s.id)}
              className={`flex items-center gap-2 rounded-control px-2.5 py-2 text-sm transition-opacity ${
                s.completed
                  ? "bg-green/10 opacity-70 animate-completeWipe"
                  : "bg-surface2/40 opacity-80"
              } ${editable && s.completed ? "cursor-pointer" : ""}`}
            >
              <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-muted">
                {isCardio
                  ? "Cardio"
                  : isTime
                    ? "Hold"
                    : `Rd ${s.setIndex + 1}`}
              </span>
              <span className="flex-1 text-center text-sm font-semibold tabular-nums text-inkSoft">
                {isTime ? (
                  <span>{s.durationSec ?? "–"}s</span>
                ) : isCardio ? (
                  <span className="text-xs">
                    {s.durationMin ?? "–"} min
                    {s.incline ? ` · ${s.incline}% incline` : ""}
                    {s.distance ? ` · ${s.distance}` : ""}
                    {s.speed ? ` · ${s.speed} spd` : ""}
                  </span>
                ) : (
                  <>
                    {(s.completed ? s.actualWeight : s.targetWeight) ?? "–"}{" "}
                    {units}
                    {s.completed && s.actualReps ? (
                      <span className="text-xs font-normal text-muted">
                        {" "}
                        × {s.actualReps}
                      </span>
                    ) : null}
                  </>
                )}
                {s.editedAt && (
                  <span className="ml-1 align-middle text-[10px] uppercase text-amber">
                    edited
                  </span>
                )}
              </span>
              {!readOnly && (
                <button
                  aria-label="delete round"
                  onClick={() => removeSet(s.id)}
                  className="px-1 text-muted"
                >
                  ✕
                </button>
              )}
              {editable && s.completed ? (
                <span className="text-xs text-accent">Edit</span>
              ) : s.completed ? (
                <button
                  aria-label="undo round"
                  onClick={() =>
                    !readOnly && updateSet(s.id, { completed: false })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-control bg-green text-onAccent transition-transform active:scale-90"
                >
                  ✓
                </button>
              ) : (
                <span className="h-6 w-6 rounded-control border border-border" />
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between">
          <button
            className="text-sm font-semibold text-accent"
            onClick={() => addSet(sessionId, exerciseId)}
          >
            + Add round
          </button>
          <span className="text-xs text-muted">{done} done</span>
        </div>
      )}
      {editable && (
        <p className="text-center text-[11px] text-muted">
          Tap a round to correct it
        </p>
      )}
    </section>
  );
}

/** A labelled stepper for a cardio metric. */
function CardioField({
  label,
  value,
  step,
  min,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted">{label}</p>
      <Stepper
        value={value}
        step={step}
        min={min}
        unit={unit}
        onChange={onChange}
      />
    </div>
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
    <div className="space-y-2 rounded-control border border-accent/40 bg-bg/60 p-2.5">
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
