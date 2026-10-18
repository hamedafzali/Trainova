import type { WorkoutTemplate } from "./types";

/** Seconds a working set takes, before its rest. */
const SET_SECONDS = 40;

/** Rough length of a workout in minutes, rounded to 5 (at least 5). */
export function estimateDuration(template: Pick<WorkoutTemplate, "exercises">): number {
  const seconds = template.exercises.reduce((n, te) => n + te.sets.length * (SET_SECONDS + te.restSeconds), 0);
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}
