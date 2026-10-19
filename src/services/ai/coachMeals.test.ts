import { describe, expect, it } from "vitest";
import { mealIdeasInputFor } from "./coach";

const adult = { goal: "fat_loss", sex: "male", ageYears: 30, heightCm: 180, weightKg: 80, sessionsPerWeek: 3 };

describe("mealIdeasInputFor", () => {
  it("recomputes targets from body stats and ignores any targets the client sends", () => {
    const built = mealIdeasInputFor({ ...adult, targetCalories: 800, proteinG: 400 }, null);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.targetCalories).toBeGreaterThanOrEqual(1500);
    expect(built.input.proteinG).toBeLessThanOrEqual(220);
    expect(built.input.carbG).toBeGreaterThanOrEqual(130);
    expect(built.input.goal).toBe("fat_loss");
  });

  it("never reaches the model for minors, pregnancy, medical flags or opt-out", () => {
    expect(mealIdeasInputFor({ ...adult, ageYears: 16 }, null)).toEqual({ ok: false, status: "gated" });
    expect(mealIdeasInputFor({ ...adult, nutrition: { pregnancy: true } }, null)).toEqual({ ok: false, status: "gated" });
    expect(mealIdeasInputFor({ ...adult, nutrition: { medical: true } }, null)).toEqual({ ok: false, status: "gated" });
    expect(mealIdeasInputFor({ ...adult, nutrition: { optOut: true } }, null)).toEqual({ ok: false, status: "off" });
  });

  it("takes the stricter of the client and synced flags", () => {
    // A client that clears its flags can't override what the synced profile says.
    expect(mealIdeasInputFor({ ...adult, nutrition: { pregnancy: false } }, { pregnancy: true })).toEqual({ ok: false, status: "gated" });
    expect(mealIdeasInputFor({ ...adult, nutrition: {} }, { optOut: true })).toEqual({ ok: false, status: "off" });
  });

  it("asks for stats when they are missing or implausible, and drops an unknown goal", () => {
    expect(mealIdeasInputFor({ goal: "fat_loss" }, null)).toEqual({ ok: false, status: "needs_stats" });
    expect(mealIdeasInputFor({ ...adult, heightCm: 40 }, null)).toEqual({ ok: false, status: "needs_stats" });
    expect(mealIdeasInputFor(null, null)).toEqual({ ok: false, status: "needs_stats" });
    const built = mealIdeasInputFor({ ...adult, goal: "starve" }, null);
    expect(built.ok && built.input.goal).toBe(null);
  });
});
