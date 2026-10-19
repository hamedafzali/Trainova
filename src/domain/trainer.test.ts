import { describe, expect, it } from "vitest";
import { LIBRARY_EXERCISES } from "@/data/exercises";
import { buildTrainerContext, describeAction, parseTrainerReview, validateTrainerActions, type TrainerContext } from "./trainer";
import type { Program, RecoveryCheckIn, UserProfile, WorkoutSession, WorkoutSet, WorkoutTemplate } from "./types";

const profile: UserProfile = { displayName: null, role: "user", goal: "strength", experience: "beginner", onboarded: true };

const tpl = (id: string, name: string, exerciseIds: string[]): WorkoutTemplate => ({
  id,
  owner: "u",
  name,
  notes: null,
  exercises: exerciseIds.map((exerciseId, i) => ({
    id: `${id}-te${i}`,
    exerciseId,
    deviceId: null,
    position: i,
    restSeconds: 90,
    sets: [
      { targetReps: 8, targetWeight: 60 },
      { targetReps: 8, targetWeight: 60 },
    ],
  })),
});

function ctx(checkIns: RecoveryCheckIn[] = []): TrainerContext {
  const templates = [tpl("solo", "Arms", ["e-curl"]), tpl("dayA", "Day A", ["e-squat", "e-bench", "e-plank"])];
  const programs: Program[] = [{ id: "p", owner: "u", name: "Starter", source: "library", notes: null, dayTemplateIds: ["dayA"] }];
  const sessions: WorkoutSession[] = [
    {
      id: "s1",
      owner: "u",
      templateId: "dayA",
      title: "Day A",
      date: "2026-10-08",
      status: "completed",
      startedAt: "2026-10-08T10:00:00.000Z",
      completedAt: "2026-10-08T10:50:00.000Z",
      reopenedAt: null,
      updatedAt: "2026-10-08T10:50:00.000Z",
    },
  ];
  const set = (i: number, w: number, r: number): WorkoutSet => ({
    id: `x${i}`,
    owner: "u",
    sessionId: "s1",
    exerciseId: "e-squat",
    deviceId: null,
    setIndex: i,
    targetReps: 8,
    targetWeight: 60,
    actualReps: r,
    actualWeight: w,
    rpe: null,
    completed: true,
    completedAt: null,
  });
  return buildTrainerContext({
    now: new Date("2026-10-10T12:00:00Z"),
    units: "kg",
    profile,
    programs,
    templates,
    sessions,
    sets: [set(0, 60, 8), set(1, 65, 6)],
    prs: [],
    feedback: [],
    exercises: LIBRARY_EXERCISES,
    nextTemplateId: "dayA",
    checkIns,
  });
}

describe("buildTrainerContext", () => {
  it("orders program days before standalone workouts and marks the next one", () => {
    const c = ctx();
    expect(c.workouts.map((w) => [w.ref, w.name, w.program])).toEqual([
      ["W1", "Day A", "Starter"],
      ["W2", "Arms", null],
    ]);
    expect(c.nextWorkout).toBe("W1");
    expect(c.workouts[0].slots[1]).toMatchObject({ slot: 2, name: "Bench Press", sets: 2, reps: 8 });
  });
  it("summarises recent sessions with the best set", () => {
    const c = ctx();
    expect(c.recent[0]).toMatchObject({ date: "2026-10-08", minutes: 50 });
    expect(c.recent[0].exercises[0]).toEqual({ name: "Back Squat", sets: 2, best: "65kg×6" });
  });
  it("measures consistency against the active program", () => {
    expect(ctx().consistency).toEqual({
      program: "Starter",
      programDays: 1,
      sessionsThisWeek: 1,
      sessionsLast28: 1,
      weeksTrainedLast4: 1,
      daysSinceLast: 2,
      weekStreak: 1,
    });
  });
  it("lists the catalogue with logging types", () => {
    const plank = ctx().catalogue.find((c) => c.id === "e-plank");
    expect(plank?.type).toBe("duration");
  });
});

describe("validateTrainerActions", () => {
  it("resolves refs and slots into concrete ids", () => {
    const c = ctx();
    const [swap] = validateTrainerActions([{ type: "swap_exercise", workout: "w1", slot: 2, exerciseId: "e-dbbench" }], c);
    expect(swap).toMatchObject({ type: "swap_exercise", templateId: "dayA", teId: "dayA-te1", from: "Bench Press", exerciseId: "e-dbbench" });
    expect(describeAction(swap).title).toBe("Swap Bench Press → Dumbbell Bench Press");
  });
  it("falls back to name matching when the id is unknown", () => {
    const [a] = validateTrainerActions([{ type: "add_exercise", workout: "W2", name: "Hammer Curls", sets: 3, reps: 12 }], ctx());
    expect(a).toMatchObject({ exerciseId: "e-hammercurl", templateId: "solo" });
  });
  it("drops actions pointing at unknown workouts, slots or exercises", () => {
    const out = validateTrainerActions(
      [
        { type: "swap_exercise", workout: "W9", slot: 1, exerciseId: "e-dbbench" },
        { type: "remove_exercise", workout: "W1", slot: 7 },
        { type: "add_exercise", workout: "W1", exerciseId: "zz-unknown" },
        { type: "delete_everything" },
        "nonsense",
      ],
      ctx(),
    );
    expect(out).toEqual([]);
  });
  it("clamps sets and reps by logging type and caps the number of actions", () => {
    const out = validateTrainerActions(
      [
        { type: "set_volume", workout: "W1", slot: 1, sets: 40, reps: 500 },
        { type: "set_volume", workout: "W1", slot: 3, sets: 3, reps: 1 },
        { type: "remove_exercise", workout: "W2", slot: 1 },
        { type: "remove_exercise", workout: "W1", slot: 1 },
      ],
      ctx(),
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ sets: 10, reps: 50 });
    expect(out[1]).toMatchObject({ name: "Plank", sets: 3, reps: 5 }); // seconds, min 5
  });
  it("builds workouts and programs from catalogue items only", () => {
    const [w, p] = validateTrainerActions(
      [
        { type: "create_workout", name: "Quick", exercises: [{ exerciseId: "e-legpress", sets: 3, reps: 10, rest: 120 }, { exerciseId: "nope" }] },
        { type: "create_program", name: "2-day", days: [{ name: "A", exercises: [{ exerciseId: "e-squat" }] }, { name: "B", exercises: [] }] },
      ],
      ctx(),
    );
    expect(w).toMatchObject({ type: "create_workout", exercises: [{ exerciseId: "e-legpress", sets: 3, reps: 10, restSeconds: 120 }] });
    expect(p).toMatchObject({ type: "create_program", days: [{ name: "A" }] });
    expect(p.type === "create_program" && p.days).toHaveLength(1);
  });
});

describe("parseTrainerReview", () => {
  const raw = {
    status: "needs_attention",
    headline: "Good start — now make it regular",
    summary: "One session in the last four weeks.",
    wins: ["Squat up to 65kg×6", "", 42, "a", "b", "c"],
    focus: ["Train twice this week"],
    nextSession: { workout: "w1", hints: ["Squat 65kg for 3×6"] },
    actions: [{ type: "set_volume", workout: "W1", slot: 1, sets: 3, reps: 6 }],
  };
  it("bounds lists, resolves the next workout and validates actions", () => {
    const r = parseTrainerReview(raw, ctx())!;
    expect(r.status).toBe("needs_attention");
    expect(r.wins).toEqual(["Squat up to 65kg×6", "a", "b"]);
    expect(r.nextSession).toEqual({ workout: "W1", name: "Day A", hints: ["Squat 65kg for 3×6"] });
    expect(r.actions[0]).toMatchObject({ type: "set_volume", teId: "dayA-te0", sets: 3, reps: 6 });
  });
  it("drops unsafe items and rejects an unusable review", () => {
    const keep = (t: string) => !t.includes("Squat");
    expect(parseTrainerReview(raw, ctx(), keep)!.wins).toEqual(["a", "b", "c"]);
    expect(parseTrainerReview({ ...raw, headline: "" }, ctx())).toBeNull();
    expect(parseTrainerReview({ ...raw, status: "great" }, ctx())!.status).toBe("on_track");
  });
});

describe("readiness in the trainer context", () => {
  it("is training load only without a check-in", () => {
    expect(ctx().readiness).toMatchObject({ band: "ready", confidence: "low" });
  });

  it("uses today's check-in", () => {
    const poor = { id: "c", date: "2026-10-10", sleep: 1, energy: 1, soreness: 5, stress: 5, updatedAt: "2026-10-10T07:00:00Z" } as RecoveryCheckIn;
    const r = ctx([poor]).readiness!;
    expect(r).toMatchObject({ band: "low", confidence: "normal" });
    expect(r.factors).toContain("Poor sleep");
  });
});
