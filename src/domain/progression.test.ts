import { describe, expect, it } from "vitest";
import {
  detectPrs,
  replayPrs,
  epley1rm,
  loadIncrement,
  roundToIncrement,
  suggestNextLoad,
  type LastPerformance,
} from "./progression";

describe("epley1rm", () => {
  it("returns the weight for a single", () => {
    expect(epley1rm(100, 1)).toBe(100);
  });
  it("estimates above the working weight for multiple reps", () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.67, 1);
  });
  it("is zero for nonsense input", () => {
    expect(epley1rm(0, 5)).toBe(0);
  });
});

describe("roundToIncrement", () => {
  it("rounds to 2.5 in kg", () => {
    expect(roundToIncrement(101, "kg")).toBe(100);
    expect(roundToIncrement(101.5, "kg")).toBe(102.5);
  });
  it("rounds to 5 in lb", () => {
    expect(roundToIncrement(133, "lb")).toBe(135);
  });
  it("rounds to a custom step without float drift", () => {
    expect(roundToIncrement(41.3, "kg", 1.25)).toBe(41.25);
  });
});

const hit = (weight: number, reps: number, rpe = 8): LastPerformance["sets"][number] => ({
  actualWeight: weight,
  actualReps: reps,
  rpe,
  completed: true,
});

describe("suggestNextLoad", () => {
  it("starts from template when no history", () => {
    const s = suggestNextLoad(null, "kg", { isCompound: true, templateWeight: 60 });
    expect(s.action).toBe("start");
    expect(s.weight).toBe(60);
  });

  it("increases a full plate for a compound that hit all reps", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 5), hit(100, 5), hit(100, 5)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true });
    expect(s.action).toBe("increase");
    expect(s.weight).toBe(105); // +2.5*2
  });

  it("increases a single step for an isolation", () => {
    const last: LastPerformance = { targetReps: 12, sets: [hit(20, 12), hit(20, 12)] };
    const s = suggestNextLoad(last, "kg", { isCompound: false });
    expect(s.weight).toBe(22.5); // +2.5
  });

  it("holds when reps hit but RPE was maximal", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 5, 9.5)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true });
    expect(s.action).toBe("hold");
    expect(s.weight).toBe(100);
  });

  it("holds on a first missed session", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 5), hit(100, 3)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true, missStreak: 0 });
    expect(s.action).toBe("hold");
  });

  it("holds when only the last session missed (the streak includes it)", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 3)] };
    expect(suggestNextLoad(last, "kg", { isCompound: true, missStreak: 1 }).action).toBe("hold");
  });

  it("deloads 10% after two missed sessions running", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 3)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true, missStreak: 2 });
    expect(s.action).toBe("deload");
    expect(s.weight).toBe(90);
  });

  it("treats a missing RPE as unknown: smallest jump, low confidence", () => {
    const noRpe = { actualWeight: 100, actualReps: 5, rpe: null, completed: true };
    const s = suggestNextLoad({ targetReps: 5, sets: [noRpe, noRpe] }, "kg", { isCompound: true });
    expect(s.action).toBe("increase");
    expect(s.weight).toBe(102.5);
    expect(s.confidence).toBe("low");
    expect(s.reason).toMatch(/RPE/);
  });

  it("adds reps before load inside a rep range", () => {
    const last: LastPerformance = { targetReps: 8, sets: [hit(60, 10), hit(60, 9)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true, repRange: { min: 8, max: 12 } });
    expect(s).toMatchObject({ action: "add_reps", weight: 60, reps: 10 });
  });

  it("adds load and resets reps once every set reaches the top of the range", () => {
    const last: LastPerformance = { targetReps: 8, sets: [hit(60, 12), hit(60, 12)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true, repRange: { min: 8, max: 12 } });
    expect(s).toMatchObject({ action: "increase", weight: 65, reps: 8 });
  });

  it("judges the sets at the working load, not lighter back-off sets", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 5), hit(100, 5), hit(80, 3)] };
    expect(suggestNextLoad(last, "kg", { isCompound: true }).action).toBe("increase");
  });

  it("uses the stack's plate on selectorized machines", () => {
    const last: LastPerformance = { targetReps: 10, sets: [hit(45, 10)] };
    expect(suggestNextLoad(last, "kg", { isCompound: false, loading: "stack" }).weight).toBe(50);
    expect(suggestNextLoad(last, "lb", { isCompound: false, loading: "stack" }).weight).toBe(55);
  });

  it("respects an explicit increment (e.g. 1 kg microplates)", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(40, 5)] };
    expect(suggestNextLoad(last, "kg", { isCompound: true, increment: 1 }).weight).toBe(41);
  });

  it("holds when any working set was near-maximal even if others weren't", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 5, 8), hit(100, 5, 10)] };
    expect(suggestNextLoad(last, "kg", { isCompound: true }).action).toBe("hold");
  });
});

describe("loadIncrement", () => {
  it("scales with equipment and unit", () => {
    expect(loadIncrement("kg", { isCompound: true })).toBe(5);
    expect(loadIncrement("kg", { isCompound: false })).toBe(2.5);
    expect(loadIncrement("lb", { loading: "stack" })).toBe(10);
    expect(loadIncrement("lb", { loading: "dumbbell", isCompound: true })).toBe(5);
  });
});

describe("detectPrs", () => {
  it("flags new bests", () => {
    const prs = detectPrs(
      { actualReps: 5, actualWeight: 100 },
      { e1rm: 100, maxWeight: 95, maxReps: 4 }
    );
    expect(prs.map((p) => p.kind).sort()).toEqual(["e1rm", "max_reps", "max_weight"]);
  });
  it("flags nothing when below bests", () => {
    const prs = detectPrs(
      { actualReps: 3, actualWeight: 80 },
      { e1rm: 200, maxWeight: 150, maxReps: 10 }
    );
    expect(prs).toEqual([]);
  });
  it("flags a rep PR for bodyweight sets", () => {
    const prs = detectPrs({ actualReps: 12, actualWeight: null }, { e1rm: 0, maxWeight: 0, maxReps: 10 });
    expect(prs).toEqual([{ kind: "max_reps", value: 12 }]);
  });
  it("never flags a load PR for assisted exercises", () => {
    const prs = detectPrs(
      { actualReps: 8, actualWeight: 40 },
      { e1rm: 10, maxWeight: 20, maxReps: 8 },
      { assisted: true }
    );
    expect(prs).toEqual([]);
  });
});

describe("replayPrs", () => {
  const at = (h: number) => `2026-10-${String(10 + h).padStart(2, "0")}T10:00:00.000Z`;
  it("drops a record that only existed because of a typo", () => {
    const sets = [
      { actualWeight: 30, actualReps: 8, completedAt: at(0) },
      { actualWeight: 35, actualReps: 8, completedAt: at(1) }, // was logged as 350, now corrected
    ];
    const prs = replayPrs(sets);
    expect(prs.find((p) => p.kind === "max_weight")).toMatchObject({ value: 35, achievedAt: at(1) });
  });

  it("keeps the earliest set that reached the best, in completion order", () => {
    const prs = replayPrs([
      { actualWeight: 40, actualReps: 5, completedAt: at(2) },
      { actualWeight: 40, actualReps: 5, completedAt: at(1) },
    ]);
    expect(prs.find((p) => p.kind === "max_weight")?.achievedAt).toBe(at(1));
  });

  it("returns nothing when no sets remain", () => {
    expect(replayPrs([])).toEqual([]);
  });
});
