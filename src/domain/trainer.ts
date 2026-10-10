import type {
  Exercise,
  PersonalRecord,
  Program,
  SessionFeedback,
  Units,
  UserProfile,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from "./types";
import type { ExerciseType } from "./taxonomy";
import { exerciseTypeOf } from "./exerciseType";
import { matchExercise } from "./exerciseMatch";
import { localDayKey, startOfWeek, weekDays, weekStreak } from "./streak";

// The AI trainer sees a compact snapshot of the user's plans and recent
// training (built on the client from the local store) and may answer with a
// few structured actions. Everything here is pure so the client, the API
// route and tests share one definition of what a valid action is.

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface CatalogueEntry {
  id: string;
  name: string;
  muscle: string | null;
  equipment: string | null;
  type: ExerciseType;
}

export interface TrainerSlot {
  slot: number; // 1-based, as shown to the model
  teId: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number; // first set's target (seconds for duration, minutes for cardio)
  weightKg: number | null;
  restSeconds: number;
}

export interface TrainerWorkout {
  ref: string; // "W1"
  templateId: string;
  name: string;
  program: string | null;
  slots: TrainerSlot[];
}

export interface TrainerSession {
  date: string;
  title: string;
  minutes: number | null;
  difficulty: SessionFeedback["difficulty"] | null;
  pain: string | null;
  exercises: { name: string; sets: number; best: string }[];
}

/** How regularly they train against their active plan. */
export interface TrainerConsistency {
  program: string | null; // active program
  programDays: number | null; // workouts in its rotation
  sessionsThisWeek: number;
  sessionsLast28: number;
  weeksTrainedLast4: number; // of the last 4 calendar weeks, incl. this one
  daysSinceLast: number | null;
  weekStreak: number;
}

export interface TrainerContext {
  today: string;
  /** What the client has open in the app ("this workout" refers to it). */
  viewing: string | null;
  units: Units;
  profile: Pick<UserProfile, "goal" | "experience" | "sex" | "ageYears" | "weightKg">;
  nextWorkout: string | null; // workout ref
  consistency: TrainerConsistency;
  workouts: TrainerWorkout[];
  recent: TrainerSession[];
  records: { name: string; kind: PersonalRecord["kind"]; value: number; date: string }[];
  catalogue: CatalogueEntry[];
}

export const LIMITS = {
  workouts: 12,
  slotsPerWorkout: 15,
  recentSessions: 6,
  recentDays: 28,
  records: 8,
  catalogue: 400,
  actions: 3,
  planExercises: 12,
  programDays: 7,
} as const;

export function kgToUnits(kg: number, units: Units): number {
  return units === "lb" ? Math.round(kg * 2.20462) : Math.round(kg * 10) / 10;
}

function bestSet(sets: WorkoutSet[], units: Units): string {
  let top: WorkoutSet | null = null;
  for (const s of sets) {
    if (!top) top = s;
    else if ((s.actualWeight ?? 0) > (top.actualWeight ?? 0)) top = s;
    else if ((s.actualWeight ?? 0) === (top.actualWeight ?? 0) && (s.actualReps ?? 0) > (top.actualReps ?? 0)) top = s;
  }
  if (!top) return "";
  if (top.actualWeight != null && top.actualReps != null) return `${kgToUnits(top.actualWeight, units)}${units}×${top.actualReps}`;
  if (top.actualReps != null) return `${top.actualReps} reps`;
  if (top.durationSec != null) return `${top.durationSec}s`;
  if (top.durationMin != null) return `${top.durationMin} min`;
  return "";
}

export function buildTrainerContext(input: {
  now: Date;
  units: Units;
  profile: UserProfile;
  programs: Program[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  prs: PersonalRecord[];
  feedback: SessionFeedback[];
  exercises: Exercise[];
  nextTemplateId: string | null;
  viewing?: string | null;
}): TrainerContext {
  const { units, exercises } = input;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "Exercise";

  // Program days first (in program order), then standalone workouts.
  const programOf = new Map<string, string>();
  const ordered: WorkoutTemplate[] = [];
  const tplById = new Map(input.templates.map((t) => [t.id, t]));
  for (const p of input.programs) {
    for (const id of p.dayTemplateIds) {
      const t = tplById.get(id);
      if (t && !programOf.has(id)) {
        programOf.set(id, p.name);
        ordered.push(t);
      }
    }
  }
  for (const t of input.templates) if (!programOf.has(t.id)) ordered.push(t);

  const workouts: TrainerWorkout[] = ordered.slice(0, LIMITS.workouts).map((t, i) => ({
    ref: `W${i + 1}`,
    templateId: t.id,
    name: t.name,
    program: programOf.get(t.id) ?? null,
    slots: [...t.exercises]
      .sort((a, b) => a.position - b.position)
      .slice(0, LIMITS.slotsPerWorkout)
      .map((te, j) => ({
        slot: j + 1,
        teId: te.id,
        exerciseId: te.exerciseId,
        name: nameOf(te.exerciseId),
        sets: te.sets.length,
        reps: te.sets[0]?.targetReps ?? 0,
        weightKg: te.sets[0]?.targetWeight ?? null,
        restSeconds: te.restSeconds,
      })),
  }));

  const cutoff = new Date(input.now.getTime() - LIMITS.recentDays * 86_400_000).toISOString().slice(0, 10);
  const fbBySession = new Map(input.feedback.map((f) => [f.sessionId, f]));
  const recent: TrainerSession[] = input.sessions
    .filter((s) => s.status === "completed" && s.date >= cutoff)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, LIMITS.recentSessions)
    .map((s) => {
      const done = input.sets.filter((x) => x.sessionId === s.id && x.completed && x.kind !== "warmup");
      const groups = new Map<string, WorkoutSet[]>();
      for (const x of done) groups.set(x.exerciseId, [...(groups.get(x.exerciseId) ?? []), x]);
      const fb = fbBySession.get(s.id);
      return {
        date: s.date,
        title: s.title,
        minutes: s.completedAt
          ? Math.max(1, Math.round((+new Date(s.completedAt) - +new Date(s.startedAt)) / 60_000))
          : null,
        difficulty: fb?.difficulty ?? null,
        pain: fb?.pain ?? null,
        exercises: [...groups].map(([id, xs]) => ({ name: nameOf(id), sets: xs.length, best: bestSet(xs, units) })),
      };
    });

  const records = [...input.prs]
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, LIMITS.records)
    .map((p) => ({ name: nameOf(p.exerciseId), kind: p.kind, value: p.value, date: p.achievedAt.slice(0, 10) }));

  const nextRef = workouts.find((w) => w.templateId === input.nextTemplateId)?.ref ?? null;
  const consistency = buildConsistency(input);

  return {
    today: input.now.toISOString().slice(0, 10),
    viewing: input.viewing?.slice(0, 600) ?? null,
    units,
    profile: {
      goal: input.profile.goal,
      experience: input.profile.experience,
      sex: input.profile.sex ?? null,
      ageYears: input.profile.ageYears ?? null,
      weightKg: input.profile.weightKg ?? null,
    },
    nextWorkout: nextRef,
    consistency,
    workouts,
    recent,
    records,
    catalogue: exercises.slice(0, LIMITS.catalogue).map((e) => ({
      id: e.id,
      name: e.name,
      muscle: e.primaryMuscle,
      equipment: e.equipment ?? null,
      type: exerciseTypeOf(e),
    })),
  };
}

const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

function buildConsistency(input: {
  now: Date;
  programs: Program[];
  sessions: WorkoutSession[];
  nextTemplateId: string | null;
}): TrainerConsistency {
  const done = input.sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lastTemplate = done[0]?.templateId ?? null;
  const program =
    input.programs.find((p) => input.nextTemplateId && p.dayTemplateIds.includes(input.nextTemplateId)) ??
    input.programs.find((p) => lastTemplate && p.dayTemplateIds.includes(lastTemplate)) ??
    input.programs[0] ??
    null;

  const today = localDayKey(input.now);
  const dates = new Set(done.map((s) => s.date));
  const thisWeek = new Set(weekDays(input.now));
  let weeksTrained = 0;
  for (let k = 0; k < 4; k++) {
    const start = startOfWeek(input.now);
    start.setDate(start.getDate() - 7 * k);
    if (weekDays(start).some((d) => dates.has(d))) weeksTrained++;
  }
  const latest = done.reduce<string | null>((m, s) => (m === null || s.date > m ? s.date : m), null);
  return {
    program: program?.name ?? null,
    programDays: program ? program.dayTemplateIds.length : null,
    sessionsThisWeek: done.filter((s) => thisWeek.has(s.date)).length,
    sessionsLast28: done.filter((s) => dayNumber(today) - dayNumber(s.date) < 28).length,
    weeksTrainedLast4: weeksTrained,
    daysSinceLast: latest ? Math.max(0, dayNumber(today) - dayNumber(latest)) : null,
    weekStreak: weekStreak(dates, input.now),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface PlanItem {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
}

export type TrainerAction =
  | { type: "swap_exercise"; templateId: string; workout: string; teId: string; from: string; exerciseId: string; name: string }
  | { type: "set_volume"; templateId: string; workout: string; teId: string; name: string; sets: number; reps: number }
  | { type: "add_exercise"; templateId: string; workout: string; exerciseId: string; name: string; sets: number; reps: number }
  | { type: "remove_exercise"; templateId: string; workout: string; teId: string; name: string }
  | { type: "create_workout"; name: string; exercises: PlanItem[] }
  | { type: "create_program"; name: string; days: { name: string; exercises: PlanItem[] }[] };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function str(v: unknown, max = 60): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/** Rep target bounds by how the exercise is logged (seconds / minutes / reps). */
function clampReps(reps: number, type: ExerciseType): number {
  if (type === "duration") return clamp(reps, 5, 600);
  if (type === "cardio") return clamp(reps, 1, 120);
  return clamp(reps, 1, 50);
}

/**
 * Turns the model's raw `actions` into safe, concrete store operations.
 * Anything referring to an unknown workout, slot or exercise is dropped —
 * the reply still reaches the user, just without a broken button.
 */
export function validateTrainerActions(raw: unknown, ctx: TrainerContext): TrainerAction[] {
  if (!Array.isArray(raw)) return [];
  const byRef = new Map(ctx.workouts.map((w) => [w.ref.toUpperCase(), w]));
  const catById = new Map(ctx.catalogue.map((c) => [c.id, c]));

  const resolveExercise = (r: Record<string, unknown>): CatalogueEntry | null => {
    const id = str(r.exerciseId, 80) ?? str(r.exercise, 80);
    if (id && catById.has(id)) return catById.get(id)!;
    const name = str(r.name, 80) ?? id;
    return name ? matchExercise(name, ctx.catalogue) : null;
  };
  const workoutOf = (r: Record<string, unknown>) => byRef.get(String(r.workout ?? "").toUpperCase()) ?? null;
  const slotOf = (w: TrainerWorkout, r: Record<string, unknown>) => {
    const n = num(r.slot);
    return n == null ? null : (w.slots.find((s) => s.slot === n) ?? null);
  };
  const planItems = (list: unknown): PlanItem[] => {
    if (!Array.isArray(list)) return [];
    const items: PlanItem[] = [];
    for (const it of list.slice(0, LIMITS.planExercises)) {
      if (!it || typeof it !== "object") continue;
      const r = it as Record<string, unknown>;
      const ex = resolveExercise(r);
      if (!ex) continue;
      items.push({
        exerciseId: ex.id,
        name: ex.name,
        sets: clamp(num(r.sets) ?? 3, 1, 10),
        reps: clampReps(num(r.reps) ?? 10, ex.type),
        restSeconds: clamp(num(r.rest) ?? num(r.restSeconds) ?? 90, 15, 600),
      });
    }
    return items;
  };

  const out: TrainerAction[] = [];
  for (const item of raw) {
    if (out.length >= LIMITS.actions) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    switch (r.type) {
      case "swap_exercise": {
        const w = workoutOf(r);
        const slot = w && slotOf(w, r);
        const ex = resolveExercise(r);
        if (!w || !slot || !ex || ex.id === slot.exerciseId) break;
        out.push({ type: "swap_exercise", templateId: w.templateId, workout: w.name, teId: slot.teId, from: slot.name, exerciseId: ex.id, name: ex.name });
        break;
      }
      case "set_volume": {
        const w = workoutOf(r);
        const slot = w && slotOf(w, r);
        if (!w || !slot) break;
        const type = catById.get(slot.exerciseId)?.type ?? "weight_reps";
        const sets = clamp(num(r.sets) ?? slot.sets, 1, 10);
        const reps = clampReps(num(r.reps) ?? slot.reps, type);
        if (sets === slot.sets && reps === slot.reps) break;
        out.push({ type: "set_volume", templateId: w.templateId, workout: w.name, teId: slot.teId, name: slot.name, sets, reps });
        break;
      }
      case "add_exercise": {
        const w = workoutOf(r);
        const ex = resolveExercise(r);
        if (!w || !ex) break;
        out.push({
          type: "add_exercise",
          templateId: w.templateId,
          workout: w.name,
          exerciseId: ex.id,
          name: ex.name,
          sets: clamp(num(r.sets) ?? 3, 1, 10),
          reps: clampReps(num(r.reps) ?? 10, ex.type),
        });
        break;
      }
      case "remove_exercise": {
        const w = workoutOf(r);
        const slot = w && slotOf(w, r);
        if (!w || !slot) break;
        out.push({ type: "remove_exercise", templateId: w.templateId, workout: w.name, teId: slot.teId, name: slot.name });
        break;
      }
      case "create_workout": {
        const exercises = planItems(r.exercises);
        if (exercises.length === 0) break;
        out.push({ type: "create_workout", name: str(r.name) ?? "Coach workout", exercises });
        break;
      }
      case "create_program": {
        const days = Array.isArray(r.days)
          ? r.days.slice(0, LIMITS.programDays).flatMap((d, i) => {
              if (!d || typeof d !== "object") return [];
              const dr = d as Record<string, unknown>;
              const exercises = planItems(dr.exercises);
              return exercises.length ? [{ name: str(dr.name) ?? `Day ${i + 1}`, exercises }] : [];
            })
          : [];
        if (days.length === 0) break;
        out.push({ type: "create_program", name: str(r.name) ?? "Coach program", days });
        break;
      }
    }
  }
  return out;
}

/** One-line, user-facing description of an action. */
export function describeAction(a: TrainerAction): { title: string; detail: string } {
  switch (a.type) {
    case "swap_exercise":
      return { title: `Swap ${a.from} → ${a.name}`, detail: a.workout };
    case "set_volume":
      return { title: `${a.name}: ${a.sets} × ${a.reps}`, detail: a.workout };
    case "add_exercise":
      return { title: `Add ${a.name} (${a.sets} × ${a.reps})`, detail: a.workout };
    case "remove_exercise":
      return { title: `Remove ${a.name}`, detail: a.workout };
    case "create_workout":
      return { title: `New workout: ${a.name}`, detail: a.exercises.map((e) => e.name).join(", ") };
    case "create_program":
      return {
        title: `New program: ${a.name}`,
        detail: `${a.days.length} days · ${a.days.map((d) => d.name).join(", ")}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Status review
// ---------------------------------------------------------------------------

export type ReviewStatus = "on_track" | "needs_attention" | "getting_started";

export interface TrainerReview {
  status: ReviewStatus;
  headline: string;
  summary: string;
  wins: string[];
  focus: string[];
  nextSession: { workout: string | null; name: string | null; hints: string[] } | null;
  actions: TrainerAction[];
}

const REVIEW_STATUSES: readonly ReviewStatus[] = ["on_track", "needs_attention", "getting_started"];

function textList(v: unknown, keep: (s: string) => boolean): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => str(x, 200))
    .filter((x): x is string => !!x && keep(x))
    .slice(0, 3);
}

/**
 * Validates the model's review: known status, bounded text, next-session ref
 * resolved against the client's plans, actions validated like chat actions.
 * `keep` filters out unsafe sentences (the safety check lives server-side).
 */
export function parseTrainerReview(
  raw: Record<string, unknown>,
  ctx: TrainerContext,
  keep: (s: string) => boolean = () => true,
): TrainerReview | null {
  const headline = str(raw.headline, 120);
  const summary = str(raw.summary, 600);
  if (!headline || !summary || !keep(headline) || !keep(summary)) return null;
  const status = REVIEW_STATUSES.find((s) => s === raw.status) ?? (ctx.recent.length ? "on_track" : "getting_started");

  let nextSession: TrainerReview["nextSession"] = null;
  const ns = raw.nextSession && typeof raw.nextSession === "object" ? (raw.nextSession as Record<string, unknown>) : null;
  if (ns) {
    const ref = str(ns.workout, 6)?.toUpperCase() ?? null;
    const w = ref ? ctx.workouts.find((x) => x.ref === ref) : undefined;
    const hints = textList(ns.hints, keep);
    if (hints.length) nextSession = { workout: w?.ref ?? null, name: w?.name ?? null, hints };
  }

  return {
    status,
    headline,
    summary,
    wins: textList(raw.wins, keep),
    focus: textList(raw.focus, keep),
    nextSession,
    actions: validateTrainerActions(raw.actions, ctx),
  };
}
