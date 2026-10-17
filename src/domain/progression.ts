// Deterministic progression + strength math. No I/O, no randomness — this is the
// "intelligence" of the MVP and it must be predictable and explainable.

import type { Units, WorkoutSet } from "./types";

/** Estimated 1-rep-max via the Epley formula. */
export function epley1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Smallest sensible load increment for a unit (a pair of the smallest plates). */
export function plateIncrement(units: Units): number {
  return units === "kg" ? 2.5 : 5;
}

/** Round a load to the nearest achievable increment for the unit. */
export function roundToIncrement(weight: number, units: Units): number {
  const step = plateIncrement(units);
  return Math.round(weight / step) * step;
}

export type SuggestionAction = "increase" | "hold" | "deload" | "start";

export interface ProgressionSuggestion {
  action: SuggestionAction;
  weight: number;
  reps: number;
  reason: string;
}

export interface LastPerformance {
  /** Sets logged for this exercise in the most recent session, in order. */
  sets: Pick<WorkoutSet, "actualReps" | "actualWeight" | "rpe" | "completed">[];
  targetReps: number;
}

/**
 * Suggest the working load for the next session of an exercise, based purely on the
 * last session's performance.
 *
 * Rules:
 *  - No history            -> "start" (use the template target, or a light default).
 *  - All sets hit target reps and weren't grindy (RPE < 9.5) -> "increase".
 *  - Hit target reps but RPE >= 9.5                          -> "hold".
 *  - Missed target reps on any set                           -> "hold" once, then
 *    "deload" 10% if the previous session already missed (caller passes missStreak).
 */
export function suggestNextLoad(
  last: LastPerformance | null,
  units: Units,
  opts: { isCompound: boolean; templateWeight?: number | null; missStreak?: number } = {
    isCompound: true,
  }
): ProgressionSuggestion {
  const targetReps = last?.targetReps ?? 8;

  if (!last || last.sets.length === 0) {
    const weight = opts.templateWeight ?? 0;
    return {
      action: "start",
      weight: roundToIncrement(weight, units),
      reps: targetReps,
      reason: "No history yet — starting from the template target.",
    };
  }

  const working = last.sets.filter((s) => s.actualWeight != null && s.actualReps != null);
  if (working.length === 0) {
    return {
      action: "start",
      weight: roundToIncrement(opts.templateWeight ?? 0, units),
      reps: targetReps,
      reason: "Previous session had no completed sets — repeating the target.",
    };
  }

  const topWeight = Math.max(...working.map((s) => s.actualWeight as number));
  const allHitReps = working.every((s) => (s.actualReps as number) >= targetReps);
  const grindy = working.some((s) => (s.rpe ?? 0) >= 9.5);
  const missStreak = opts.missStreak ?? 0;

  if (allHitReps && !grindy) {
    // Compounds tolerate a full plate jump; isolations get a single step.
    const step = opts.isCompound ? plateIncrement(units) * 2 : plateIncrement(units);
    const weight = roundToIncrement(topWeight + step, units);
    return {
      action: "increase",
      weight,
      reps: targetReps,
      reason: `Hit all ${targetReps} reps last time — adding ${step}${units}.`,
    };
  }

  if (allHitReps && grindy) {
    return {
      action: "hold",
      weight: roundToIncrement(topWeight, units),
      reps: targetReps,
      reason: "Hit reps but it was near-maximal (RPE ≥ 9.5) — repeat to consolidate.",
    };
  }

  if (missStreak >= 1) {
    const weight = roundToIncrement(topWeight * 0.9, units);
    return {
      action: "deload",
      weight,
      reps: targetReps,
      reason: "Missed reps two sessions running — deloading 10% to rebuild.",
    };
  }

  return {
    action: "hold",
    weight: roundToIncrement(topWeight, units),
    reps: targetReps,
    reason: "Missed some reps last time — repeating the same load.",
  };
}

/**
 * Detect PRs from a freshly completed set against existing bests.
 * Bodyweight sets (no load) can still set a rep PR. Assisted exercises never
 * PR on load — more counterweight means an easier set.
 */
export function detectPrs(
  set: Pick<WorkoutSet, "actualReps" | "actualWeight">,
  bests: { e1rm: number; maxWeight: number; maxReps: number },
  opts: { assisted?: boolean } = {}
): { kind: "e1rm" | "max_weight" | "max_reps"; value: number }[] {
  const reps = set.actualReps ?? 0;
  const weight = set.actualWeight ?? 0;
  if (weight <= 0 || opts.assisted) {
    return reps > 0 && bests.maxReps > 0 && reps > bests.maxReps
      ? [{ kind: "max_reps", value: reps }]
      : [];
  }

  const prs: { kind: "e1rm" | "max_weight" | "max_reps"; value: number }[] = [];
  // Top weight is the meaningful PR when only weight is tracked.
  if (weight > bests.maxWeight) prs.push({ kind: "max_weight", value: weight });
  // 1RM and rep PRs only make sense when reps were recorded.
  if (reps > 0) {
    const e1rm = epley1rm(weight, reps);
    if (e1rm > bests.e1rm) prs.push({ kind: "e1rm", value: round1(e1rm) });
    if (reps > bests.maxReps) prs.push({ kind: "max_reps", value: reps });
  }
  return prs;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Personal records for one exercise, rebuilt from its logged sets in the order
 * they were completed. Used after a logged set is corrected, moved or deleted,
 * so a typo (350 instead of 35) can't leave a phantom record behind.
 */
export function replayPrs(
  sets: (Pick<WorkoutSet, "actualReps" | "actualWeight"> & { completedAt: string; assisted?: boolean })[]
): { kind: "e1rm" | "max_weight" | "max_reps"; value: number; achievedAt: string }[] {
  const ordered = [...sets].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const bests = { e1rm: 0, maxWeight: 0, maxReps: 0 };
  const latest = new Map<string, { kind: "e1rm" | "max_weight" | "max_reps"; value: number; achievedAt: string }>();
  for (const s of ordered) {
    for (const pr of detectPrs(s, bests, { assisted: s.assisted })) {
      latest.set(pr.kind, { ...pr, achievedAt: s.completedAt });
    }
    // Same running bests as the store's bestsFor().
    const reps = s.actualReps ?? 0;
    if (s.actualWeight != null) bests.maxWeight = Math.max(bests.maxWeight, s.actualWeight);
    if (s.actualReps != null) {
      if (s.actualWeight != null) bests.e1rm = Math.max(bests.e1rm, epley1rm(s.actualWeight, reps));
      bests.maxReps = Math.max(bests.maxReps, reps);
    }
  }
  return [...latest.values()];
}
