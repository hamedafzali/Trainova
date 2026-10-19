import { describe, expect, it } from "vitest";
import {
  consecutiveTrainingDays,
  hoursUntilReady,
  MAP_MUSCLES,
  muscleReadiness,
  musclesWorked,
  readinessEstimate,
  readinessOf,
  sessionMuscleLoad,
} from "./recovery";
import type { Exercise, WorkoutSession, WorkoutSet } from "./types";

const bench: Exercise = {
  id: "bench",
  owner: null,
  name: "Bench Press",
  defaultDeviceId: null,
  isCompound: true,
  primaryMuscle: "chest",
  secondaryMuscles: ["triceps", "shoulders"],
};
const burpee: Exercise = { ...bench, id: "burpee", primaryMuscle: "full body", secondaryMuscles: [] };
const byId = (id: string) => [bench, burpee].find((e) => e.id === id);

const now = new Date("2026-10-10T18:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const session = (id: string, status: WorkoutSession["status"] = "completed") =>
  ({ id, status }) as WorkoutSession;
const set = (over: Partial<WorkoutSet>): WorkoutSet =>
  ({ sessionId: "s1", exerciseId: "bench", completed: true, completedAt: hoursAgo(2), ...over }) as WorkoutSet;

describe("muscleReadiness", () => {
  it("marks muscles from a hard recent session as recovering and secondaries as worked", () => {
    const sets = Array.from({ length: 6 }, () => set({}));
    const r = muscleReadiness([session("s1")], sets, byId, now);
    expect(r.get("chest")?.readiness).toBe("recovering");
    expect(r.get("triceps")?.readiness).toBe("worked");
    expect(r.get("quads")?.readiness).toBe("fresh");
    expect(r.get("chest")?.lastTrained).toBe(hoursAgo(2));
  });

  it("lets load fade over days", () => {
    const sets = Array.from({ length: 6 }, () => set({ completedAt: hoursAgo(60) }));
    expect(muscleReadiness([session("s1")], sets, byId, now).get("chest")?.readiness).toBe("light");
  });

  it("ignores warm-ups, open sets, archived sessions and anything older than a week", () => {
    const sets = [
      set({ kind: "warmup" }),
      set({ completed: false }),
      set({ sessionId: "old" }),
      set({ completedAt: hoursAgo(200) }),
    ];
    const r = muscleReadiness([session("s1"), session("old", "archived")], sets, byId, now);
    expect(r.get("chest")?.load).toBe(0);
  });
});

describe("musclesWorked", () => {
  it("spreads full-body exercises over the big muscles", () => {
    const m = musclesWorked(burpee);
    expect(m.find((x) => x.muscle === "quads")?.share).toBe(0.5);
    expect(m.length).toBeGreaterThan(4);
  });
});

describe("sessionMuscleLoad", () => {
  it("counts working sets per muscle", () => {
    const load = sessionMuscleLoad([set({}), set({}), set({ kind: "warmup" })], byId);
    expect(load.get("chest")).toBe(2);
    expect(load.get("triceps")).toBe(1);
  });
});

it("readinessOf thresholds", () => {
  expect([0, 0.6, 2.5, 5].map(readinessOf)).toEqual(["fresh", "light", "worked", "recovering"]);
});

it("hoursUntilReady counts down to the worked threshold", () => {
  expect(hoursUntilReady(1)).toBe(0);
  expect(hoursUntilReady(4)).toBe(25);
});

describe("readinessEstimate", () => {
  const today = "2026-08-20";
  const now = new Date("2026-08-20T09:00:00Z");
  const fresh = new Map(MAP_MUSCLES.map((m) => [m, { muscle: m, load: 0, readiness: "fresh" as const, lastTrained: null }]));
  const base = { checkIn: null, feedback: [], trainedDates: [], muscles: fresh, today, now };

  it("is a low-confidence estimate without a check-in", () => {
    const r = readinessEstimate(base);
    expect(r.confidence).toBe("low");
    expect(r.band).toBe("ready");
  });

  it("drops with a poor check-in and lists why", () => {
    const r = readinessEstimate({ ...base, checkIn: { sleep: 1, energy: 1, soreness: 5, stress: 5 } });
    expect(r.band).toBe("low");
    expect(r.confidence).toBe("normal");
    expect(r.factors.map((f) => f.key)).toEqual(expect.arrayContaining(["sleep", "energy", "soreness", "stress"]));
  });

  it("counts consecutive training days and a hard last session", () => {
    expect(consecutiveTrainingDays(["2026-08-17", "2026-08-18", "2026-08-19"], today)).toBe(3);
    const r = readinessEstimate({
      ...base,
      checkIn: { sleep: 3, energy: 3, soreness: 3, stress: 3 },
      trainedDates: ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"],
      feedback: [{ difficulty: "hard", energy: 2, pain: null, createdAt: "2026-08-19T18:00:00Z" }],
    });
    expect(r.factors.map((f) => f.key)).toEqual(expect.arrayContaining(["streak", "hard_session"]));
    expect(r.band).not.toBe("ready");
  });

  it("never says 'train as planned' after reported pain", () => {
    const r = readinessEstimate({
      ...base,
      checkIn: { sleep: 5, energy: 5, soreness: 1, stress: 1 },
      feedback: [{ difficulty: "right", energy: 4, pain: "left knee", createdAt: "2026-08-18T18:00:00Z" }],
    });
    expect(r.painReported).toBe(true);
    expect(r.band).toBe("moderate");
  });
});
