import { describe, expect, it } from "vitest";
import {
  detectPrs,
  epley1rm,
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

  it("deloads 10% after repeated misses", () => {
    const last: LastPerformance = { targetReps: 5, sets: [hit(100, 3)] };
    const s = suggestNextLoad(last, "kg", { isCompound: true, missStreak: 1 });
    expect(s.action).toBe("deload");
    expect(s.weight).toBe(90);
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
});
