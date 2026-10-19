// Exercise Coach, deterministic core: everything the in-workout coach knows
// about one exercise in one workout, how today's sets are going, what the next
// set should be, and which library exercises could stand in. Pure — the
// server builds it from the synced document, the client from the store, and
// both get the same answer. The model only ever explains these results.

import type { CoachingProfile, EquipmentAccess } from "./coachingProfile";
import { exerciseTypeOf, usesReps, usesWeight } from "./exerciseType";
import { epley1rm, loadIncrement, roundToIncrement, suggestNextLoad, type LoadingKind } from "./progression";
import { muscleGroupOf, type Equipment, type ExerciseType } from "./taxonomy";
import { tipFor } from "./exerciseTips";
import type { AnalystFact } from "./analyst";
import type { Device, Exercise, Units, WorkoutSession, WorkoutSet, WorkoutTemplate } from "./types";

export const EXERCISE_COACH_SCHEMA = "exercise-coach/1";

const KG_PER_LB = 0.45359237;
const toUnits = (kg: number, units: Units) => (units === "kg" ? kg : kg / KG_PER_LB);
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Display precision: 0.5 kg / 1 lb. */
const shown = (kg: number, units: Units) => (units === "kg" ? Math.round(kg * 2) / 2 : Math.round(toUnits(kg, units)));

/** RPE at or above this: no reps left. Matches the progression engine. */
const NEAR_MAX_RPE = 9.5;
/** At or below this, the set was clearly easy. */
const EASY_RPE = 6.5;
const HISTORY_SESSIONS = 5;

export interface ExerciseCoachInput {
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  exercises: Exercise[];
  devices: Device[];
  templates: WorkoutTemplate[];
  units: Units;
  coaching: Partial<CoachingProfile> | null;
}

/** One of today's sets, weights in display units. */
export interface CoachSet {
  index: number;
  kind: "normal" | "warmup" | "drop" | "failure";
  completed: boolean;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  seconds: number | null;
}

export interface ExerciseContext {
  schemaVersion: typeof EXERCISE_COACH_SCHEMA;
  units: Units;
  exercise: {
    id: string;
    name: string;
    type: ExerciseType;
    equipment: Equipment | null;
    isCompound: boolean;
    primaryMuscle: string | null;
    secondaryMuscles: string[];
    level: string | null;
    steps: string[];
    tip: string;
  };
  device: {
    name: string;
    machineNumber: string | null;
    category: Device["category"];
    loading: Device["loading"] | null;
    guidance: string | null;
  } | null;
  /** The template's prescription, when this workout came from one. */
  plan: {
    sets: number;
    repMin: number;
    repMax: number;
    targetWeight: number | null;
    targetRpe: number | null;
    restSeconds: number | null;
    cue: string | null;
    substitution: string | null;
  } | null;
  today: CoachSet[];
  /** Earlier sessions of this exercise, newest first (working sets only). */
  history: { date: string; topWeight: number | null; topReps: number | null; e1rm: number | null }[];
  bestE1rm: number | null;
  limitations: string | null;
  equipmentAccess: EquipmentAccess | null;
}

/**
 * Builds the context for `exerciseId` within `sessionId`, or null when either
 * is unknown (e.g. the workout hasn't synced yet).
 */
export function buildExerciseContext(input: ExerciseCoachInput, sessionId: string, exerciseId: string): ExerciseContext | null {
  const session = input.sessions.find((s) => s.id === sessionId);
  const ex = input.exercises.find((e) => e.id === exerciseId);
  if (!session || !ex) return null;
  const units = input.units;

  const todaySets = input.sets
    .filter((s) => s.sessionId === sessionId && s.exerciseId === exerciseId)
    .sort((a, b) => a.setIndex - b.setIndex);
  const device =
    input.devices.find((d) => d.id === (todaySets[0]?.deviceId ?? ex.defaultDeviceId)) ?? null;
  const type = exerciseTypeOf(ex, device);
  const template = session.templateId ? input.templates.find((t) => t.id === session.templateId) : undefined;
  const te = template?.exercises.find((x) => x.exerciseId === exerciseId);

  const plan: ExerciseContext["plan"] = te
    ? (() => {
        const repMin = te.sets[0]?.targetReps ?? 8;
        const w = te.sets.find((s) => s.targetWeight != null)?.targetWeight ?? null;
        return {
          sets: te.sets.length,
          repMin,
          repMax: te.repMax && te.repMax > repMin ? te.repMax : repMin,
          targetWeight: w == null ? null : shown(w, units),
          targetRpe: te.targetRpe ?? null,
          restSeconds: te.restSeconds ?? null,
          cue: te.cue?.trim() || null,
          substitution: te.substitution?.trim() || null,
        };
      })()
    : null;

  const today: CoachSet[] = todaySets.map((s, i) => ({
    index: i + 1,
    kind: s.kind ?? "normal",
    completed: s.completed,
    weight: s.actualWeight != null ? shown(s.actualWeight, units) : null,
    reps: s.actualReps,
    rpe: s.rpe && s.rpe > 0 ? s.rpe : null,
    seconds: s.durationSec ?? null,
  }));

  const earlier = input.sessions
    .filter((s) => s.id !== sessionId && s.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const history: ExerciseContext["history"] = [];
  let best = 0;
  for (const s of earlier) {
    const working = input.sets.filter(
      (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed && x.kind !== "warmup",
    );
    if (working.length === 0) continue;
    let top: WorkoutSet | null = null;
    let e1 = 0;
    for (const x of working) {
      const w = x.actualWeight ?? 0;
      if (!top || w > (top.actualWeight ?? 0) || (w === (top.actualWeight ?? 0) && (x.actualReps ?? 0) > (top.actualReps ?? 0))) top = x;
      if (w > 0 && x.actualReps) e1 = Math.max(e1, epley1rm(w, x.actualReps));
    }
    best = Math.max(best, e1);
    if (history.length < HISTORY_SESSIONS) {
      history.push({
        date: s.date,
        topWeight: top?.actualWeight ? shown(top.actualWeight, units) : null,
        topReps: top?.actualReps ?? null,
        e1rm: e1 > 0 ? round1(toUnits(e1, units)) : null,
      });
    }
  }

  return {
    schemaVersion: EXERCISE_COACH_SCHEMA,
    units,
    exercise: {
      id: ex.id,
      name: ex.name,
      type,
      equipment: ex.equipment ?? null,
      isCompound: ex.isCompound,
      primaryMuscle: ex.primaryMuscle,
      secondaryMuscles: ex.secondaryMuscles ?? [],
      level: ex.level ?? null,
      steps: (ex.instructions ?? []).slice(0, 5),
      tip: tipFor(ex, plan?.cue),
    },
    device: device
      ? {
          name: device.name,
          machineNumber: device.machineNumber,
          category: device.category,
          loading: device.loading ?? null,
          guidance: device.guidance ?? null,
        }
      : null,
    plan,
    today,
    history,
    bestE1rm: best > 0 ? round1(toUnits(best, units)) : null,
    limitations: input.coaching?.limitations?.trim() || null,
    equipmentAccess: input.coaching?.equipment ?? null,
  };
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export type SetVerdict = "on_target" | "above_target" | "below_target" | "near_max";
export type CoachStatus = "not_started" | "on_track" | "ahead" | "struggling" | "done";
export type NextAction = "start" | "keep" | "increase" | "reduce" | "finish";

export interface NextSet {
  action: NextAction;
  /** Display units; null for exercises logged without load. */
  weight: number | null;
  reps: number | null;
  reason: string;
}

export interface SetAssessment {
  status: CoachStatus;
  repMin: number;
  repMax: number;
  sets: { index: number; verdict: SetVerdict }[];
  next: NextSet | null;
  /** Things worth saying that aren't about the numbers. */
  notes: string[];
}

function loadingOf(ctx: ExerciseContext): LoadingKind {
  if (ctx.device?.loading === "stack") return "stack";
  if (ctx.exercise.equipment === "dumbbell" || ctx.exercise.equipment === "kettlebell") return "dumbbell";
  return "plates";
}

/** Words in a limitation that point at this exercise's body region. */
const REGION_WORDS: Record<string, RegExp> = {
  chest: /\b(chest|pec|sternum|shoulder)/i,
  back: /\b(back|spine|lumbar|disc|shoulder)/i,
  shoulders: /\b(shoulder|rotator|neck)/i,
  arms: /\b(elbow|wrist|bicep|tricep|forearm|tendon)/i,
  core: /\b(back|spine|hernia|ab(s|dominal)?|core)\b/i,
  legs: /\b(knee|hip|ankle|hamstring|quad|groin|calf|achilles|back)/i,
};

/** True when the user's own limitation text mentions this exercise's region. */
export function limitationApplies(ctx: Pick<ExerciseContext, "limitations" | "exercise">): boolean {
  if (!ctx.limitations) return false;
  const groups = new Set([ctx.exercise.primaryMuscle, ...ctx.exercise.secondaryMuscles].map((m) => muscleGroupOf(m)));
  return [...groups].some((g) => REGION_WORDS[g]?.test(ctx.limitations!));
}

/**
 * How today's sets compare with the plan, and the next set. Rules:
 *  - Before the first working set: the progression engine's suggestion from
 *    history (or the plan's load).
 *  - RPE ≥ 9.5, or two or more reps short: reduce by one equipment step.
 *  - One rep short: keep the load and aim for the bottom of the range.
 *  - Two or more reps over the top with effort known to be easy (or RPE not
 *    logged): add the smallest step.
 *  - Otherwise keep the load.
 *  - All planned sets done: finish.
 */
export function assessSets(ctx: ExerciseContext): SetAssessment {
  const units = ctx.units;
  const type = ctx.exercise.type;
  const weighted = usesWeight(type) && type !== "assisted_bodyweight";
  const counted = usesReps(type);
  const repMin = ctx.plan?.repMin ?? ctx.history[0]?.topReps ?? (ctx.exercise.isCompound ? 8 : 12);
  const repMax = ctx.plan?.repMax ?? repMin;
  const smallest = loadIncrement(units, { loading: loadingOf(ctx), isCompound: false });
  const round = (w: number) => Math.max(0, roundToIncrement(w, units, Math.min(smallest, units === "kg" ? 2.5 : 5)));

  const working = ctx.today.filter((s) => s.kind !== "warmup");
  const done = working.filter((s) => s.completed);
  const sets = done.map((s) => ({ index: s.index, verdict: verdictOf(s, repMin, repMax) }));
  const notes: string[] = [];
  if (limitationApplies(ctx)) notes.push("You noted a limitation that may involve this movement — stop if it hurts and pick a substitute.");
  if (done.length > 0 && done.every((s) => s.rpe == null) && counted) {
    notes.push("Effort (RPE) isn't logged, so the next-set call is based on reps only.");
  }

  const planned = ctx.plan?.sets ?? null;
  const remaining = ctx.today.some((s) => !s.completed && s.kind !== "warmup");
  if (planned != null && done.length >= planned && !remaining) {
    return {
      status: "done",
      repMin,
      repMax,
      sets,
      next: { action: "finish", weight: null, reps: null, reason: `All ${planned} planned sets are done.` },
      notes,
    };
  }

  // Duration / cardio: report, don't prescribe.
  if (!counted) {
    return { status: done.length ? "on_track" : "not_started", repMin, repMax, sets, next: null, notes };
  }

  const last = done[done.length - 1];
  if (!last) {
    let weight: number | null = null;
    let reason = ctx.plan ? `Plan: ${repMin === repMax ? repMin : `${repMin}–${repMax}`} reps.` : `Aim for ${repMin} reps.`;
    if (weighted) {
      const h = ctx.history[0];
      if (h?.topWeight != null && h.topReps != null) {
        const s = suggestNextLoad(
          { targetReps: repMin, sets: [{ actualWeight: h.topWeight, actualReps: h.topReps, rpe: null, completed: true }] },
          units,
          { isCompound: ctx.exercise.isCompound, repRange: repMax > repMin ? { min: repMin, max: repMax } : null, loading: loadingOf(ctx) },
        );
        weight = s.weight;
        reason = `Last time your top set was ${h.topWeight} ${units} × ${h.topReps}. ${s.reason}`;
        return { status: "not_started", repMin, repMax, sets, next: { action: "start", weight, reps: s.reps, reason }, notes };
      }
      weight = ctx.plan?.targetWeight ?? null;
    }
    return { status: "not_started", repMin, repMax, sets, next: { action: "start", weight, reps: repMin, reason }, notes };
  }

  const reps = last.reps ?? 0;
  const w = weighted ? last.weight : null;
  const verdict = verdictOf(last, repMin, repMax);
  let next: NextSet;
  if (verdict === "near_max" || reps <= repMin - 2) {
    const lower = w != null && w > 0 ? round(w - smallest) : w;
    next = {
      action: weighted && lower !== w ? "reduce" : "keep",
      weight: lower,
      reps: repMin,
      reason:
        verdict === "near_max"
          ? `Set ${last.index} was near your limit (RPE ${last.rpe}). Drop one step so the next set stays clean.`
          : `Set ${last.index} was ${repMin - reps} reps short of ${repMin}. Drop one step and aim for ${repMin}.`,
    };
  } else if (reps < repMin) {
    next = { action: "keep", weight: w, reps: repMin, reason: `Set ${last.index} was 1 rep short. Same load, aim for ${repMin}.` };
  } else if (weighted && reps >= repMax + 2 && (last.rpe == null || last.rpe <= EASY_RPE)) {
    next = {
      action: "increase",
      weight: w != null ? round(w + smallest) : w,
      reps: repMin,
      reason: `Set ${last.index} went ${reps - repMax} reps past ${repMax}${last.rpe != null ? ` at RPE ${last.rpe}` : ""}. Add ${smallest} ${units}.`,
    };
  } else {
    next = { action: "keep", weight: w, reps: Math.min(repMax, Math.max(repMin, reps)), reason: `Set ${last.index} was in range. Keep the load.` };
  }

  const status: CoachStatus =
    verdict === "near_max" || verdict === "below_target" ? "struggling" : verdict === "above_target" ? "ahead" : "on_track";
  return { status, repMin, repMax, sets, next, notes };
}

function verdictOf(s: CoachSet, repMin: number, repMax: number): SetVerdict {
  if (s.rpe != null && s.rpe >= NEAR_MAX_RPE) return "near_max";
  const r = s.reps ?? 0;
  if (r < repMin) return "below_target";
  if (r > repMax) return "above_target";
  return "on_target";
}

// ---------------------------------------------------------------------------
// Substitutions
// ---------------------------------------------------------------------------

export interface Substitution {
  exerciseId: string;
  name: string;
  equipment: Equipment | null;
  reason: string;
  /** The template named this one as the alternative. */
  fromPlan: boolean;
}

/** Equipment each access level can reach; null/"gym" = everything. */
const ACCESS: Record<Exclude<EquipmentAccess, "gym">, Equipment[]> = {
  machines: ["machine", "plate_loaded", "cable", "smith", "bodyweight", "band"],
  dumbbells: ["dumbbell", "kettlebell", "bodyweight", "band"],
  bodyweight: ["bodyweight", "band"],
};

const EQUIPMENT_LABEL: Partial<Record<Equipment, string>> = {
  plate_loaded: "plate-loaded machine",
  smith: "Smith machine",
  ez_bar: "EZ bar",
  trap_bar: "trap bar",
  cardio_machine: "cardio machine",
};
const eqLabel = (e: Equipment | null | undefined) => (e ? (EQUIPMENT_LABEL[e] ?? e) : "other equipment");

/**
 * Library exercises that train the same thing, best first: the plan's named
 * alternative, then same primary muscle, compound-ness and helper muscles;
 * different equipment ranks higher (the usual reason to swap is a busy or
 * missing machine). Filtered to the user's equipment access.
 */
export function substitutionsFor(
  ctx: Pick<ExerciseContext, "exercise" | "plan" | "equipmentAccess">,
  library: Exercise[],
  opts: { exclude?: string[]; limit?: number; planMatch?: Exercise | null } = {},
): Substitution[] {
  const me = ctx.exercise;
  const exclude = new Set([me.id, ...(opts.exclude ?? [])]);
  const group = muscleGroupOf(me.primaryMuscle);
  const allowed = ctx.equipmentAccess && ctx.equipmentAccess !== "gym" ? new Set(ACCESS[ctx.equipmentAccess]) : null;
  const myType = me.type;
  const secondary = new Set(me.secondaryMuscles);

  const scored: { ex: Exercise; score: number; reason: string; fromPlan: boolean }[] = [];
  for (const ex of library) {
    if (exclude.has(ex.id)) continue;
    const t = exerciseTypeOf(ex);
    if ((t === "cardio") !== (myType === "cardio") || (t === "duration") !== (myType === "duration")) continue;
    if (allowed && ex.equipment && !allowed.has(ex.equipment)) continue;
    const fromPlan = opts.planMatch?.id === ex.id;
    const samePrimary = !!me.primaryMuscle && ex.primaryMuscle?.toLowerCase() === me.primaryMuscle.toLowerCase();
    if (!fromPlan && !samePrimary && muscleGroupOf(ex.primaryMuscle) !== group) continue;
    let score = fromPlan ? 100 : 0;
    score += samePrimary ? 3 : 1;
    if (ex.isCompound === me.isCompound) score += 1;
    score += Math.min(1, (ex.secondaryMuscles ?? []).filter((m) => secondary.has(m)).length * 0.5);
    const otherKit = (ex.equipment ?? null) !== (me.equipment ?? null);
    if (otherKit) score += 0.5;
    const parts = [
      fromPlan ? "Your plan's alternative" : samePrimary ? `Same main muscle (${ex.primaryMuscle})` : `Same area (${group})`,
      otherKit && ex.equipment ? `uses a ${eqLabel(ex.equipment)}` : null,
    ].filter(Boolean);
    scored.push({ ex, score, reason: parts.join(", "), fromPlan });
  }
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  return scored.slice(0, opts.limit ?? 4).map(({ ex, reason, fromPlan }) => ({
    exerciseId: ex.id,
    name: ex.name,
    equipment: ex.equipment ?? null,
    reason,
    fromPlan,
  }));
}

// ---------------------------------------------------------------------------
// Facts for the model (the only numbers it may use)
// ---------------------------------------------------------------------------

export interface ExerciseCoachEvidence {
  context: ExerciseContext;
  assessment: SetAssessment;
  substitutions: Substitution[];
  facts: AnalystFact[];
}

export function coachFacts(ctx: ExerciseContext, a: SetAssessment, subs: Substitution[]): AnalystFact[] {
  const u = ctx.units;
  const facts: AnalystFact[] = [];
  const add = (id: string, label: string, value: number | null | undefined, unit: string) => {
    if (value != null && Number.isFinite(value)) facts.push({ id, label, value, unit });
  };
  // Names may contain digits ("45 Degree Press", "Machine 22"); labels make them citable.
  add("exercise.name", `exercise: ${ctx.exercise.name}`, 0, "");
  if (ctx.device) add("device.name", `device: ${ctx.device.name}${ctx.device.machineNumber ? ` No. ${ctx.device.machineNumber}` : ""}`, 0, "");
  add("range.min", "bottom of the rep range", a.repMin, "reps");
  add("range.max", "top of the rep range", a.repMax, "reps");
  if (ctx.plan) {
    add("plan.sets", "planned working sets", ctx.plan.sets, "sets");
    add("plan.weight", "planned load", ctx.plan.targetWeight, u);
    add("plan.rpe", "target effort (RPE)", ctx.plan.targetRpe, "RPE");
    add("plan.rest", "planned rest", ctx.plan.restSeconds, "s");
  }
  for (const s of ctx.today.filter((x) => x.completed)) {
    add(`today.${s.index}.weight`, `today set ${s.index} load`, s.weight, u);
    add(`today.${s.index}.reps`, `today set ${s.index} reps`, s.reps, "reps");
    add(`today.${s.index}.rpe`, `today set ${s.index} effort (RPE)`, s.rpe, "RPE");
    add(`today.${s.index}.seconds`, `today set ${s.index} time`, s.seconds, "s");
    add(`today.${s.index}.n`, `set number`, s.index, "");
  }
  add("today.done", "working sets done today", a.sets.length, "sets");
  if (a.next) {
    add("next.weight", "suggested next-set load", a.next.weight, u);
    add("next.reps", "suggested next-set reps", a.next.reps, "reps");
  }
  const h = ctx.history[0];
  if (h) {
    add("last.weight", `last session (${h.date}) top load`, h.topWeight, u);
    add("last.reps", "last session top-set reps", h.topReps, "reps");
  }
  add("best.e1rm", "best estimated 1RM", ctx.bestE1rm, u);
  subs.forEach((s, i) => add(`sub.${i}`, `substitute: ${s.name}`, 0, ""));
  return facts;
}

/** Context + assessment + substitutions + facts in one call. */
export function buildCoachEvidence(
  input: ExerciseCoachInput,
  sessionId: string,
  exerciseId: string,
  opts: { planMatch?: (name: string) => Exercise | null } = {},
): ExerciseCoachEvidence | null {
  const context = buildExerciseContext(input, sessionId, exerciseId);
  if (!context) return null;
  const assessment = assessSets(context);
  const inWorkout = [...new Set(input.sets.filter((s) => s.sessionId === sessionId).map((s) => s.exerciseId))];
  const substitutions = substitutionsFor(context, input.exercises, {
    exclude: inWorkout,
    planMatch: context.plan?.substitution && opts.planMatch ? opts.planMatch(context.plan.substitution) : null,
  });
  return { context, assessment, substitutions, facts: coachFacts(context, assessment, substitutions) };
}

// ---------------------------------------------------------------------------
// Readings: the rule-based one, and validation of the model's
// ---------------------------------------------------------------------------

export interface CoachReading {
  answer: string;
  cues: string[];
  source: "ai" | "rules";
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** Machine settings the app doesn't know: seat/pin/lever positions, notches, holes. */
const SETTING_RE = /\b(seat|pin|pad|lever|back ?rest|foot ?plate|handle|carriage|setting|notch|hole|position)\s*(?:height|position|setting|level)?\s*(?:to|at|on|=|#|no\.?)?\s*\d/i;

/** The numbers-only-from-facts check, plus no invented machine settings. */
export function validateCoachReading(raw: unknown, evidence: Pick<ExerciseCoachEvidence, "facts">, unsupported: (text: string) => number[]): CoachReading | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const answer = clip(r.answer, 600);
  if (!answer) return null;
  const cues = Array.isArray(r.cues) ? r.cues.map((c) => clip(c, 140)).filter(Boolean).slice(0, 3) : [];
  const text = [answer, ...cues].join("\n");
  if (SETTING_RE.test(text)) return null;
  if (unsupported(text).length > 0) return null;
  void evidence;
  return { answer, cues, source: "ai" };
}

/** What the coach says without a model: the assessment in plain words. */
export function ruleReading(e: Pick<ExerciseCoachEvidence, "context" | "assessment" | "substitutions">): CoachReading {
  const { context: c, assessment: a } = e;
  const lines: string[] = [];
  if (a.next) {
    const load = a.next.weight != null && a.next.weight > 0 ? `${a.next.weight} ${c.units}` : null;
    const target = a.next.reps != null ? `${a.next.reps} reps` : null;
    const what = [load, target].filter(Boolean).join(" × ");
    lines.push(a.next.action === "finish" ? a.next.reason : `${a.next.reason}${what ? ` Next: ${what}.` : ""}`);
  } else if (a.status === "not_started") {
    lines.push("Log your first set and the coach will check it against the plan.");
  } else {
    lines.push("Sets logged. Keep the pace steady and stop if anything hurts.");
  }
  lines.push(...a.notes);
  const cues = [c.exercise.tip, c.device?.guidance ?? null].filter((x): x is string => !!x).slice(0, 2);
  return { answer: lines.join(" "), cues, source: "rules" };
}
