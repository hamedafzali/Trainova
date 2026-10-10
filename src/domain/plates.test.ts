import { describe, expect, it } from "vitest";
import { barWeight, loadPlates } from "./plates";

describe("loadPlates", () => {
  it("splits a kg load into the fewest plates per side", () => {
    expect(loadPlates(100, 20, "kg")).toMatchObject({ perSide: [25, 15], remainder: 0, belowBar: false });
    expect(loadPlates(62.5, 20, "kg").perSide).toEqual([20, 1.25]);
  });

  it("handles lb plates", () => {
    expect(loadPlates(225, 45, "lb").perSide).toEqual([45, 45]);
    expect(loadPlates(135, 45, "lb").perSide).toEqual([45]);
  });

  it("reports what plates can't make up", () => {
    const r = loadPlates(61, 20, "kg");
    expect(r.perSide).toEqual([20]);
    expect(r.remainder).toBeCloseTo(1);
  });

  it("flags an empty bar and a load below it", () => {
    expect(loadPlates(20, 20, "kg")).toMatchObject({ perSide: [], remainder: 0, belowBar: false });
    expect(loadPlates(15, 20, "kg").belowBar).toBe(true);
  });
});

describe("barWeight", () => {
  it("knows bar types and ignores the rest", () => {
    expect(barWeight("barbell", "kg")).toBe(20);
    expect(barWeight("ez_bar", "lb")).toBe(25);
    expect(barWeight("dumbbell", "kg")).toBeNull();
    expect(barWeight(null, "kg")).toBeNull();
  });
});
