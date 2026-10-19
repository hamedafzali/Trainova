// Muscle readiness: how recently and how hard each muscle was trained, so the
// app can show what is recovered and what still needs rest. A transparent
// heuristic, not physiology: each working set adds load to its primary muscle
// (1) and secondary muscles (0.5), and that load fades with a ~36 h time
// constant, so a hard session is "recovering" for about two days.

import { normaliseMuscle, type Muscle } from "./taxonomy";
import type { Exercise, RecoveryCheckIn, SessionFeedback, WorkoutSession, WorkoutSet } from "./types";

export type Readiness = "fresh" | "light" | "worked" | "recovering";

/** Muscles shown on the body map (the vocabulary minus "full body"/"cardio"). */
export const MAP_MUSCLES: Muscle[] = [
  "chest",
  "shoulders",
  "rear delts",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "upper back",
  "traps",
  "lower back",
  "abs",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "calves",
];

const FULL_BODY: Muscle[] = ["chest", "upper back", "shoulders", "quads", "glutes", "hamstrings", "abs"];
const DECAY_HOURS = 36;
const WINDOW_HOURS = 7 * 24;

export interface MuscleState {
  muscle: Muscle;
  load: number;
  readiness: Readiness;
  /** ISO time of the most recent set that worked this muscle, within a week. */
  lastTrained: string | null;
}

export function readinessOf(load: number): Readiness {
  if (load >= 4) return "recovering";
  if (load >= 2) return "worked";
  if (load >= 0.5) return "light";
  return "fresh";
}

/** Hours until a muscle's load fades below "worked" (0 when it already has). */
export function hoursUntilReady(load: number): number {
  return load < 2 ? 0 : Math.ceil(DECAY_HOURS * Math.log(load / 2));
}

/** Primary and secondary muscles of an exercise with their share of a set. */
export function musclesWorked(ex: Exercise | undefined): { muscle: Muscle; share: number }[] {
  if (!ex) return [];
  const out = new Map<Muscle, number>();
  const add = (m: Muscle, share: number) => out.set(m, Math.max(out.get(m) ?? 0, share));
  const primary = (ex.primaryMuscle ?? "").toLowerCase();
  if (primary === "full body") FULL_BODY.forEach((m) => add(m, 0.5));
  else {
    const p = normaliseMuscle(primary);
    if (p && MAP_MUSCLES.includes(p)) add(p, 1);
  }
  for (const s of ex.secondaryMuscles ?? []) if (MAP_MUSCLES.includes(s)) add(s, 0.5);
  return [...out].map(([muscle, share]) => ({ muscle, share }));
}

/** Readiness of every mapped muscle at `now`. */
export function muscleReadiness(
  sessions: WorkoutSession[],
  sets: WorkoutSet[],
  exerciseById: (id: string) => Exercise | undefined,
  now: Date = new Date(),
): Map<Muscle, MuscleState> {
  const live = new Set(sessions.filter((s) => s.status !== "archived").map((s) => s.id));
  const load = new Map<Muscle, number>();
  const last = new Map<Muscle, string>();
  for (const set of sets) {
    if (!set.completed || set.kind === "warmup" || !live.has(set.sessionId) || !set.completedAt) continue;
    const hours = (now.getTime() - new Date(set.completedAt).getTime()) / 3_600_000;
    if (hours < 0 || hours > WINDOW_HOURS) continue;
    const fade = Math.exp(-hours / DECAY_HOURS);
    for (const { muscle, share } of musclesWorked(exerciseById(set.exerciseId))) {
      load.set(muscle, (load.get(muscle) ?? 0) + share * fade);
      const prev = last.get(muscle);
      if (!prev || set.completedAt > prev) last.set(muscle, set.completedAt);
    }
  }
  return new Map(
    MAP_MUSCLES.map((m) => {
      const l = load.get(m) ?? 0;
      return [m, { muscle: m, load: l, readiness: readinessOf(l), lastTrained: last.get(m) ?? null }];
    }),
  );
}

/** Working-set count per muscle in one session (primary 1, secondary 0.5). */
export function sessionMuscleLoad(
  sets: WorkoutSet[],
  exerciseById: (id: string) => Exercise | undefined,
): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const set of sets) {
    if (!set.completed || set.kind === "warmup") continue;
    for (const { muscle, share } of musclesWorked(exerciseById(set.exerciseId)))
      out.set(muscle, (out.get(muscle) ?? 0) + share);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Readiness estimate: today's check-in plus recent training load, as one
// labelled estimate with the reasons behind it. A transparent points model,
// not a measurement: every factor that moved the score is listed, and the
// result only ever suggests easing off, never pushing through.
// ---------------------------------------------------------------------------

export type ReadinessBand = "ready" | "moderate" | "low";

export interface ReadinessFactor {
  key: string;
  label: string;
  effect: "up" | "down";
}

export interface ReadinessEstimate {
  /** 0–100. */
  score: number;
  band: ReadinessBand;
  /** "low" without a check-in today: only training load is known. */
  confidence: "normal" | "low";
  factors: ReadinessFactor[];
  advice: string;
  /** Pain reported after a workout in the last week. */
  painReported: boolean;
}

export interface ReadinessInput {
  /** Today's check-in, if any. */
  checkIn: Pick<RecoveryCheckIn, "sleep" | "energy" | "soreness" | "stress"> | null;
  /** Session feedback, any order. */
  feedback: Pick<SessionFeedback, "difficulty" | "energy" | "pain" | "createdAt">[];
  /** Completed session dates (YYYY-MM-DD). */
  trainedDates: string[];
  /** Muscle states from muscleReadiness. */
  muscles: Map<Muscle, MuscleState>;
  /** Today, YYYY-MM-DD (local). */
  today: string;
  now?: Date;
}

const ADVICE: Record<ReadinessBand, string> = {
  ready: "Train as planned.",
  moderate: "Train, but ease off a notch: stop sets a rep or two earlier (around RPE 7) or drop a set.",
  low: "Consider a lighter session, mobility work or a rest day.",
};

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Days trained in a row, ending today or yesterday. */
export function consecutiveTrainingDays(trainedDates: string[], today: string): number {
  const days = new Set(trainedDates);
  let day = days.has(today) ? today : dayBefore(today);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = dayBefore(day);
  }
  return n;
}

export function readinessEstimate(input: ReadinessInput): ReadinessEstimate {
  const now = input.now ?? new Date();
  const factors: ReadinessFactor[] = [];
  const hoursAgo = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 3_600_000;

  // Training load, 0–100.
  let load = 100;
  const trained = MAP_MUSCLES.filter((m) => input.muscles.get(m)?.lastTrained);
  const recovering = trained.filter((m) => input.muscles.get(m)?.readiness === "recovering");
  if (recovering.length > 0) {
    load -= Math.round(40 * (recovering.length / Math.max(trained.length, 1)));
    factors.push({ key: "recovering", label: `${recovering.length} ${recovering.length === 1 ? "muscle" : "muscles"} still recovering`, effect: "down" });
  }
  const streak = consecutiveTrainingDays(input.trainedDates, input.today);
  if (streak >= 3) {
    load -= Math.min(30, 10 * (streak - 2));
    factors.push({ key: "streak", label: `${streak} days in a row trained`, effect: "down" });
  }
  const recent = input.feedback.filter((f) => hoursAgo(f.createdAt) >= 0 && hoursAgo(f.createdAt) <= 48);
  if (recent.some((f) => f.difficulty === "hard" || f.energy <= 2)) {
    load -= 15;
    factors.push({ key: "hard_session", label: "Last workout felt hard", effect: "down" });
  }
  if (trained.length > 0 && recovering.length === 0 && streak < 3) {
    factors.push({ key: "rested", label: "No muscle group still recovering", effect: "up" });
  }
  load = Math.max(0, load);

  // Today's check-in, 0–100.
  let score = load;
  const c = input.checkIn;
  if (c) {
    const up = (v: number) => (v - 1) / 4;
    const down = (v: number) => (5 - v) / 4;
    const wellness = 100 * (0.3 * up(c.sleep) + 0.3 * up(c.energy) + 0.25 * down(c.soreness) + 0.15 * down(c.stress));
    score = 0.6 * wellness + 0.4 * load;
    if (c.sleep <= 2) factors.push({ key: "sleep", label: "Poor sleep", effect: "down" });
    if (c.sleep >= 4) factors.push({ key: "sleep", label: "Slept well", effect: "up" });
    if (c.energy <= 2) factors.push({ key: "energy", label: "Low energy", effect: "down" });
    if (c.energy >= 4) factors.push({ key: "energy", label: "Good energy", effect: "up" });
    if (c.soreness >= 4) factors.push({ key: "soreness", label: "Quite sore", effect: "down" });
    if (c.stress >= 4) factors.push({ key: "stress", label: "High stress", effect: "down" });
  }

  const painReported = input.feedback.some((f) => !!f.pain && hoursAgo(f.createdAt) >= 0 && hoursAgo(f.createdAt) <= 7 * 24);
  score = Math.round(Math.max(0, Math.min(100, score)));
  let band: ReadinessBand = score >= 70 ? "ready" : score >= 45 ? "moderate" : "low";
  // Pain caps the band: never "train as planned" on top of reported pain.
  if (painReported && band === "ready") band = "moderate";
  if (painReported) factors.push({ key: "pain", label: "Pain reported after a recent workout", effect: "down" });

  return {
    score,
    band,
    confidence: c ? "normal" : "low",
    factors,
    advice: ADVICE[band],
    painReported,
  };
}
