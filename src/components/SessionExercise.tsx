"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Info, Plus, Sparkles, TrendingUp, X } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { CompleteButton } from "@/components/CompleteButton";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { ExerciseCoachSheet } from "@/components/ExerciseCoachSheet";
import { PlateLoader } from "@/components/PlateLoader";
import { barWeight } from "@/domain/plates";
import { suggestNextLoad } from "@/domain/progression";
import { exerciseTypeOf, usesReps, usesWeight } from "@/domain/exerciseType";
import { SET_KINDS, label, type ExerciseType, type SetKind } from "@/domain/taxonomy";
import { useStore } from "@/lib/store";
import { useRestTimer, defaultRest } from "@/lib/restTimer";
import { formatWeight, fromDisplay, toDisplay, weightStep } from "@/lib/units";
import { haptic } from "@/lib/haptics";
import type { Device, Units, WorkoutSet } from "@/domain/types";
import { showsRpe } from "@/domain/coachingProfile";

const WARMUP_REST = 60;

/** Display value for the weight stepper: exact conversion, 2 decimals. */
const stepperValue = (kg: number, units: Units) => Math.round(toDisplay(kg, units) * 100) / 100;

function weightLabel(type: ExerciseType): string {
  if (type === "assisted_bodyweight") return "Assistance";
  if (type === "weighted_bodyweight") return "Added weight";
  return "Weight";
}

/** One-line summary of a set's numbers, e.g. "60 kg × 8" or "BW + 10 kg × 6". */
export function describeSet(s: WorkoutSet, type: ExerciseType, units: Units, planned = false): string {
  if (type === "duration") return `${s.durationSec ?? (planned ? s.targetReps : null) ?? "–"} s`;
  if (type === "cardio") {
    const parts = [`${s.durationMin ?? (planned ? s.targetReps : null) ?? "–"} min`];
    if (s.speed) parts.push(`${s.speed} spd`);
    if (s.incline) parts.push(`${s.incline}% incl.`);
    if (s.distance) parts.push(`${s.distance} km`);
    return parts.join(" · ");
  }
  const w = planned ? (s.actualWeight ?? s.targetWeight) : s.actualWeight;
  const r = planned ? (s.actualReps ?? s.targetReps) : s.actualReps;
  const reps = r != null ? ` × ${r}` : "";
  if (type === "bodyweight_reps") return `${r ?? "–"} reps`;
  if (type === "weighted_bodyweight") return w ? `BW + ${formatWeight(w, units)}${reps}` : `BW${reps}`;
  if (type === "assisted_bodyweight") return `${formatWeight(w, units)} assist${reps}`;
  return `${formatWeight(w, units)}${reps}`;
}

/**
 * Logging card for one exercise in a workout. Completed sets collapse to a
 * compact list; the current set expands into big, glove-friendly steppers
 * that match how the exercise is logged (load × reps, reps, time or cardio).
 * Weights are converted to/from kilograms at this boundary.
 */
export function SessionExercise({
  sessionId,
  exerciseId,
  sets,
  readOnly = false,
  editable = false,
  onPr,
  onSwapped,
}: {
  sessionId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  readOnly?: boolean;
  editable?: boolean; // allow correcting logged sets (live or finished workout)
  onPr: (kinds: string[]) => void;
  /** Called with the new exercise after the coach swaps this one out. */
  onSwapped?: (exerciseId: string) => void;
}) {
  const units = useStore((s) => s.units);
  const rpeOn = useStore((s) => showsRpe(s.profile.coaching));
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const removeSet = useStore((s) => s.removeSet);
  const completeSet = useStore((s) => s.completeSet);
  const editSet = useStore((s) => s.editSet);
  const revertSet = useStore((s) => s.revertSet);
  const setExerciseDevice = useStore((s) => s.setExerciseDevice);
  const moveSet = useStore((s) => s.moveSet);
  const devices = useStore((s) => s.devices);
  // Other exercises in this workout, for "logged on the wrong card".
  const siblings = useStore((s) => {
    const ids: string[] = [];
    for (const x of s.sets) if (x.sessionId === sessionId && x.exerciseId !== exerciseId && !ids.includes(x.exerciseId)) ids.push(x.exerciseId);
    return ids.join(",");
  });
  const lastPerformance = useStore((s) => s.lastPerformance);
  const missStreak = useStore((s) => s.missStreak);
  const templateExercise = useStore((s) => {
    const session = s.sessions.find((x) => x.id === sessionId);
    const tpl = session?.templateId ? s.templates.find((t) => t.id === session.templateId) : undefined;
    return tpl?.exercises.find((te) => te.exerciseId === exerciseId);
  });
  const startRest = useRestTimer((s) => s.start);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const ex = exerciseById(exerciseId);
  const device = deviceById(sets[0]?.deviceId ?? ex?.defaultDeviceId ?? undefined);
  const type = exerciseTypeOf(ex, device);
  const isCompound = ex?.isCompound ?? false;
  const weighted = usesWeight(type);
  const counted = usesReps(type);
  // Bar exercises get a live plate diagram under the weight stepper.
  const bar = type === "weight_reps" ? barWeight(ex?.equipment, units) : null;
  const rest = templateExercise?.restSeconds ?? defaultRest(isCompound);

  const last = useMemo(
    () => lastPerformance(exerciseId, sessionId),
    // History doesn't change while this card is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, sessionId],
  );

  const targetReps = templateExercise?.sets[0]?.targetReps ?? last?.targetReps ?? (isCompound ? 8 : 12);

  // Progression hint, computed in display units so the step reads naturally.
  const suggestion = useMemo(() => {
    if (!weighted || type === "assisted_bodyweight" || !last) return null;
    if (!last.sets.some((s) => (s.actualWeight ?? 0) > 0)) return null;
    const inDisplay = {
      targetReps,
      sets: last.sets.map((s) => ({
        ...s,
        actualWeight: s.actualWeight == null ? null : toDisplay(s.actualWeight, units),
      })),
    };
    const repMax = templateExercise?.repMax;
    return suggestNextLoad(inDisplay, units, {
      isCompound,
      missStreak: missStreak(exerciseId, targetReps),
      repRange: repMax && repMax > targetReps ? { min: targetReps, max: repMax } : null,
      loading:
        device?.loading === "stack"
          ? "stack"
          : ex?.equipment === "dumbbell" || ex?.equipment === "kettlebell"
            ? "dumbbell"
            : "plates",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, units, weighted, type, targetReps, isCompound, exerciseId, device?.loading, templateExercise?.repMax]);

  const done = sets.filter((s) => s.completed);
  const activeSet = readOnly ? undefined : sets.find((s) => !s.completed);
  const lastDone = done[done.length - 1];
  // A warm-up shouldn't drag the next working set down to warm-up weight.
  const lastWorking = [...done].reverse().find((s) => s.kind !== "warmup") ?? lastDone;
  const lastTime = (s: WorkoutSet) => last?.sets[s.setIndex] ?? last?.sets[last.sets.length - 1];

  // Starting values for the current set: what's typed → what you just did →
  // what you did last time → the plan. Suggestions only apply when tapped.
  const startWeight = (s: WorkoutSet) =>
    s.actualWeight ?? lastWorking?.actualWeight ?? lastTime(s)?.actualWeight ?? s.targetWeight ?? 0;
  const startReps = (s: WorkoutSet) =>
    s.actualReps ?? lastWorking?.actualReps ?? lastTime(s)?.actualReps ?? s.targetReps ?? targetReps;
  const startHold = (s: WorkoutSet) => s.durationSec ?? s.targetReps ?? lastDone?.durationSec ?? 30;
  const startMinutes = (s: WorkoutSet) => s.durationMin ?? lastDone?.durationMin ?? s.targetReps ?? 20;
  const startSpeed = (s: WorkoutSet) => s.speed ?? lastDone?.speed ?? 0;
  const startIncline = (s: WorkoutSet) => s.incline ?? lastDone?.incline ?? 0;
  const startDistance = (s: WorkoutSet) => s.distance ?? lastDone?.distance ?? 0;

  const complete = (s: WorkoutSet) => {
    if (type === "duration") {
      updateSet(s.id, { durationSec: startHold(s) });
    } else if (type === "cardio") {
      const dist = startDistance(s);
      updateSet(s.id, {
        durationMin: startMinutes(s),
        speed: startSpeed(s) || null,
        incline: startIncline(s) || null,
        distance: dist > 0 ? dist : null,
      });
    } else {
      const reps = startReps(s);
      updateSet(s.id, {
        actualWeight: weighted ? startWeight(s) : null,
        actualReps: reps > 0 ? reps : null,
      });
    }
    const { newPrs } = completeSet(s.id);
    if (type !== "cardio") startRest(s.kind === "warmup" ? WARMUP_REST : rest);
    if (newPrs.length) {
      haptic("pr");
      onPr(newPrs);
    } else {
      haptic("tick");
    }
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    const kg = fromDisplay(suggestion.weight, units);
    for (const s of sets)
      if (!s.completed && s.kind !== "warmup") updateSet(s.id, { actualWeight: kg, actualReps: suggestion.reps });
    haptic("tick");
  };

  let working = 0;
  const numbers = new Map<string, string>();
  for (const s of sets) {
    const kind = SET_KINDS.find((k) => k.key === (s.kind ?? "normal"));
    if (kind?.short) numbers.set(s.id, kind.short);
    else numbers.set(s.id, String(++working));
  }

  // Machines that could stand in for this one: same kind, same muscle first.
  const deviceChoices = useMemo(() => {
    if (!device) return [];
    return devices
      .filter((d) => d.category === device.category)
      .sort(
        (a, b) =>
          Number(b.primaryMuscle === device.primaryMuscle) - Number(a.primaryMuscle === device.primaryMuscle) ||
          a.name.localeCompare(b.name),
      );
  }, [devices, device]);
  const siblingList = useMemo(
    () => (siblings ? siblings.split(",") : []).map((id) => ({ id, name: exerciseById(id)?.name ?? "Exercise" })),
    [siblings, exerciseById],
  );

  const muscles = [ex?.primaryMuscle, ...(ex?.secondaryMuscles ?? [])].filter(Boolean) as string[];
  const steps = ex?.instructions ?? [];
  const cue = templateExercise?.cue ?? null;

  return (
    <section className="card space-y-4 p-4 sm:p-6">
      {/* header */}
      <div className="flex items-start gap-3">
        <DeviceAvatar device={device} className="h-11 w-11 rounded-control text-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="text-h3 leading-tight text-ink">{ex?.name ?? "Exercise"}</h2>
          <p className="mt-0.5 truncate text-xs text-muted">
            {device ? `${device.name}${device.machineNumber ? ` · No. ${device.machineNumber}` : ""}` : label(type)}
            {" · "}
            {done.length}/{sets.length} sets
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setCoachOpen(true)}
            aria-label="Exercise coach"
            title="Exercise coach"
            data-testid="open-exercise-coach"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-ai/15 text-ai transition-colors hover:bg-ai/25"
          >
            <Sparkles className="h-5 w-5" aria-hidden />
          </button>
        )}
        {(steps.length > 0 || muscles.length > 0 || device?.guidance) && (
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
            aria-label="How to do this exercise"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-control transition-colors ${
              showInfo ? "bg-accent/15 text-accent" : "bg-surface2 text-inkSoft hover:text-ink"
            }`}
          >
            <Info className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      {showInfo && (
        <div className="space-y-3 rounded-control bg-surface2/60 p-4 text-sm text-inkSoft enter-fade">
          {muscles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {muscles.map((m, i) => (
                <span key={m} className={i === 0 ? "badge-accent" : "badge-neutral"}>
                  {label(m)}
                </span>
              ))}
            </div>
          )}
          {steps.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5">
              {steps.map((st) => (
                <li key={st}>{st}</li>
              ))}
            </ol>
          )}
          {device?.guidance && <p className="text-xs text-muted">{device.guidance}</p>}
        </div>
      )}

      <ExerciseCoachSheet
        open={coachOpen}
        sessionId={sessionId}
        exerciseId={exerciseId}
        onClose={() => setCoachOpen(false)}
        onSwapped={onSwapped}
      />

      {cue && <p className="rounded-control bg-surface2/60 px-3 py-2 text-sm text-inkSoft">“{cue}”</p>}

      {/* last time + suggestion */}
      {!readOnly && counted && last && last.sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="min-w-0 truncate">
            Last time:{" "}
            <span className="text-inkSoft">
              {last.sets
                .slice(0, 5)
                .map((s) =>
                  describeSet(s as WorkoutSet, type, units),
                )
                .join(", ")}
            </span>
          </span>
          {suggestion && suggestion.action !== "start" && (
            <button
              type="button"
              onClick={applySuggestion}
              title={suggestion.reason}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                suggestion.action === "increase" || suggestion.action === "add_reps"
                  ? "bg-successSoft text-green"
                  : suggestion.action === "deload"
                    ? "bg-warningSoft text-amber"
                    : "bg-surface2 text-inkSoft"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              {suggestion.action === "increase" ? "Try" : suggestion.action === "deload" ? "Deload to" : "Repeat"}{" "}
              {suggestion.weight} {units}
              {suggestion.action === "add_reps" ? ` × ${suggestion.reps}` : ""}?
              <span className="ml-0.5 underline underline-offset-2">Apply</span>
            </button>
          )}
        </div>
      )}

      {/* sets */}
      <ul className="space-y-2">
        {sets.map((s) => {
          const tag = numbers.get(s.id) ?? "";
          const kind: SetKind = s.kind ?? "normal";

          if (s === activeSet) {
            return (
              <li key={s.id} className="space-y-5 rounded-card border border-accent/30 bg-bg/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {kind === "normal" ? `Set ${tag}` : SET_KINDS.find((k) => k.key === kind)?.label}
                    {s.targetReps != null && counted && (
                      <span className="ml-2 font-normal text-muted">target {s.targetReps} reps</span>
                    )}
                  </p>
                  <button
                    type="button"
                    className="-my-2 -mr-2 flex min-h-11 items-center gap-1 rounded-control px-3 text-xs text-muted hover:text-danger"
                    onClick={() => removeSet(s.id)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden /> Remove
                  </button>
                </div>

                {counted && (
                  <div role="radiogroup" aria-label="Set type" className="grid grid-cols-4 gap-1 rounded-control bg-surface2 p-1">
                    {SET_KINDS.map((k) => (
                      <button
                        key={k.key}
                        type="button"
                        role="radio"
                        aria-checked={kind === k.key}
                        onClick={() => updateSet(s.id, { kind: k.key === "normal" ? undefined : k.key })}
                        className={`min-h-10 rounded-md py-2 text-xs font-semibold transition-colors ${
                          kind === k.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-inkSoft"
                        }`}
                      >
                        {k.key === "normal" ? "Working" : k.key === "warmup" ? "Warm-up" : k.key === "drop" ? "Drop" : "Failure"}
                      </button>
                    ))}
                  </div>
                )}

                {type === "duration" && (
                  <Field label="Duration">
                    <Stepper
                      label="Duration in seconds"
                      size="lg"
                      value={startHold(s)}
                      step={5}
                      min={5}
                      unit="sec"
                      onChange={(v) => updateSet(s.id, { durationSec: v })}
                    />
                  </Field>
                )}

                {type === "cardio" && (
                  <>
                    <Field label="Time">
                      <Stepper label="Minutes" size="lg" value={startMinutes(s)} step={1} min={1} unit="min" onChange={(v) => updateSet(s.id, { durationMin: v })} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Speed">
                        <Stepper label="Speed" value={startSpeed(s)} step={0.5} unit="km/h" onChange={(v) => updateSet(s.id, { speed: v })} />
                      </Field>
                      <Field label="Incline / level">
                        <Stepper label="Incline" value={startIncline(s)} step={0.5} unit="%" onChange={(v) => updateSet(s.id, { incline: v })} />
                      </Field>
                      <Field label="Distance (optional)">
                        <Stepper label="Distance" value={startDistance(s)} step={0.1} unit="km" onChange={(v) => updateSet(s.id, { distance: v })} />
                      </Field>
                    </div>
                  </>
                )}

                {weighted && (
                  <Field label={weightLabel(type)}>
                    <Stepper
                      label={weightLabel(type)}
                      size="lg"
                      value={stepperValue(startWeight(s), units)}
                      step={weightStep(units)}
                      unit={units}
                      onChange={(v) => updateSet(s.id, { actualWeight: fromDisplay(v, units) })}
                    />
                    {bar != null && <PlateLoader total={stepperValue(startWeight(s), units)} bar={bar} units={units} />}
                  </Field>
                )}

                {counted && (
                  <Field label="Reps">
                    <Stepper
                      label="Reps"
                      size={weighted ? "default" : "lg"}
                      value={startReps(s)}
                      step={1}
                      min={0}
                      max={200}
                      unit="reps"
                      onChange={(v) => updateSet(s.id, { actualReps: v })}
                    />
                  </Field>
                )}

                {counted && kind !== "warmup" && rpeOn && (
                  <Field label="Effort (RPE)" hint="Optional · 10 = nothing left, 8 = 2 in reserve">
                    <div className="grid grid-cols-5 gap-1.5">
                      {[6, 7, 8, 9, 10].map((rpe) => (
                        <button
                          key={rpe}
                          type="button"
                          aria-pressed={s.rpe === rpe}
                          onClick={() => updateSet(s.id, { rpe: s.rpe === rpe ? null : rpe })}
                          className={`min-h-11 rounded-control py-2.5 text-sm font-semibold transition-transform duration-100 active:scale-95 ${
                            s.rpe === rpe ? "bg-accentFill text-onAccent" : "bg-surface2 text-inkSoft hover:text-ink"
                          }`}
                        >
                          {rpe}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                <CompleteButton
                  onComplete={() => complete(s)}
                  label={type === "cardio" ? "Log cardio" : type === "duration" ? "Log hold" : "Complete set"}
                />
              </li>
            );
          }

          if (editable && editingId === s.id && s.completed) {
            return (
              <EditSetRow
                key={s.id}
                set={s}
                tag={tag}
                weighted={weighted}
                counted={counted}
                units={units}
                device={device?.id ?? null}
                devices={deviceChoices}
                exercises={siblingList}
                onCancel={() => setEditingId(null)}
                onRevert={() => {
                  revertSet(s.id);
                  setEditingId(null);
                }}
                onDelete={() => {
                  removeSet(s.id);
                  setEditingId(null);
                }}
                onSave={({ kg, reps, deviceId, moveTo }) => {
                  if (counted) editSet(s.id, { actualWeight: weighted ? kg : null, actualReps: reps > 0 ? reps : null });
                  if (deviceId !== (device?.id ?? null)) setExerciseDevice(sessionId, exerciseId, deviceId);
                  if (moveTo) moveSet(s.id, moveTo);
                  setEditingId(null);
                }}
              />
            );
          }

          const canEdit = editable && s.completed;
          return (
            <li
              key={s.id}
              onClick={() => canEdit && setEditingId(s.id)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && canEdit) {
                  e.preventDefault();
                  setEditingId(s.id);
                }
              }}
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? 0 : undefined}
              className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-sm ${
                s.completed ? "bg-successSoft/70" : "bg-surface2/50"
              } ${canEdit ? "cursor-pointer hover:bg-successSoft" : ""}`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  kind === "warmup"
                    ? "bg-warningSoft text-amber"
                    : kind === "drop" || kind === "failure"
                      ? "bg-danger/10 text-danger"
                      : "bg-surface text-inkSoft"
                }`}
                title={SET_KINDS.find((k) => k.key === kind)?.label}
              >
                {tag}
              </span>
              <span className={`min-w-0 flex-1 truncate font-semibold tabular-nums ${s.completed ? "text-ink" : "text-muted"}`}>
                {describeSet(
                  s.completed || !counted ? s : { ...s, actualWeight: startWeight(s), actualReps: startReps(s) },
                  type,
                  units,
                  !s.completed,
                )}
                {s.completed && s.rpe != null && <span className="ml-2 text-xs font-normal text-muted">RPE {s.rpe}</span>}
                {s.editedAt && <span className="ml-2 text-[10px] font-semibold uppercase text-amber">edited</span>}
              </span>
              {canEdit && <span className="text-xs font-semibold text-accent">Edit</span>}
              {!readOnly && !s.completed && (
                <button
                  type="button"
                  aria-label={`Delete set ${tag}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSet(s.id);
                  }}
                  className="-my-2 -mr-2 grid h-11 w-11 place-items-center rounded-control text-muted hover:text-danger"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
              {s.completed && !readOnly ? (
                <button
                  type="button"
                  aria-label={`Undo set ${tag}`}
                  title="Undo"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSet(s.id, { completed: false, completedAt: null });
                  }}
                  className="group -my-2 -mr-2 grid h-11 w-11 place-items-center"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-control bg-green text-onStatus transition-transform group-active:scale-90">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  </span>
                </button>
              ) : s.completed ? (
                <Check className="h-4 w-4 text-green" strokeWidth={3} aria-label="Done" />
              ) : null}
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-border py-3 text-sm font-semibold text-accent hover:bg-accent/[0.05]"
          onClick={() => addSet(sessionId, exerciseId)}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add set
        </button>
      )}
      {editable && done.length > 0 && (
        <p className="flex items-center justify-center gap-1 text-center text-xs text-muted">
          <ChevronDown className="h-3.5 w-3.5" aria-hidden /> Tap a logged set to fix it
        </p>
      )}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between gap-2 text-xs font-medium text-muted">
        <span>{label}</span>
        {hint && <span className="text-[11px] font-normal">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

/** Inline corrector for a logged set; value edits write an audit entry. */
function EditSetRow({
  set,
  tag,
  weighted,
  counted,
  units,
  device,
  devices,
  exercises,
  onSave,
  onRevert,
  onDelete,
  onCancel,
}: {
  set: WorkoutSet;
  tag: string;
  weighted: boolean;
  counted: boolean;
  units: Units;
  device: string | null;
  devices: Device[];
  exercises: { id: string; name: string }[];
  onSave: (v: { kg: number; reps: number; deviceId: string | null; moveTo: string | null }) => void;
  onRevert: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [w, setW] = useState(stepperValue(set.actualWeight ?? 0, units));
  const [r, setR] = useState(set.actualReps ?? 0);
  const [deviceId, setDeviceId] = useState(device);
  const [moveTo, setMoveTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <li className="space-y-3 rounded-control border border-accent/40 bg-bg/60 p-3">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="font-semibold text-ink">Fix set {tag}</span>
        {set.editedAt && (
          <button type="button" className="-my-2 min-h-11 px-1 text-accent" onClick={onRevert}>
            Revert to original
          </button>
        )}
      </div>
      {counted && weighted && <Stepper label="Weight" value={w} step={weightStep(units)} unit={units} onChange={setW} />}
      {counted && <Stepper label="Reps" value={r} step={1} min={0} unit="reps" onChange={setR} />}
      {devices.length > 1 && (
        <label className="block space-y-1 text-xs font-medium text-muted">
          <span>Machine (all sets of this exercise)</span>
          <select className="input py-2.5 text-sm" value={deviceId ?? ""} onChange={(e) => setDeviceId(e.target.value || null)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.machineNumber ? ` · No. ${d.machineNumber}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {exercises.length > 0 && (
        <label className="block space-y-1 text-xs font-medium text-muted">
          <span>Logged on the wrong exercise?</span>
          <select className="input py-2.5 text-sm" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">Keep it here</option>
            {exercises.map((x) => (
              <option key={x.id} value={x.id}>
                Move to {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn flex-none px-4 ${confirmDelete ? "bg-danger text-white" : "bg-danger/[0.08] text-danger"}`}
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        >
          {confirmDelete ? "Tap to delete" : "Delete"}
        </button>
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => onSave({ kg: fromDisplay(w, units), reps: r, deviceId, moveTo: moveTo || null })}
        >
          Save
        </button>
      </div>
    </li>
  );
}
