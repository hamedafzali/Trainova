import { describe, expect, it } from "vitest";
import { bestWeight, calcSetVolume, totalVolume } from "./volume";

describe("calcSetVolume", () => {
  it("multiplies weight by reps when both are logged", () => {
    expect(calcSetVolume({ actualWeight: 50, actualReps: 12 })).toBe(600);
  });

  it("is 0 when weight is logged but reps are null", () => {
    // Regression: this is the exact shape of the seeded 2026-06-16 session
    // before the fix — weight logged, reps never recorded.
    expect(calcSetVolume({ actualWeight: 50, actualReps: null })).toBe(0);
  });

  it("is 0 when weight is null, regardless of reps", () => {
    expect(calcSetVolume({ actualWeight: null, actualReps: 12 })).toBe(0);
  });

  it("is 0 when both are null", () => {
    expect(calcSetVolume({ actualWeight: null, actualReps: null })).toBe(0);
  });
});

describe("totalVolume", () => {
  it("sums volume across sets, treating weight-without-reps as 0 not a crash", () => {
    const sets = [
      { actualWeight: 50, actualReps: 12 },
      { actualWeight: 27.5, actualReps: null },
      { actualWeight: null, actualReps: null },
    ];
    expect(totalVolume(sets)).toBe(600);
  });

  it("is 0 for an empty list", () => {
    expect(totalVolume([])).toBe(0);
  });
});

describe("bestWeight", () => {
  it("returns the heaviest logged weight", () => {
    const sets = [{ actualWeight: 27.5 }, { actualWeight: 50 }, { actualWeight: 35 }];
    expect(bestWeight(sets)).toBe(50);
  });

  it("ignores sets with no weight logged", () => {
    const sets = [{ actualWeight: null }, { actualWeight: 22.5 }];
    expect(bestWeight(sets)).toBe(22.5);
  });

  it("is 0 when no set has a logged weight", () => {
    expect(bestWeight([{ actualWeight: null }])).toBe(0);
  });
});
