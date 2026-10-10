import { describe, expect, it } from "vitest";
import { LIBRARY_DEVICES } from "./devices";
import { LIBRARY_EXERCISES } from "./exercises";
import { PROGRAM_BLUEPRINTS, buildFromBlueprint, recommendBlueprint } from "./programs";
import { MUSCLES } from "@/domain/taxonomy";

describe("library integrity", () => {
  const deviceIds = new Set(LIBRARY_DEVICES.map((d) => d.id));
  const exerciseIds = new Set(LIBRARY_EXERCISES.map((e) => e.id));

  it("has unique ids", () => {
    expect(deviceIds.size).toBe(LIBRARY_DEVICES.length);
    expect(exerciseIds.size).toBe(LIBRARY_EXERCISES.length);
  });

  it("keeps every id that existing user data references", () => {
    for (const id of ["d-22", "d-25", "d-26", "d-4", "d-7", "d-1", "d-12", "d-11", "d-tm", "d-bb", "d-db", "d-cable", "d-pull"]) {
      expect(deviceIds.has(id)).toBe(true);
    }
    for (const id of ["e-legpress", "e-legcurl", "e-legext", "e-pulldown", "e-row", "e-chestpress", "e-backext", "e-abs", "e-treadmill", "e-squat", "e-bench", "e-deadlift", "e-ohp", "e-curl", "e-pullup", "e-lateral", "e-plank", "e-hollow", "e-deadhang"]) {
      expect(exerciseIds.has(id)).toBe(true);
    }
  });

  it("links exercises to real devices and known muscles", () => {
    for (const e of LIBRARY_EXERCISES) {
      if (e.defaultDeviceId) expect(deviceIds.has(e.defaultDeviceId), e.id).toBe(true);
      expect(MUSCLES as string[]).toContain(e.primaryMuscle);
      for (const m of e.secondaryMuscles ?? []) expect(MUSCLES as string[]).toContain(m);
      expect(e.instructions?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it("only uses library exercises in starter programs", () => {
    for (const bp of PROGRAM_BLUEPRINTS) {
      for (const day of bp.days) for (const [id] of day.slots) expect(exerciseIds.has(id), `${bp.id}:${id}`).toBe(true);
    }
  });
});

describe("recommendBlueprint", () => {
  it("gives beginners with machines the machine starter", () => {
    expect(recommendBlueprint({ experience: "beginner", setting: "machines", daysPerWeek: 2 }).id).toBe(
      "bp-machine-starter"
    );
  });
  it("never sends a dumbbell-only user to a full-gym plan", () => {
    expect(recommendBlueprint({ goal: "hypertrophy", experience: "intermediate", setting: "dumbbells" }).setting).toBe(
      "dumbbells"
    );
  });
  it("picks upper/lower for 4-day intermediates", () => {
    expect(recommendBlueprint({ goal: "strength", experience: "intermediate", daysPerWeek: 4, setting: "gym" }).id).toBe(
      "bp-upper-lower-4"
    );
  });
});

describe("buildFromBlueprint", () => {
  it("creates one template per day with the planned sets", () => {
    let n = 0;
    const bp = PROGRAM_BLUEPRINTS[0];
    const { program, templates } = buildFromBlueprint(bp, "me", () => `id${n++}`, () => null);
    expect(program.source).toBe("library");
    expect(program.dayTemplateIds).toEqual(templates.map((t) => t.id));
    expect(templates[0].exercises[0].sets).toHaveLength(bp.days[0].slots[0][1]);
  });
});
