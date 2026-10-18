// Training Analyst: the deterministic half. Every number the analyst shows —
// or lets the AI talk about — is computed here from the logged data, packaged
// as a versioned evidence object with a flat list of citable facts. The AI only
// interprets this package; `validateAnalystText` rejects any number it writes
// that isn't one of these facts.
//
// Pure: no I/O, no clock (the caller passes `today`). Runs on the client for
// the on-screen numbers and on the server over the synced document for AI calls.

import type { Device, Exercise, Units, WorkoutSession, WorkoutSet } from "./types";
import { epley1rm } from "./progression";
import { exerciseTypeOf, usesReps, usesWeight } from "./exerciseType";
import { muscleGroupOf, type MuscleGroup } from "./taxonomy";
import { normalizeCoaching, showsRpe, type CoachingProfile } from "./coachingProfile";

export const ANALYST_SCHEMA = "analyst-evidence/1";
export const ANALYST_PERIODS = [4, 8, 12] as const;
export type AnalystPeriod = (typeof ANALYST_PERIODS)[number];

/** Change over the period (%) that counts as moving rather than flat. */
const IMPROVING_PCT = 2;
const DECLINING_PCT = -3;
/** Sessions of a lift inside the period needed to call a trend. */
const MIN_TREND_SESSIONS = 3;
const MAX_LIFTS = 8;

export type LiftStatus = "improving" | "stalled" | "declining" | "insufficient";
export type Confidence = "low" | "medium" | "high";

export interface AnalystFact {
  id: string;
  label: string;
  value: number;
  unit: string;
}

export interface LiftTrend {
  exerciseId: string;
  name: string;
  sessions: number;
  /** Best estimated 1RM per session, oldest first, display units. */
  series: { date: string; value: number }[];
  startE1rm: number | null;
  endE1rm: number | null;
  changePct: number | null;
  status: LiftStatus;
}

export interface MuscleVolume {
  group: MuscleGroup;
  hardSets: number;
  perWeek: number;
  previousHardSets: number;
  changePct: number | null;
}

export interface AnalystEvidence {
  schemaVersion: typeof ANALYST_SCHEMA;
  period: { weeks: number; from: string; to: string };
  units: Units;
  consistency: {
    sessions: number;
    perWeek: number;
    targetPerWeek: number | null;
    adherencePct: number | null;
    previousSessions: number;
    longestGapDays: number | null;
    daysSinceLast: number | null;
  };
  muscleGroups: MuscleVolume[];
  lifts: LiftTrend[];
  dataQuality: {
    workingSets: number;
    rpeLoggedPct: number | null;
    liftsWithTooFewSessions: number;
    notes: string[];
  };
  confidence: Confidence;
  facts: AnalystFact[];
}

export interface AnalystInput {
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  exercises: Exercise[];
  devices: Device[];
  units: Units;
  coaching?: CoachingProfile | null;
}

const DAY_MS = 86_400_000;
const dayNum = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
const keyOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

function toUnits(kg: number, units: Units): number {
  return units === "kg" ? Math.round(kg * 2) / 2 : Math.round(kg / 0.45359237);
}

/** Least-squares change over the series as % of the fitted start (robust to one odd session). */
function fittedChangePct(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  const slope = den ? num / den : 0;
  const start = my - slope * mx;
  return start > 0 ? round1(((slope * (n - 1)) / start) * 100) : null;
}

function liftStatus(sessions: number, change: number | null): LiftStatus {
  if (sessions < MIN_TREND_SESSIONS || change === null) return "insufficient";
  if (change >= IMPROVING_PCT) return "improving";
  if (change <= DECLINING_PCT) return "declining";
  return "stalled";
}

/**
 * The evidence package for the `weeks` ending on `today` (YYYY-MM-DD, the
 * user's local day). The previous period of the same length is used for
 * comparisons.
 */
export function buildAnalystEvidence(input: AnalystInput, weeks: number, today: string): AnalystEvidence {
  const end = dayNum(today);
  const start = end - weeks * 7 + 1;
  const prevStart = start - weeks * 7;
  const coaching = normalizeCoaching(input.coaching);
  const units = input.units === "lb" ? "lb" : "kg";

  const done = input.sessions.filter((s) => s.status === "completed" && /^\d{4}-\d{2}-\d{2}$/.test(s.date));
  const dateOf = new Map(done.map((s) => [s.id, dayNum(s.date)]));
  const inPeriod = done.filter((s) => dateOf.get(s.id)! >= start && dateOf.get(s.id)! <= end);
  const inPrev = done.filter((s) => dateOf.get(s.id)! >= prevStart && dateOf.get(s.id)! < start);

  // Consistency.
  const days = [...new Set(inPeriod.map((s) => dateOf.get(s.id)!))].sort((a, b) => a - b);
  let longestGap: number | null = null;
  for (let i = 1; i < days.length; i++) longestGap = Math.max(longestGap ?? 0, days[i] - days[i - 1]);
  const lastEver = Math.max(-Infinity, ...done.map((s) => dateOf.get(s.id)!).filter((d) => d <= end));
  const perWeek = round1(inPeriod.length / weeks);
  const target = coaching.daysPerWeek;

  // Working sets with their exercise metadata.
  const exById = new Map(input.exercises.map((e) => [e.id, e]));
  const devById = new Map(input.devices.map((d) => [d.id, d]));
  const working = input.sets.filter((x) => x.completed && x.kind !== "warmup" && dateOf.has(x.sessionId));
  const typeOf = (x: WorkoutSet) => {
    const ex = exById.get(x.exerciseId);
    return exerciseTypeOf(ex, devById.get(x.deviceId ?? "") ?? devById.get(ex?.defaultDeviceId ?? "") ?? null);
  };
  const isHard = (x: WorkoutSet) => {
    const t = typeOf(x);
    if (t === "cardio") return false;
    return usesReps(t) ? (x.actualReps ?? 0) > 0 : (x.durationSec ?? 0) > 0;
  };
  const between = (x: WorkoutSet, a: number, b: number) => {
    const d = dateOf.get(x.sessionId)!;
    return d >= a && d <= b;
  };
  const periodSets = working.filter((x) => between(x, start, end));
  const prevSets = working.filter((x) => between(x, prevStart, start - 1));

  // Hard sets per muscle group.
  const groupCount = (list: WorkoutSet[]) => {
    const m = new Map<MuscleGroup, number>();
    for (const x of list) {
      if (!isHard(x)) continue;
      const g = muscleGroupOf(exById.get(x.exerciseId)?.primaryMuscle);
      if (g === "cardio" || g === "other") continue;
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const now = groupCount(periodSets);
  const before = groupCount(prevSets);
  const muscleGroups: MuscleVolume[] = [...new Set([...now.keys(), ...before.keys()])]
    .map((group) => {
      const hardSets = now.get(group) ?? 0;
      const previousHardSets = before.get(group) ?? 0;
      return { group, hardSets, perWeek: round1(hardSets / weeks), previousHardSets, changePct: pct(hardSets, previousHardSets) };
    })
    .sort((a, b) => b.hardSets - a.hardSets || a.group.localeCompare(b.group));

  // e1RM trend per weighted lift.
  const perLift = new Map<string, Map<string, number>>(); // exerciseId → session date → best e1RM (kg)
  for (const x of periodSets) {
    const t = typeOf(x);
    if (!usesWeight(t) || t === "assisted_bodyweight" || !usesReps(t)) continue;
    const e = epley1rm(x.actualWeight ?? 0, x.actualReps ?? 0);
    if (e <= 0) continue;
    const date = keyOf(dateOf.get(x.sessionId)!);
    const byDate = perLift.get(x.exerciseId) ?? new Map<string, number>();
    byDate.set(date, Math.max(byDate.get(date) ?? 0, e));
    perLift.set(x.exerciseId, byDate);
  }
  const allLifts: LiftTrend[] = [...perLift.entries()].map(([exerciseId, byDate]) => {
    const series = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    const kg = series.map(([, v]) => v);
    const changePct = fittedChangePct(kg);
    return {
      exerciseId,
      name: exById.get(exerciseId)?.name?.slice(0, 80) || "Exercise",
      sessions: series.length,
      series: series.map(([date, v]) => ({ date, value: toUnits(v, units) })),
      startE1rm: series.length ? toUnits(kg[0], units) : null,
      endE1rm: series.length ? toUnits(kg[kg.length - 1], units) : null,
      changePct: series.length >= MIN_TREND_SESSIONS ? changePct : null,
      status: liftStatus(series.length, changePct),
    };
  });
  const lifts = allLifts
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, MAX_LIFTS);
  const trended = lifts.filter((l) => l.status !== "insufficient");

  // Data quality.
  const rpeOn = showsRpe(coaching);
  const rpeEligible = periodSets.filter((x) => usesReps(typeOf(x)));
  const rpeLoggedPct =
    rpeOn && rpeEligible.length ? Math.round((rpeEligible.filter((x) => x.rpe != null).length / rpeEligible.length) * 100) : null;
  const notes: string[] = [];
  if (inPeriod.length === 0) notes.push("No completed workouts in this period.");
  else if (inPeriod.length < 4) notes.push("Fewer than 4 workouts in this period — trends are tentative.");
  if (target === null) notes.push("No weekly training target set in Profile, so adherence can't be measured.");
  if (lifts.length > 0 && trended.length === 0) notes.push(`No lift has ${MIN_TREND_SESSIONS}+ sessions in this period yet.`);
  if (rpeLoggedPct !== null && rpeLoggedPct < 50) notes.push("Effort (RPE) is logged on under half of sets.");
  if (inPrev.length === 0 && inPeriod.length > 0) notes.push("No workouts in the previous period to compare against.");

  const confidence: Confidence =
    inPeriod.length < 4 || trended.length === 0
      ? "low"
      : inPeriod.length >= weeks * 2 && trended.length >= 2 && inPrev.length > 0
        ? "high"
        : "medium";

  const evidence: Omit<AnalystEvidence, "facts"> = {
    schemaVersion: ANALYST_SCHEMA,
    period: { weeks, from: keyOf(start), to: keyOf(end) },
    units,
    consistency: {
      sessions: inPeriod.length,
      perWeek,
      targetPerWeek: target,
      adherencePct: target ? Math.min(100, Math.round((perWeek / target) * 100)) : null,
      previousSessions: inPrev.length,
      longestGapDays: longestGap,
      daysSinceLast: Number.isFinite(lastEver) ? end - lastEver : null,
    },
    muscleGroups,
    lifts,
    dataQuality: {
      workingSets: periodSets.length,
      rpeLoggedPct,
      liftsWithTooFewSessions: lifts.length - trended.length,
      notes,
    },
    confidence,
  };
  return { ...evidence, facts: factsOf(evidence) };
}

/** The flat, citable list of every number in the package. */
function factsOf(e: Omit<AnalystEvidence, "facts">): AnalystFact[] {
  const f: AnalystFact[] = [];
  const add = (id: string, label: string, value: number | null, unit: string) => {
    if (value !== null && Number.isFinite(value)) f.push({ id, label, value, unit });
  };
  const c = e.consistency;
  add("period.weeks", "Period length", e.period.weeks, "weeks");
  add("consistency.sessions", "Workouts in period", c.sessions, "workouts");
  add("consistency.perWeek", "Workouts per week", c.perWeek, "per week");
  add("consistency.target", "Weekly target", c.targetPerWeek, "per week");
  add("consistency.adherence", "Adherence to weekly target", c.adherencePct, "%");
  add("consistency.previous", "Workouts in previous period", c.previousSessions, "workouts");
  add("consistency.longestGap", "Longest gap between workouts", c.longestGapDays, "days");
  add("consistency.daysSinceLast", "Days since last workout", c.daysSinceLast, "days");
  for (const m of e.muscleGroups) {
    add(`volume.${m.group}.sets`, `Hard sets: ${m.group}`, m.hardSets, "sets");
    add(`volume.${m.group}.perWeek`, `Hard sets per week: ${m.group}`, m.perWeek, "sets/week");
    add(`volume.${m.group}.previous`, `Hard sets previous period: ${m.group}`, m.previousHardSets, "sets");
    add(`volume.${m.group}.change`, `Hard-set change vs previous period: ${m.group}`, m.changePct, "%");
  }
  e.lifts.forEach((l, i) => {
    add(`lift.${i}.sessions`, `Sessions: ${l.name}`, l.sessions, "sessions");
    add(`lift.${i}.start`, `Est. 1RM at start: ${l.name}`, l.startE1rm, e.units);
    add(`lift.${i}.end`, `Est. 1RM latest: ${l.name}`, l.endE1rm, e.units);
    add(`lift.${i}.change`, `Est. 1RM trend over period: ${l.name}`, l.changePct, "%");
  });
  add("quality.workingSets", "Working sets logged", e.dataQuality.workingSets, "sets");
  add("quality.rpeLogged", "Sets with RPE logged", e.dataQuality.rpeLoggedPct, "%");
  return f;
}

// ---------------------------------------------------------------------------
// Numeric-claim validation

const NUMBER_RE = /(?<![\w.])[-+−]?\d+(?:[.,]\d+)?/g;
// Names of measures that contain digits but aren't claims.
const NUMERIC_TERMS = /\b(?:e?1\s?RM|RPE\s?(?=\d))/gi;

function numbersIn(text: string): number[] {
  return [...text.replace(NUMERIC_TERMS, " ").matchAll(NUMBER_RE)].map((m) =>
    Number(m[0].replace("−", "-").replace(",", ".")),
  );
}

/**
 * Numbers in `text` that don't match a fact. A number matches when it equals a
 * fact's value (sign-insensitive, so "dropped 4%" can cite −4) or its rounding
 * to a whole number. Digits that are part of an exercise's own name are allowed.
 */
export function unsupportedNumbers(text: string, evidence: Pick<AnalystEvidence, "facts">): number[] {
  const allowed = new Set<number>();
  for (const f of evidence.facts) {
    for (const v of [f.value, Math.abs(f.value)]) {
      allowed.add(round1(v));
      allowed.add(Math.round(v));
    }
    for (const n of numbersIn(f.label)) allowed.add(Math.abs(n));
  }
  return numbersIn(text).filter((n) => !allowed.has(round1(Math.abs(n))) && !allowed.has(round1(n)));
}

// ---------------------------------------------------------------------------
// Interpretation: the AI's output shape, its validator and the rule-based fallback.

export interface AnalystPoint {
  title: string;
  detail: string;
  /** Facts the point relies on. */
  factIds: string[];
}

export interface AnalystInterpretation {
  summary: string;
  points: AnalystPoint[];
  source: "ai" | "rules";
}

const MAX_POINTS = 4;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/**
 * Parses and checks a model reply. Null when the shape is wrong, a point cites
 * an unknown fact, or any text contains a number not in the evidence.
 */
export function validateInterpretation(raw: unknown, evidence: AnalystEvidence): AnalystInterpretation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const summary = clip(r.summary, 400);
  if (!summary || !Array.isArray(r.points)) return null;
  const ids = new Set(evidence.facts.map((f) => f.id));
  const points: AnalystPoint[] = [];
  for (const p of r.points.slice(0, MAX_POINTS)) {
    if (!p || typeof p !== "object") return null;
    const q = p as Record<string, unknown>;
    const title = clip(q.title, 80);
    const detail = clip(q.detail, 300);
    const factIds = Array.isArray(q.factIds) ? q.factIds.filter((x): x is string => typeof x === "string") : [];
    if (!title || !detail || factIds.length === 0 || factIds.some((id) => !ids.has(id))) return null;
    points.push({ title, detail, factIds: [...new Set(factIds)].slice(0, 6) });
  }
  const text = [summary, ...points.flatMap((p) => [p.title, p.detail])].join("\n");
  if (unsupportedNumbers(text, evidence).length > 0) return null;
  return { summary, points, source: "ai" };
}

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  legs: "Legs",
  cardio: "Cardio",
  other: "Other",
};

/** A plain reading of the evidence, used without AI or when the AI's reply fails validation. */
export function ruleInterpretation(e: AnalystEvidence): AnalystInterpretation {
  const c = e.consistency;
  const points: AnalystPoint[] = [];
  if (c.sessions === 0) {
    return {
      summary: `No completed workouts in the last ${e.period.weeks} weeks, so there's nothing to analyse yet.`,
      points: [],
      source: "rules",
    };
  }
  const summary =
    c.targetPerWeek !== null
      ? `${c.sessions} workouts in ${e.period.weeks} weeks — ${c.perWeek} per week against a target of ${c.targetPerWeek}.`
      : `${c.sessions} workouts in ${e.period.weeks} weeks, ${c.perWeek} per week.`;

  const idx = (l: LiftTrend) => e.lifts.indexOf(l);
  const improving = e.lifts.filter((l) => l.status === "improving");
  const stalled = e.lifts.filter((l) => l.status === "stalled");
  const declining = e.lifts.filter((l) => l.status === "declining");
  if (improving[0]) {
    const l = improving[0];
    points.push({
      title: `${l.name} is moving up`,
      detail: `Estimated 1RM went from ${l.startE1rm} to ${l.endE1rm} ${e.units} over ${l.sessions} sessions (trend +${l.changePct}%).`,
      factIds: [`lift.${idx(l)}.start`, `lift.${idx(l)}.end`, `lift.${idx(l)}.sessions`, `lift.${idx(l)}.change`],
    });
  }
  for (const l of [...declining, ...stalled].slice(0, 2)) {
    const down = l.status === "declining";
    points.push({
      title: down ? `${l.name} is slipping` : `${l.name} has stalled`,
      detail: down
        ? `Estimated 1RM trend is ${l.changePct}% across ${l.sessions} sessions. Check recovery and whether the load jumped too fast.`
        : `Estimated 1RM trend is ${l.changePct}% across ${l.sessions} sessions. A change of rep range or a small reset can restart progress.`,
      factIds: [`lift.${idx(l)}.change`, `lift.${idx(l)}.sessions`],
    });
  }
  if (c.adherencePct !== null && c.adherencePct < 75) {
    points.push({
      title: "Below your weekly target",
      detail: `You're at ${c.adherencePct}% of your weekly target. Fewer, shorter sessions done reliably beat an ambitious plan.`,
      factIds: ["consistency.adherence"],
    });
  } else if (c.longestGapDays !== null && c.longestGapDays >= 10) {
    points.push({
      title: "A long break in the period",
      detail: `The longest gap between workouts was ${c.longestGapDays} days. Strength usually returns quickly after a break.`,
      factIds: ["consistency.longestGap"],
    });
  }
  const top = e.muscleGroups[0];
  if (points.length < MAX_POINTS && top && top.changePct !== null && Math.abs(top.changePct) >= 20) {
    points.push({
      title: `${GROUP_LABEL[top.group]} volume ${top.changePct > 0 ? "up" : "down"}`,
      detail: `${top.hardSets} hard sets this period vs ${top.previousHardSets} in the previous one (${top.changePct > 0 ? "+" : ""}${top.changePct}%).`,
      factIds: [`volume.${top.group}.sets`, `volume.${top.group}.previous`, `volume.${top.group}.change`],
    });
  }
  return { summary, points: points.slice(0, MAX_POINTS), source: "rules" };
}
