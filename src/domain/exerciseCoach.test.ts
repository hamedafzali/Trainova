import { describe, expect, it } from "vitest";
import { unsupportedNumbers } from "./analyst";
import {
  assessSets,
  buildCoachEvidence,
  buildExerciseContext,
  limitationApplies,
  ruleReading,
  substitutionsFor,
  validateCoachReading,
  type ExerciseCoachInput,
} from "./exerciseCoach";
import type { Device, Exercise, WorkoutSession, WorkoutSet, WorkoutTemplate } from "./types";

function ex(id: string, name: string, primaryMuscle: string, extra: Partial<Exercise> = {}): Exercise {
  return { id, owner: null, name, defaultDeviceId: null, isCompound: true, primaryMuscle, ...extra };
}

function session(id: string, date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id,
    owner: "u",
    templateId: null,
    title: "W",
    date,
    status: "completed",
    startedAt: `${date}T10:00:00Z`,
    completedAt: `${date}T11:00:00Z`,
    reopenedAt: null,
    updatedAt: `${date}T11:00:00Z`,
    ...extra,
  };
}

/** [kg, reps, rpe?, completed?] */
type S = [number | null, number | null, number?, boolean?];
function sets(sessionId: string, exerciseId: string, list: S[], deviceId: string | null = null): WorkoutSet[] {
  return list.map(([w, r, rpe, completed], i) => ({
    id: `${sessionId}-${exerciseId}-${i}`,
    owner: "u",
    sessionId,
    exerciseId,
    deviceId,
    setIndex: i,
    targetReps: null,
    targetWeight: null,
    actualReps: r,
    actualWeight: w,
    rpe: rpe ?? null,
    completed: completed ?? true,
    completedAt: completed === false ? null : "2026-10-18T10:20:00Z",
  }));
}

const legPress: Device = {
  id: "d-lp",
  owner: null,
  name: "Leg Press",
  machineNumber: "22",
  category: "machine",
  primaryMuscle: "quads",
  guidance: "Feet shoulder-width on the platform.",
  loading: "stack",
} as Device;

const library: Exercise[] = [
  ex("lp", "Leg Press", "quads", { equipment: "machine", defaultDeviceId: "d-lp", secondaryMuscles: ["glutes"] }),
  ex("squat", "Back Squat", "quads", { equipment: "barbell", secondaryMuscles: ["glutes", "hamstrings"] }),
  ex("goblet", "Goblet Squat", "quads", { equipment: "dumbbell", secondaryMuscles: ["glutes"] }),
  ex("hack", "Hack Squat", "quads", { equipment: "plate_loaded" }),
  ex("ext", "Leg Extension", "quads", { equipment: "machine", isCompound: false }),
  ex("curl", "Leg Curl", "hamstrings", { equipment: "machine", isCompound: false }),
  ex("bench", "Bench Press", "chest", { equipment: "barbell" }),
  ex("bike", "Bike", "quads", { equipment: "cardio_machine", type: "cardio" }),
];

const template: WorkoutTemplate = {
  id: "t1",
  owner: "u",
  name: "Legs",
  notes: null,
  exercises: [
    {
      exerciseId: "lp",
      deviceId: "d-lp",
      sets: [
        { targetReps: 8, targetWeight: 100 },
        { targetReps: 8, targetWeight: 100 },
        { targetReps: 8, targetWeight: 100 },
      ],
      restSeconds: 120,
      targetRpe: 8,
      repMax: 10,
      cue: "Control the bottom",
      substitution: "Hack Squat",
    },
  ],
} as WorkoutTemplate;

function input(today: S[], extra: Partial<ExerciseCoachInput> = {}): ExerciseCoachInput {
  return {
    sessions: [
      session("old1", "2026-10-04"),
      session("old2", "2026-10-11"),
      session("now", "2026-10-18", { status: "active", templateId: "t1", completedAt: null }),
    ],
    sets: [
      ...sets("old1", "lp", [[90, 10], [90, 9]], "d-lp"),
      ...sets("old2", "lp", [[95, 9], [95, 8]], "d-lp"),
      ...sets("now", "lp", today, "d-lp"),
      ...sets("now", "squat", [[60, 5, undefined, false]]),
    ],
    exercises: library,
    devices: [legPress],
    templates: [template],
    units: "kg",
    coaching: null,
    ...extra,
  };
}

describe("buildExerciseContext", () => {
  it("collects metadata, device, plan, today's sets and history", () => {
    const c = buildExerciseContext(input([[100, 8, 8]]), "now", "lp")!;
    expect(c.exercise).toMatchObject({ id: "lp", name: "Leg Press", equipment: "machine" });
    expect(c.device).toMatchObject({ name: "Leg Press", machineNumber: "22", loading: "stack" });
    expect(c.plan).toMatchObject({ sets: 3, repMin: 8, repMax: 10, targetWeight: 100, targetRpe: 8, restSeconds: 120 });
    expect(c.plan?.substitution).toBe("Hack Squat");
    expect(c.today).toEqual([{ index: 1, kind: "normal", completed: true, weight: 100, reps: 8, rpe: 8, seconds: null }]);
    expect(c.history.map((h) => [h.date, h.topWeight, h.topReps])).toEqual([
      ["2026-10-11", 95, 9],
      ["2026-10-04", 90, 10],
    ]);
    expect(c.bestE1rm).toBeGreaterThan(110);
  });

  it("shows loads in pounds when the user trains in pounds", () => {
    const c = buildExerciseContext(input([[100, 8]], { units: "lb" }), "now", "lp")!;
    expect(c.today[0].weight).toBe(220);
    expect(c.plan?.targetWeight).toBe(220);
  });

  it("returns null for an unknown session or exercise", () => {
    expect(buildExerciseContext(input([]), "nope", "lp")).toBeNull();
    expect(buildExerciseContext(input([]), "now", "nope")).toBeNull();
  });
});

describe("assessSets", () => {
  const assess = (today: S[], extra: Partial<ExerciseCoachInput> = {}) =>
    assessSets(buildExerciseContext(input(today, extra), "now", "lp")!);

  it("starts from last session's top set before any working set", () => {
    const a = assess([[null, null, undefined, false]]);
    expect(a.status).toBe("not_started");
    expect(a.next?.action).toBe("start");
    expect(a.next?.weight).toBeGreaterThan(0);
    expect(a.next?.reason).toMatch(/95 kg × 9/);
  });

  it("keeps the load when a set lands in range", () => {
    const a = assess([[100, 9, 8], [null, null, undefined, false]]);
    expect(a.status).toBe("on_track");
    expect(a.next).toMatchObject({ action: "keep", weight: 100, reps: 9 });
  });

  it("drops one stack plate after a near-max set", () => {
    const a = assess([[100, 8, 10], [null, null, undefined, false]]);
    expect(a.status).toBe("struggling");
    expect(a.next).toMatchObject({ action: "reduce", weight: 95, reps: 8 });
  });

  it("drops one step when two or more reps short", () => {
    const a = assess([[100, 5], [null, null, undefined, false]]);
    expect(a.next).toMatchObject({ action: "reduce", weight: 95 });
  });

  it("holds the load when one rep short", () => {
    const a = assess([[100, 7, 9], [null, null, undefined, false]]);
    expect(a.next).toMatchObject({ action: "keep", weight: 100, reps: 8 });
  });

  it("adds the smallest step when well past the top of the range and easy", () => {
    const a = assess([[100, 13, 6], [null, null, undefined, false]]);
    expect(a.status).toBe("ahead");
    expect(a.next).toMatchObject({ action: "increase", weight: 105, reps: 8 });
  });

  it("doesn't add load past the range when the set was hard", () => {
    const a = assess([[100, 13, 9], [null, null, undefined, false]]);
    expect(a.next?.action).toBe("keep");
  });

  it("finishes once every planned set is done", () => {
    const a = assess([[100, 8], [100, 8], [100, 8]]);
    expect(a.status).toBe("done");
    expect(a.next?.action).toBe("finish");
  });

  it("ignores warm-ups", () => {
    const i = input([[60, 10], [100, 8, 8], [null, null, undefined, false]]);
    i.sets.find((s) => s.sessionId === "now" && s.setIndex === 0 && s.exerciseId === "lp")!.kind = "warmup";
    const a = assessSets(buildExerciseContext(i, "now", "lp")!);
    expect(a.sets).toEqual([{ index: 2, verdict: "on_target" }]);
  });

  it("notes when RPE isn't logged", () => {
    expect(assess([[100, 9], [null, null, undefined, false]]).notes.join(" ")).toMatch(/RPE/);
  });
});

describe("limitationApplies", () => {
  it("matches the user's limitation text against the exercise's region", () => {
    const c = buildExerciseContext(input([], { coaching: { limitations: "Left knee is sore on deep flexion" } }), "now", "lp")!;
    expect(limitationApplies(c)).toBe(true);
    expect(assessSets(c).notes[0]).toMatch(/limitation/);
    const other = buildExerciseContext(input([], { coaching: { limitations: "Tennis elbow" } }), "now", "lp")!;
    expect(limitationApplies(other)).toBe(false);
  });
});

describe("substitutionsFor", () => {
  const ctx = (access: ExerciseCoachInput["coaching"] = null) => buildExerciseContext(input([], { coaching: access }), "now", "lp")!;
  const hack = library.find((e) => e.id === "hack")!;

  it("puts the plan's alternative first and excludes the exercise itself, cardio and other muscles", () => {
    const subs = substitutionsFor(ctx(), library, { planMatch: hack, limit: 10 });
    expect(subs[0]).toMatchObject({ exerciseId: "hack", fromPlan: true });
    const ids = subs.map((s) => s.exerciseId);
    expect(ids).not.toContain("lp");
    expect(ids).not.toContain("bike");
    expect(ids).not.toContain("bench");
    expect(ids).toContain("squat");
  });

  it("excludes exercises already in the workout", () => {
    const e = buildCoachEvidence(input([]), "now", "lp")!;
    expect(e.substitutions.map((s) => s.exerciseId)).not.toContain("squat");
  });

  it("respects equipment access", () => {
    const subs = substitutionsFor(ctx({ equipment: "dumbbells" }), library, { limit: 10 });
    expect(subs.map((s) => s.exerciseId)).toEqual(["goblet"]);
  });
});

describe("facts and readings", () => {
  const e = buildCoachEvidence(input([[100, 8, 10], [null, null, undefined, false]]), "now", "lp", {
    planMatch: (n) => library.find((x) => x.name === n) ?? null,
  })!;
  const check = (t: string) => unsupportedNumbers(t, e);

  it("lets the model cite logged numbers and device numbers", () => {
    expect(check("Set 1 was 100 kg × 8 at RPE 10 on machine 22; go 95 kg next.")).toEqual([]);
    expect(check("Try 140 kg.")).toEqual([140]);
  });

  it("accepts a grounded reading", () => {
    const r = validateCoachReading({ answer: "Drop to 95 kg and aim for 8 clean reps.", cues: ["Control the bottom"] }, e, check);
    expect(r).toMatchObject({ source: "ai", cues: ["Control the bottom"] });
  });

  it("rejects invented numbers and machine settings", () => {
    expect(validateCoachReading({ answer: "Go to 130 kg." }, e, check)).toBeNull();
    expect(validateCoachReading({ answer: "Set the seat to 8 and push." }, e, check)).toBeNull();
    expect(validateCoachReading({ answer: "" }, e, check)).toBeNull();
    expect(validateCoachReading(null, e, check)).toBeNull();
  });

  it("writes a rule-based reading from the assessment", () => {
    const r = ruleReading(e);
    expect(r.source).toBe("rules");
    expect(r.answer).toMatch(/95 kg × 8 reps/);
    expect(check(r.answer)).toEqual([]);
    expect(r.cues[0]).toBeTruthy();
  });
});
