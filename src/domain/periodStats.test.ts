import { describe, expect, it } from "vitest";
import { estimateCalories, formatMinutes, periodFor, sessionMinutes, summarisePeriod, weeklyBest } from "./periodStats";
import { estimateDuration } from "./duration";
import { tipFor } from "./exerciseTips";
import type { Exercise, WorkoutSession, WorkoutSet } from "./types";

const TODAY = new Date(2026, 5, 10); // Wed 10 Jun 2026

const session = (id: string, date: string, minutes: number, status: WorkoutSession["status"] = "completed"): WorkoutSession => ({
  id,
  owner: "u",
  templateId: null,
  title: "W",
  date,
  status,
  startedAt: `${date}T10:00:00Z`,
  completedAt: new Date(Date.parse(`${date}T10:00:00Z`) + minutes * 60000).toISOString(),
  reopenedAt: null,
  updatedAt: `${date}T12:00:00Z`,
});
const set = (sessionId: string, exerciseId: string, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `${sessionId}-${exerciseId}-${Math.random()}`,
  owner: "u",
  sessionId,
  exerciseId,
  deviceId: null,
  setIndex: 0,
  targetReps: null,
  targetWeight: null,
  actualReps: 8,
  actualWeight: 60,
  rpe: null,
  completed: true,
  completedAt: null,
  ...extra,
});
const ex = (id: string, primaryMuscle: string): Exercise => ({ id, owner: null, name: id, defaultDeviceId: null, isCompound: true, primaryMuscle });

describe("periodFor", () => {
  it("gives Monday–Sunday weeks and calendar months", () => {
    expect(periodFor("week", 0, TODAY)).toMatchObject({ from: "2026-06-08", to: "2026-06-14" });
    expect(periodFor("week", 1, TODAY)).toMatchObject({ from: "2026-06-01", to: "2026-06-07" });
    expect(periodFor("month", 0, TODAY)).toMatchObject({ from: "2026-06-01", to: "2026-06-30" });
    expect(periodFor("month", 6, TODAY)).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodFor("quarter", 0, TODAY)).toMatchObject({ from: "2026-04-01", to: "2026-06-30" });
  });
});

describe("summarisePeriod", () => {
  const sessions = [
    session("a", "2026-06-08", 60),
    session("b", "2026-06-10", 45),
    session("c", "2026-06-01", 50), // previous week
    session("d", "2026-06-09", 30, "active"),
  ];
  const sets = [
    set("a", "bench"),
    set("a", "bench"),
    set("a", "bench", { kind: "warmup" }),
    set("a", "row"),
    set("b", "squat"),
    set("b", "squat", { completed: false }),
    set("b", "run"),
    set("c", "bench"),
  ];
  const input = {
    sessions,
    sets,
    exercises: [ex("bench", "chest"), ex("row", "lats"), ex("squat", "quads"), ex("run", "cardio")],
    prs: [
      { exerciseId: "bench", kind: "e1rm" as const, value: 80, achievedAt: "2026-06-08T10:30:00Z" },
      { exerciseId: "row", kind: "e1rm" as const, value: 70, achievedAt: "2026-05-01T10:30:00Z" },
    ],
    bodyweightKg: 80,
  };

  it("counts finished workouts, time, calories and records in the period", () => {
    const s = summarisePeriod(input, periodFor("week", 0, TODAY));
    expect(s).toMatchObject({ workouts: 2, minutes: 105, calories: 700, prs: 1, workingSets: 4, bodyweightAssumed: false });
  });

  it("splits working sets by muscle group, skipping warm-ups, cardio and unfinished sets", () => {
    const s = summarisePeriod(input, periodFor("week", 0, TODAY));
    expect(s.muscles).toEqual([
      { group: "chest", label: "Chest", sets: 2, pct: 50 },
      { group: "back", label: "Back", sets: 1, pct: 25 },
      { group: "legs", label: "Legs", sets: 1, pct: 25 },
    ]);
  });

  it("folds the smallest groups into Other and keeps percentages at 100", () => {
    const many = summarisePeriod(
      {
        ...input,
        sets: ["chest", "lats", "quads", "delts", "biceps", "abs"].map((m, i) => set("a", m, { id: String(i) })),
        exercises: ["chest", "lats", "quads", "delts", "biceps", "abs"].map((m) => ex(m, m)),
      },
      periodFor("week", 0, TODAY),
      4,
    );
    expect(many.muscles).toHaveLength(4);
    expect(many.muscles[3]).toMatchObject({ group: "other", sets: 3 });
    expect(many.muscles.reduce((n, m) => n + m.pct, 0)).toBe(100);
  });

  it("assumes a default bodyweight when none is logged", () => {
    expect(summarisePeriod({ ...input, bodyweightKg: null }, periodFor("week", 0, TODAY)).bodyweightAssumed).toBe(true);
  });
});

describe("helpers", () => {
  it("estimates calories from MET, bodyweight and time", () => {
    expect(estimateCalories(60, 80)).toBe(400);
    expect(estimateCalories(30, null)).toBe(188);
  });

  it("clamps workout length and ignores unfinished sessions", () => {
    expect(sessionMinutes({ startedAt: "2026-06-01T10:00:00Z", completedAt: null })).toBe(0);
    expect(sessionMinutes({ startedAt: "2026-06-01T10:00:00Z", completedAt: "2026-06-02T10:00:00Z" })).toBe(240);
  });

  it("formats minutes as hours and minutes", () => {
    expect(formatMinutes(225)).toBe("3h 45m");
    expect(formatMinutes(50)).toBe("50m");
  });

  it("keeps the best value per week inside the window", () => {
    const h = [
      { date: "2026-05-04", value: 100 }, // outside a 5-week window
      { date: "2026-05-12", value: 105 },
      { date: "2026-05-14", value: 108 },
      { date: "2026-06-09", value: 115 },
    ];
    expect(weeklyBest(h, 5, TODAY)).toEqual([
      { week: "2026-05-11", value: 108 },
      { week: "2026-06-08", value: 115 },
    ]);
  });

  it("estimates workout length from sets and rest", () => {
    const te = (sets: number, rest: number) => ({ sets: Array.from({ length: sets }, () => ({ targetReps: 8, targetWeight: null })), restSeconds: rest });
    expect(estimateDuration({ exercises: [te(4, 90), te(3, 120), te(3, 60)] as never })).toBe(20);
    expect(estimateDuration({ exercises: [] })).toBe(5);
  });

  it("picks an exercise tip: template cue, then name, then muscle", () => {
    expect(tipFor({ name: "Bench Press", primaryMuscle: "chest" }, "Elbows at 45°")).toBe("Elbows at 45°");
    expect(tipFor({ name: "Barbell Bench Press", primaryMuscle: "chest" })).toMatch(/shoulder blades/);
    expect(tipFor({ name: "Mystery Machine", primaryMuscle: "lats" })).toMatch(/elbows/);
    expect(tipFor({ name: "Thing", primaryMuscle: null, instructions: ["Sit tall."] })).toBe("Sit tall.");
  });
});
