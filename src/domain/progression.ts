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

/** Round a load to the nearest multiple of `step` (defaults to the plate increment). */
export function roundToIncrement(weight: number, units: Units, step = plateIncrement(units)): number {
  // Hundredths avoid float drift (e.g. 1.25 steps).
  const s = Math.round(step * 100);
  return (Math.round(Math.round(weight * 100) / s) * s) / 100;
}

/** How the load is added: plates on a bar or pin, a selectorized stack, dumbbells. */
export type LoadingKind = "plates" | "stack" | "dumbbell";

/**
 * The smallest jump that's actually available on this equipment, in display
 * units. Selectorized stacks move a whole plate (≈5 kg / 10 lb); dumbbells
 * usually come in 2–2.5 kg / 5 lb steps; plate-loaded lifts use a pair of the
 * smallest plates, and compounds tolerate two pairs.
 */
export function loadIncrement(units: Units, opts: { loading?: LoadingKind | null; isCompound?: boolean } = {}): number {
  const plate = plateIncrement(units);
  if (opts.loading === "stack") return units === "kg" ? 5 : 10;
  if (opts.loading === "dumbbell") return plate;
  return opts.isCompound ? plate * 2 : plate;
}

export type SuggestionAction = "increase" | "add_reps" | "hold" | "deload" | "start";

export interface ProgressionSuggestion {
  action: SuggestionAction;
  weight: number;
  reps: number;
  reason: string;
  /** "low" when effort (RPE) wasn't logged, so the call is reps-only. */
  confidence: "high" | "low";
}

export interface LastPerformance {
  /** Sets logged for this exercise in the most recent session, in order. */
  sets: Pick<WorkoutSet, "actualReps" | "actualWeight" | "rpe" | "completed" | "durationSec" | "durationMin">[];
  targetReps: number;
}

export interface ProgressionOptions {
  isCompound: boolean;
  templateWeight?: number | null;
  /**
   * Consecutive most-recent sessions (including `last`) where a working set
   * fell short of the rep target. Two in a row triggers a deload.
   */
  missStreak?: number;
  /** Double progression: reps climb from `min` to `max` before load goes up. */
  repRange?: { min: number; max: number } | null;
  /** Equipment loading; drives the increment. */
  loading?: LoadingKind | null;
  /** Explicit increment in display units; overrides `loading`. */
  increment?: number | null;
}

/** RPE at or above this means the set was (near-)maximal. */
const GRINDY_RPE = 9.5;
/** At or below this, the set clearly had reps left — enough to add load. */
const EASY_RPE = 8;

/**
 * Suggest the working load for the next session of an exercise, based purely on the
 * last session's performance.
 *
 * Rules (all deterministic and explained in `reason`):
 *  - No history -> "start" from the template target.
 *  - Rep range (double progression): below the top of the range -> "add_reps"
 *    at the same load; every set at the top -> "increase" and reset to the
 *    bottom of the range.
 *  - Fixed target: every set hit it -> "increase".
 *  - Any logged RPE >= 9.5 -> "hold" instead of adding load.
 *  - RPE not logged is treated as unknown, not easy: load only goes up by the
 *    smallest increment and the suggestion is marked low-confidence.
 *  - Missed the rep floor -> "hold" once; two sessions running -> "deload" 10%.
 */
export function suggestNextLoad(
  last: LastPerformance | null,
  units: Units,
  opts: ProgressionOptions = { isCompound: true }
): ProgressionSuggestion {
  const range = opts.repRange && opts.repRange.max > opts.repRange.min ? opts.repRange : null;
  const floor = range?.min ?? last?.targetReps ?? 8;
  const top = range?.max ?? floor;
  const explicit = opts.increment && opts.increment > 0 ? opts.increment : null;
  // Full jump when effort says it's safe; the smallest available jump otherwise.
  const step = explicit ?? loadIncrement(units, opts);
  const smallest = explicit ?? loadIncrement(units, { loading: opts.loading, isCompound: false });
  // Loads move by whole equipment steps from what was lifted (stacks needn't
  // start on a round number), rounded only to display precision.
  const round = (w: number) => roundToIncrement(w, units, Math.min(smallest, plateIncrement(units)));

  if (!last || last.sets.length === 0) {
    return {
      action: "start",
      weight: round(opts.templateWeight ?? 0),
      reps: floor,
      reason: "No history yet — starting from the template target.",
      confidence: "high",
    };
  }

  const working = last.sets.filter((s) => s.actualWeight != null && s.actualReps != null);
  if (working.length === 0) {
    return {
      action: "start",
      weight: round(opts.templateWeight ?? 0),
      reps: floor,
      reason: "Previous session had no completed sets — repeating the target.",
      confidence: "high",
    };
  }

  const topWeight = Math.max(...working.map((s) => s.actualWeight as number));
  // Judge the sets at the working load; lighter back-off sets don't count.
  const atTop = working.filter((s) => s.actualWeight === topWeight);
  const minReps = Math.min(...atTop.map((s) => s.actualReps as number));
  const rpes = atTop.map((s) => s.rpe).filter((r): r is number => typeof r === "number" && r > 0);
  const rpeKnown = rpes.length > 0;
  const grindy = rpes.some((r) => r >= GRINDY_RPE);
  const easy = rpeKnown && rpes.every((r) => r <= EASY_RPE);
  const missStreak = opts.missStreak ?? 0;
  const hold = (reason: string, confidence: "high" | "low" = "high"): ProgressionSuggestion => ({
    action: "hold",
    weight: round(topWeight),
    reps: Math.max(floor, Math.min(top, minReps)),
    reason,
    confidence,
  });

  if (minReps < floor) {
    if (missStreak >= 2) {
      return {
        action: "deload",
        weight: round(topWeight * 0.9),
        reps: floor,
        reason: `Fell short of ${floor} reps two sessions running — deloading 10% to rebuild.`,
        confidence: "high",
      };
    }
    return hold(`Fell short of ${floor} reps last time — repeating the same load.`);
  }

  if (grindy) {
    return hold(`Reps were there but effort was near-maximal (RPE ≥ ${GRINDY_RPE}) — repeat to consolidate.`);
  }

  if (minReps < top) {
    // Inside the range: earn the next rep before adding load.
    const reps = Math.min(top, minReps + 1);
    return {
      action: "add_reps",
      weight: round(topWeight),
      reps,
      reason: `Same load, aim for ${reps} reps on every set — load goes up once all sets reach ${top}.`,
      confidence: rpeKnown ? "high" : "low",
    };
  }

  // Every set reached the top of the range (or the fixed target).
  const jump = rpeKnown ? step : smallest;
  const weight = round(topWeight + jump);
  const unit = `${jump}${units}`;
  return {
    action: "increase",
    weight,
    reps: floor,
    reason: rpeKnown
      ? `Hit ${top} reps on every set${easy ? " with reps to spare" : ""} — adding ${unit}${range ? ` and starting again at ${floor} reps` : ""}.`
      : `Hit ${top} reps on every set. No effort (RPE) was logged, so only the smallest jump: +${unit}.`,
    confidence: rpeKnown ? "high" : "low",
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
