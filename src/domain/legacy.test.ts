import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, upgradeWeights } from "./legacy";

describe("upgradeWeights", () => {
  it("converts lb-era weights to kg once", () => {
    const out = upgradeWeights({
      units: "lb",
      sets: [{ id: "s", actualWeight: 100, targetWeight: null }],
      templates: [{ id: "t", exercises: [{ sets: [{ targetReps: 5, targetWeight: 45 }] }] }],
      prs: [
        { kind: "max_weight", value: 225 },
        { kind: "max_reps", value: 12 },
      ],
    });
    expect(out.schema).toBe(SCHEMA_VERSION);
    expect(out.sets[0].actualWeight).toBeCloseTo(45.36, 2);
    expect(out.sets[0].targetWeight).toBeNull();
    expect(out.templates[0].exercises[0].sets[0].targetWeight).toBeCloseTo(20.41, 2);
    expect(out.prs[0].value).toBeCloseTo(102.06, 2);
    expect(out.prs[1].value).toBe(12);
    // Idempotent: a second pass leaves values alone.
    expect(upgradeWeights(out).sets[0].actualWeight).toBe(out.sets[0].actualWeight);
  });

  it("leaves kg data untouched", () => {
    const out = upgradeWeights({ units: "kg", sets: [{ actualWeight: 50 }] });
    expect(out.sets[0].actualWeight).toBe(50);
  });
});
