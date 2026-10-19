import { describe, expect, it } from "vitest";
import { CALORIE_FLOOR, CARB_FLOOR_G, calcNutritionTargets, nutritionPlan, type NutritionInput } from "./nutrition";

const adult: NutritionInput = { sex: "male", ageYears: 30, heightCm: 180, weightKg: 80, sessionsPerWeek: 4, goal: "fat_loss" };
const activity = { sessionsPerWeek: 3, goal: "fat_loss" as const };
const kcal = (t: { proteinG: number; fatG: number; carbG: number }) => t.proteinG * 4 + t.fatG * 9 + t.carbG * 4;

describe("calcNutritionTargets floors", () => {
  it("keeps a typical adult on the moderate deficit with no adjustments", () => {
    const t = calcNutritionTargets(adult);
    expect(t.approach).toBe("deficit");
    expect(t.tdee - t.targetCalories).toBe(300);
    expect(t.adjustments).toEqual([]);
  });

  it("never goes below the sex-specific calorie floor or BMR", () => {
    const small = calcNutritionTargets({ sex: "female", ageYears: 60, heightCm: 150, weightKg: 45, sessionsPerWeek: 0, goal: "fat_loss" });
    expect(small.targetCalories).toBeGreaterThanOrEqual(CALORIE_FLOOR.female);
    expect(small.targetCalories).toBeGreaterThanOrEqual(small.bmr);
    expect(small.adjustments).toContain("calorie_floor");
    // The floor cancels the cut, so it isn't labelled a deficit.
    expect(small.approach).not.toBe("deficit");
  });

  it("holds the carb floor, trimming fat first", () => {
    const t = calcNutritionTargets({ sex: "female", ageYears: 30, heightCm: 160, weightKg: 50, sessionsPerWeek: 1, goal: "fat_loss" });
    expect(t.carbG).toBeGreaterThanOrEqual(CARB_FLOOR_G);
    expect(t.fatG).toBeGreaterThanOrEqual(Math.ceil(50 * 0.6));
    expect(t.fatG * 9).toBeGreaterThanOrEqual(t.targetCalories * 0.2 - 9);
    expect(Math.abs(kcal(t) - t.targetCalories)).toBeLessThanOrEqual(20);
  });

  it("raises calories rather than break the carb or fat floor for a heavy, low-calorie case", () => {
    const t = calcNutritionTargets({ sex: "female", ageYears: 70, heightCm: 150, weightKg: 110, sessionsPerWeek: 0, goal: "fat_loss" });
    expect(t.carbG).toBeGreaterThanOrEqual(CARB_FLOOR_G);
    expect(t.fatG).toBeGreaterThanOrEqual(Math.ceil(27 * 1.5 ** 2 * 0.6));
    expect(kcal(t)).toBeLessThanOrEqual(t.targetCalories + 20);
  });

  it("scales protein with a reference weight, not total weight, for high BMI", () => {
    const t = calcNutritionTargets({ sex: "female", ageYears: 40, heightCm: 150, weightKg: 110, sessionsPerWeek: 2, goal: "health" });
    expect(t.proteinG).toBe(Math.round(27 * 1.5 ** 2 * 1.8));
  });

  it("caps protein for very heavy users", () => {
    const t = calcNutritionTargets({ ...adult, weightKg: 160, heightCm: 230 });
    expect(t.proteinG).toBe(220);
    expect(t.adjustments).toContain("protein_capped");
  });
});

describe("nutritionPlan gate", () => {
  const body = { sex: "male", ageYears: 30, heightCm: 180, weightKg: 80 };

  it("returns targets for a valid adult", () => {
    const plan = nutritionPlan(body, null, activity);
    expect(plan.status).toBe("ok");
  });

  it("never computes targets for minors", () => {
    expect(nutritionPlan({ ...body, ageYears: 16 }, null, activity)).toEqual({ status: "gated", reason: "minor" });
  });

  it("stops for pregnancy/breastfeeding and medical flags", () => {
    expect(nutritionPlan(body, { pregnancy: true }, activity)).toEqual({ status: "gated", reason: "pregnancy" });
    expect(nutritionPlan(body, { medical: true }, activity)).toEqual({ status: "gated", reason: "medical" });
  });

  it("opt-out wins over everything", () => {
    expect(nutritionPlan({ ...body, ageYears: 15 }, { optOut: true, pregnancy: true }, activity)).toEqual({ status: "off" });
  });

  it("asks for stats when they're missing or implausible", () => {
    expect(nutritionPlan({}, null, activity).status).toBe("needs_stats");
    const plan = nutritionPlan({ ...body, heightCm: 40, weightKg: 900 }, null, activity);
    expect(plan).toEqual({ status: "needs_stats", invalid: ["heightCm", "weightKg"] });
    expect(nutritionPlan({ ...body, sex: "other" }, null, activity).status).toBe("needs_stats");
  });
});
