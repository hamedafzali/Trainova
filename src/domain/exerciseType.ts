import type { Device, Exercise } from "./types";
import type { ExerciseType } from "./taxonomy";

/**
 * How sets of an exercise are logged. Explicit `type` wins; otherwise fall back
 * to the legacy `mode: "time"` flag and the device category (old data).
 */
export function exerciseTypeOf(
  ex: Pick<Exercise, "type" | "mode"> | null | undefined,
  device?: Pick<Device, "category"> | null
): ExerciseType {
  if (ex?.type) return ex.type;
  if (ex?.mode === "time") return "duration";
  if (device?.category === "cardio") return "cardio";
  return "weight_reps";
}

/** Logged with a load field (possibly added/assist load). */
export function usesWeight(t: ExerciseType): boolean {
  return t === "weight_reps" || t === "weighted_bodyweight" || t === "assisted_bodyweight";
}

/** Logged with a rep count. */
export function usesReps(t: ExerciseType): boolean {
  return t !== "duration" && t !== "cardio";
}
