// Personal records are derived data: always rebuilt from the logged sets, so
// a corrected typo, a deleted set or a merge from another device can never
// leave a phantom record behind.

import type { Device, Exercise, PersonalRecord, WorkoutSet } from "./types";
import { exerciseTypeOf } from "./exerciseType";
import { replayPrs } from "./progression";

type RecordInputs = {
  prs: PersonalRecord[];
  sets: WorkoutSet[];
  exercises: Exercise[];
  devices: Device[];
};

/**
 * Personal records for the given exercises, rebuilt from their completed
 * working sets (warm-ups, timed holds and cardio never count). Records for
 * other exercises are kept as they are.
 */
export function rebuildPrs(st: RecordInputs, exerciseIds: Iterable<string>): PersonalRecord[] {
  const ids = new Set(exerciseIds);
  const fallbackAt = new Date().toISOString();
  const rebuilt: PersonalRecord[] = [];
  for (const exerciseId of ids) {
    const ex = st.exercises.find((e) => e.id === exerciseId);
    const logged = st.sets
      .filter((x) => x.exerciseId === exerciseId && x.completed && x.kind !== "warmup")
      .flatMap((x) => {
        const type = exerciseTypeOf(ex, st.devices.find((d) => d.id === x.deviceId));
        if (type === "duration" || type === "cardio") return [];
        return [{ ...x, completedAt: x.completedAt ?? fallbackAt, assisted: type === "assisted_bodyweight" }];
      });
    for (const pr of replayPrs(logged)) rebuilt.push({ exerciseId, ...pr });
  }
  return [...st.prs.filter((p) => !ids.has(p.exerciseId)), ...rebuilt];
}

/** Rebuild records for every exercise that has logged sets. */
export function rebuildAllPrs(st: RecordInputs): PersonalRecord[] {
  const withSets = new Set(st.sets.filter((x) => x.completed).map((x) => x.exerciseId));
  return rebuildPrs(st, withSets);
}
