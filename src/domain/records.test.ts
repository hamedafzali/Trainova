import { describe, expect, it } from "vitest";
import { rebuildAllPrs, rebuildPrs } from "./records";
import type { Exercise, PersonalRecord, WorkoutSet } from "./types";

const ex = (id: string, extra: Partial<Exercise> = {}) =>
  ({ id, owner: "me", name: id, defaultDeviceId: null, isCompound: true, primaryMuscle: null, ...extra }) as Exercise;

let n = 0;
const set = (exerciseId: string, w: number | null, r: number | null, extra: Partial<WorkoutSet> = {}) =>
  ({
    id: `s${++n}`,
    sessionId: "x",
    exerciseId,
    deviceId: null,
    setIndex: 0,
    actualWeight: w,
    actualReps: r,
    completed: true,
    completedAt: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00.000Z`,
    ...extra,
  }) as WorkoutSet;

describe("rebuildPrs", () => {
  it("ignores warm-ups and incomplete sets", () => {
    const sets = [
      set("squat", 100, 5),
      set("squat", 140, 1, { kind: "warmup" }),
      set("squat", 150, 1, { completed: false }),
    ];
    const prs = rebuildAllPrs({ prs: [], sets, exercises: [ex("squat")], devices: [] });
    expect(prs.find((p) => p.kind === "max_weight")?.value).toBe(100);
  });

  it("removes a phantom record once the set behind it is gone", () => {
    const phantom: PersonalRecord = { exerciseId: "bench", kind: "max_weight", value: 350, achievedAt: "2026-10-01" };
    const prs = rebuildPrs({ prs: [phantom], sets: [set("bench", 35, 8)], exercises: [ex("bench")], devices: [] }, [
      "bench",
    ]);
    expect(prs.find((p) => p.kind === "max_weight")?.value).toBe(35);
  });

  it("keeps records of exercises it wasn't asked to rebuild", () => {
    const other: PersonalRecord = { exerciseId: "row", kind: "max_weight", value: 80, achievedAt: "2026-10-01" };
    const prs = rebuildPrs({ prs: [other], sets: [], exercises: [], devices: [] }, ["bench"]);
    expect(prs).toEqual([other]);
  });
});
