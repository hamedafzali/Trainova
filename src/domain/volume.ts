// Shared volume/best-weight aggregation for completed sets — the single source
// of truth so History, Progress, and any other view agree on numbers for the
// same session. Extracted after History and Progress diverged on how to
// handle a set with weight logged but no reps logged (?? 0 vs skip vs ?? 1).

import type { WorkoutSet } from "./types";

type VolumeInput = Pick<WorkoutSet, "actualWeight" | "actualReps">;
type WeightInput = Pick<WorkoutSet, "actualWeight">;

/**
 * Volume for a single set (weight x reps).
 *
 * Convention: a set needs BOTH weight and reps to contribute volume — you
 * cannot know how much work was done from weight alone. A set with weight
 * logged but no reps logged contributes 0, and logs a dev warning so the
 * missing data is visible instead of silently producing a wrong number.
 */
export function calcSetVolume(set: VolumeInput): number {
  if (set.actualWeight == null || set.actualWeight <= 0) return 0;
  if (set.actualReps == null) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "calcSetVolume: set has actualWeight but no actualReps — contributing 0 to volume",
        set
      );
    }
    return 0;
  }
  return set.actualWeight * set.actualReps;
}

/** Total volume across a list of sets. */
export function totalVolume(sets: VolumeInput[]): number {
  return sets.reduce((sum, s) => sum + calcSetVolume(s), 0);
}

/** Heaviest logged weight across a list of sets (0 if none logged). */
export function bestWeight(sets: WeightInput[]): number {
  return sets.reduce((max, s) => (s.actualWeight != null ? Math.max(max, s.actualWeight) : max), 0);
}
