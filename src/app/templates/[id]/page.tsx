"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Dumbbell, FolderX, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { Stepper } from "@/components/Stepper";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { exerciseTypeOf, usesWeight } from "@/domain/exerciseType";
import { useHydrated, useStore } from "@/lib/store";
import { SEED_PLAN_ID } from "@/lib/seed";
import { displayWeight, formatWeight, fromDisplay, weightStep } from "@/lib/units";
import type { ExerciseType } from "@/domain/taxonomy";
import type { TemplateExercise, TemplateSet, Units } from "@/domain/types";

/** Rough minutes for a plan: ~40 s per working set plus its rest. */
function estimateMinutes(exercises: TemplateExercise[]): number {
  let sec = 0;
  for (const te of exercises) sec += te.sets.length * (40 + te.restSeconds);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

function targetLabel(type: ExerciseType): { unit: string; label: string; step: number; max: number } {
  if (type === "duration") return { unit: "s", label: "Hold", step: 5, max: 600 };
  if (type === "cardio") return { unit: "min", label: "Minutes", step: 1, max: 180 };
  return { unit: "reps", label: "Reps", step: 1, max: 100 };
}

function summarize(sets: TemplateSet[], type: ExerciseType, units: Units): string {
  if (sets.length === 0) return "No sets";
  const t = targetLabel(type);
  const reps = [...new Set(sets.map((s) => s.targetReps))];
  const repsText = reps.length === 1 ? `${reps[0]}${t.unit === "reps" ? "" : ` ${t.unit}`}` : reps.join("/");
  let text = `${sets.length} × ${repsText}`;
  if (usesWeight(type)) {
    const ws = [...new Set(sets.map((s) => s.targetWeight ?? 0))].filter((w) => w > 0);
    if (ws.length === 1) text += ` @ ${formatWeight(ws[0], units)}`;
    else if (ws.length > 1)
      text += ` @ ${formatWeight(Math.min(...ws), units, false)}–${formatWeight(Math.max(...ws), units)}`;
  }
  return text;
}

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const template = useStore((s) => s.templates.find((t) => t.id === id));
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const units = useStore((s) => s.units);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const addTemplateExercise = useStore((s) => s.addTemplateExercise);
  const removeTemplateExercise = useStore((s) => s.removeTemplateExercise);
  const moveTemplateExercise = useStore((s) => s.moveTemplateExercise);
  const updateTemplateExercise = useStore((s) => s.updateTemplateExercise);
  const setTemplateSetCount = useStore((s) => s.setTemplateSetCount);
  const updateTemplateSet = useStore((s) => s.updateTemplateSet);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);

  const [picking, setPicking] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!hydrated)
    return (
      <main className="mx-auto max-w-3xl space-y-6">
        <ListSkeleton variant="row" />
      </main>
    );
  if (!template) {
    return (
      <EmptyState
        icon={FolderX}
        title="Plan not found"
        body="It may have been deleted."
        action={
          <Link href="/templates" className="btn-primary mt-2">
            Back to plans
          </Link>
        }
      />
    );
  }

  const start = () => {
    const { id: sid, blocked } = startSession(template.id);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (sid) router.push(`/session/${sid}`);
  };

  const totalSets = template.exercises.reduce((n, te) => n + te.sets.length, 0);
  const removingEx = template.exercises.find((te) => te.id === removing);

  return (
    <main className="mx-auto max-w-3xl space-y-6 pb-24">
      <Link href="/templates" className="-my-3 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Workouts
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              aria-label="Plan name"
              className="input text-xl font-bold"
              defaultValue={template.name}
              autoFocus
              maxLength={60}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== template.name) updateTemplate(template.id, { name: v });
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <h1 className="page-title break-words">
              {template.name}
              <button
                type="button"
                aria-label="Rename plan"
                onClick={() => setEditingName(true)}
                className="ml-1 inline-grid h-11 w-11 place-items-center rounded-control align-middle text-muted hover:bg-surface2 hover:text-ink"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              {template.id === SEED_PLAN_ID && <span className="badge-accent ml-1 align-middle text-xs">Sample</span>}
            </h1>
          )}
          <p className="page-subtitle">
            {template.exercises.length} exercise{template.exercises.length === 1 ? "" : "s"} · {totalSets} sets
            {template.exercises.length > 0 && ` · ~${estimateMinutes(template.exercises)} min`}
          </p>
        </div>
        <button className="btn-primary w-full shrink-0 px-6 sm:w-auto" onClick={start} disabled={template.exercises.length === 0}>
          <Play className="h-4 w-4" aria-hidden /> Start workout
        </button>
      </header>

      <textarea
        aria-label="Plan notes"
        className="input min-h-[3rem] resize-y text-sm"
        placeholder="Notes for this plan (warm-up, focus, equipment to grab)…"
        defaultValue={template.notes ?? ""}
        maxLength={500}
        onBlur={(e) => {
          const v = e.target.value.trim() || null;
          if (v !== template.notes) updateTemplate(template.id, { notes: v });
        }}
      />

      {template.exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No exercises yet"
          body="Add the exercises you want to do in this workout. You can set sets, reps, weights and rest for each."
          action={
            <button className="btn-primary mt-2" onClick={() => setPicking(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add exercise
            </button>
          }
        />
      ) : (
        <ol className="space-y-3">
          {template.exercises.map((te, idx) => {
            const ex = exerciseById(te.exerciseId);
            const device = deviceById(te.deviceId ?? ex?.defaultDeviceId);
            const type = exerciseTypeOf(ex, device);
            const t = targetLabel(type);
            const open = openId === te.id;
            return (
              <li key={te.id} className="card overflow-hidden">
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  <span className="hidden w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted sm:inline">{idx + 1}</span>
                  <DeviceAvatar device={device} className="h-10 w-10 rounded-control text-sm" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : te.id)}
                  >
                    <p className="truncate font-semibold text-ink">{ex?.name ?? "Exercise"}</p>
                    <p className="truncate text-sm text-muted">
                      {summarize(te.sets, type, units)} · rest {te.restSeconds}s
                    </p>
                  </button>
                  <IconBtn label={open ? "Collapse" : "Edit"} onClick={() => setOpenId(open ? null : te.id)}>
                    <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                  </IconBtn>
                </div>

                {open && (
                  <div className="space-y-4 border-t border-border bg-surface2/40 p-3 sm:p-4">
                    <div className="space-y-2">
                      <div className={`grid items-center gap-2 text-xs font-medium text-muted ${usesWeight(type) ? "grid-cols-[2rem_1fr_1fr]" : "grid-cols-[2rem_1fr]"}`}>
                        <span>Set</span>
                        <span className="text-center">{t.label} {t.unit !== "reps" && `(${t.unit})`}</span>
                        {usesWeight(type) && <span className="text-center">Weight ({units})</span>}
                      </div>
                      {te.sets.map((st, i) => (
                        <div key={i} className={`grid items-center gap-2 ${usesWeight(type) ? "grid-cols-[2rem_1fr_1fr]" : "grid-cols-[2rem_1fr]"}`}>
                          <span className="text-center text-sm font-semibold tabular-nums text-inkSoft">{i + 1}</span>
                          <div className="min-w-0">
                            <Stepper
                              label={`Set ${i + 1} ${t.label.toLowerCase()}`}
                              value={st.targetReps}
                              step={t.step}
                              min={1}
                              max={t.max}
                              unit={t.unit}
                              size="sm"
                              onChange={(v) => updateTemplateSet(template.id, te.id, i, { targetReps: v })}
                            />
                          </div>
                          {usesWeight(type) && (
                            <div className="min-w-0">
                              <Stepper
                                label={`Set ${i + 1} weight`}
                                size="sm"
                                value={displayWeight(st.targetWeight ?? 0, units)}
                                step={weightStep(units)}
                                max={units === "kg" ? 500 : 1100}
                                unit={units}
                                onChange={(v) =>
                                  updateTemplateSet(template.id, te.id, i, { targetWeight: v ? fromDisplay(v, units) : null })
                                }
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          className="btn-ghost flex-1 py-2 text-sm"
                          disabled={te.sets.length <= 1}
                          onClick={() => setTemplateSetCount(template.id, te.id, te.sets.length - 1)}
                        >
                          Remove set
                        </button>
                        <button
                          type="button"
                          className="btn-ghost flex-1 py-2 text-sm"
                          disabled={te.sets.length >= 12}
                          onClick={() => setTemplateSetCount(template.id, te.id, te.sets.length + 1)}
                        >
                          <Plus className="h-4 w-4" aria-hidden /> Add set
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted">Rest between sets</p>
                        <Stepper
                          label="Rest"
                          value={te.restSeconds}
                          step={15}
                          min={0}
                          max={600}
                          unit="s"
                          onChange={(v) => updateTemplateExercise(template.id, te.id, { restSeconds: v })}
                        />
                      </div>
                      {type === "weight_reps" && te.sets.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted">
                            Rep range top{" "}
                            <span className="font-normal">
                              {te.repMax && te.repMax > te.sets[0].targetReps
                                ? `· ${te.sets[0].targetReps}–${te.repMax}: add reps, then load`
                                : "· off: add load when reps are hit"}
                            </span>
                          </p>
                          <Stepper
                            label="Rep range top"
                            value={Math.max(te.repMax ?? 0, te.sets[0].targetReps)}
                            step={1}
                            min={te.sets[0].targetReps}
                            max={50}
                            onChange={(v) =>
                              updateTemplateExercise(template.id, te.id, {
                                repMax: v > te.sets[0].targetReps ? v : null,
                              })
                            }
                          />
                        </div>
                      )}
                      <label className="space-y-1.5">
                        <span className="block text-xs font-medium text-muted">Cue / note</span>
                        <input
                          className="input py-2.5 text-sm"
                          placeholder="e.g. Seat on 4, slow negatives"
                          defaultValue={te.cue ?? ""}
                          maxLength={120}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== (te.cue ?? null)) updateTemplateExercise(template.id, te.id, { cue: v });
                          }}
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-1">
                      <IconBtn label="Move up" disabled={idx === 0} onClick={() => moveTemplateExercise(template.id, te.id, -1)}>
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </IconBtn>
                      <IconBtn
                        label="Move down"
                        disabled={idx === template.exercises.length - 1}
                        onClick={() => moveTemplateExercise(template.id, te.id, 1)}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </IconBtn>
                      <Link href={`/exercises/${te.exerciseId}`} className="ml-2 mr-auto text-sm font-medium text-accent">
                        Details
                      </Link>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                        onClick={() => setRemoving(te.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {template.exercises.length > 0 && (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border py-4 text-sm font-semibold text-accent hover:bg-accent/[0.05]"
          onClick={() => setPicking(true)}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add exercise
        </button>
      )}

      <div className="border-t border-border pt-6">
        <button
          type="button"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-danger hover:bg-danger/10"
          onClick={() => setDeleting(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Delete plan
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            addTemplateExercise(template.id, exerciseId);
            setPicking(false);
            const added = useStore.getState().templates.find((t) => t.id === template.id)?.exercises.at(-1);
            if (added) setOpenId(added.id);
          }}
        />
      )}

      <ConfirmDialog
        open={!!removingEx}
        title="Remove exercise?"
        body={`${exerciseById(removingEx?.exerciseId ?? "")?.name ?? "This exercise"} will be removed from the plan. Logged history is kept.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (removingEx) removeTemplateExercise(template.id, removingEx.id);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={deleting}
        title="Delete this plan?"
        body="Your past workouts stay in History. This can't be undone."
        confirmLabel="Delete plan"
        danger
        onConfirm={() => {
          deleteTemplate(template.id);
          router.push("/templates");
        }}
        onCancel={() => setDeleting(false)}
      />
    </main>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-control text-muted transition-colors hover:bg-surface2 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
