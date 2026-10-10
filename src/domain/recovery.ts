// Muscle readiness: how recently and how hard each muscle was trained, so the
// app can show what is recovered and what still needs rest. A transparent
// heuristic, not physiology: each working set adds load to its primary muscle
// (1) and secondary muscles (0.5), and that load fades with a ~36 h time
// constant, so a hard session is "recovering" for about two days.

import { normaliseMuscle, type Muscle } from "./taxonomy";
import type { Exercise, WorkoutSession, WorkoutSet } from "./types";

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
