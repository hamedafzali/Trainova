// Nutrition targets: deterministic BMR/TDEE/macro math (Mifflin-St Jeor) with
// safety floors, plus the gate that decides whether targets are shown at all.
//
// Hand-rolled rather than left to the model so the numbers are exact and
// bounded. The calorie adjustment is never more than a moderate, documented
// step, and the floors below always win over the goal:
//   - calories: never below the estimated BMR, nor 1 500 kcal (male) /
//     1 200 kcal (female);
//   - protein: 1.8 g/kg of reference weight (body weight, capped at a BMI
//     of 27 for the user's height), at most 220 g;
//   - fat: 0.8 g/kg of reference weight, never below 0.6 g/kg or 20% of
//     calories;
//   - carbs: never below 130 g (the adult RDA); fat gives way first, then
//     calories rise to make room.
// No targets are computed for anyone under 18, while pregnant or
// breastfeeding, or with a medical condition that affects diet or a history
// of disordered eating; those users are pointed to a professional. Users can
// switch nutrition guidance off entirely.
//
// The AI layer only ever suggests meals around these fixed numbers.

import type { UserProfile } from "./types";

export const NUTRITION_LIMITS = {
  ageYears: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 250 },
} as const;

export const CALORIE_FLOOR = { male: 1500, female: 1200 } as const;
export const CARB_FLOOR_G = 130;
const PROTEIN_G_PER_KG = 1.8;
const PROTEIN_MAX_G = 220;
const FAT_G_PER_KG = 0.8;
const FAT_FLOOR_G_PER_KG = 0.6;
const FAT_FLOOR_SHARE = 0.2;
const REFERENCE_BMI = 27;
const MODERATE_DEFICIT = 300; // kcal/day below TDEE: never more aggressive than this
const MODERATE_SURPLUS = 250; // kcal/day above TDEE

export interface NutritionInput {
  sex: "male" | "female";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  /** Trained sessions per week, used as the activity multiplier. */
  sessionsPerWeek: number;
  goal: UserProfile["goal"];
}

/** A floor that changed the result, so the UI can say why. */
export type NutritionAdjustment = "calorie_floor" | "fat_reduced_for_carbs" | "calories_raised_for_carbs" | "protein_capped";

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  approach: "deficit" | "surplus" | "maintenance";
  adjustments: NutritionAdjustment[];
}

/** Health flags a user can set; any of them stops target calculation. */
export interface NutritionSettings {
  /** Nutrition guidance switched off. */
  optOut?: boolean;
  pregnancy?: boolean;
  /** A medical condition that affects diet, or a history of disordered eating. */
  medical?: boolean;
}

export type NutritionGate = "minor" | "pregnancy" | "medical";

export type NutritionPlan =
  | { status: "off" }
  | { status: "needs_stats"; invalid: (keyof typeof NUTRITION_LIMITS)[] }
  | { status: "gated"; reason: NutritionGate }
  | { status: "ok"; targets: NutritionTargets };

function activityMultiplier(sessionsPerWeek: number): number {
  if (sessionsPerWeek >= 6) return 1.725;
  if (sessionsPerWeek >= 4) return 1.55;
  if (sessionsPerWeek >= 2) return 1.375;
  return 1.2;
}

/** Targets for a validated adult input. Prefer `nutritionPlan`, which gates first. */
export function calcNutritionTargets(input: NutritionInput): NutritionTargets {
  const { sex, ageYears, heightCm, weightKg, sessionsPerWeek, goal } = input;
  const adjustments: NutritionAdjustment[] = [];
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161);
  const tdee = bmr * activityMultiplier(sessionsPerWeek);

  let target = tdee;
  if (goal === "fat_loss") target = tdee - MODERATE_DEFICIT;
  else if (goal === "hypertrophy") target = tdee + MODERATE_SURPLUS;

  const floor = Math.max(bmr, CALORIE_FLOOR[sex]);
  if (target < floor) {
    target = floor;
    adjustments.push("calorie_floor");
  }

  // Macros scale with lean-ish mass, so a heavy user isn't told to eat for their total weight.
  const refKg = Math.min(weightKg, REFERENCE_BMI * (heightCm / 100) ** 2);
  let proteinG = Math.round(refKg * PROTEIN_G_PER_KG);
  if (proteinG > PROTEIN_MAX_G) {
    proteinG = PROTEIN_MAX_G;
    adjustments.push("protein_capped");
  }

  const fatFloor = () => Math.ceil(Math.max(refKg * FAT_FLOOR_G_PER_KG, (target * FAT_FLOOR_SHARE) / 9));
  let fatG = Math.max(Math.round(refKg * FAT_G_PER_KG), fatFloor());
  const carbsLeft = () => (target - proteinG * 4 - fatG * 9) / 4;

  if (carbsLeft() < CARB_FLOOR_G) {
    const lowest = fatFloor();
    if (fatG > lowest) {
      fatG = Math.max(lowest, Math.floor(fatG - (CARB_FLOOR_G - carbsLeft()) * (4 / 9)));
      adjustments.push("fat_reduced_for_carbs");
    }
    if (carbsLeft() < CARB_FLOOR_G) {
      target = proteinG * 4 + fatG * 9 + CARB_FLOOR_G * 4;
      fatG = Math.max(fatG, fatFloor());
      target = Math.max(target, proteinG * 4 + fatG * 9 + CARB_FLOOR_G * 4);
      adjustments.push("calories_raised_for_carbs");
    }
  }

  const targetCalories = Math.round(target);
  const roundedTdee = Math.round(tdee);
  // A floor can cancel the deficit; say so rather than labelling it a cut.
  const approach: NutritionTargets["approach"] =
    targetCalories < roundedTdee ? "deficit" : targetCalories > roundedTdee && goal === "hypertrophy" ? "surplus" : "maintenance";

  return {
    bmr: Math.round(bmr),
    tdee: roundedTdee,
    targetCalories,
    proteinG,
    fatG,
    carbG: Math.max(CARB_FLOOR_G, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4)),
    approach,
    adjustments,
  };
}

const inRange = (v: unknown, r: { min: number; max: number }) =>
  typeof v === "number" && Number.isFinite(v) && v >= r.min && v <= r.max;

/**
 * Whether to show targets, and which. Order matters: an opt-out hides
 * everything, a gate stops before any number is computed, and only a full,
 * plausible adult input gets targets.
 */
export function nutritionPlan(
  body: { sex?: unknown; ageYears?: unknown; heightCm?: unknown; weightKg?: unknown },
  settings: NutritionSettings | null | undefined,
  activity: { sessionsPerWeek: number; goal: UserProfile["goal"] },
): NutritionPlan {
  if (settings?.optOut) return { status: "off" };
  if (typeof body.ageYears === "number" && body.ageYears > 0 && body.ageYears < NUTRITION_LIMITS.ageYears.min) {
    return { status: "gated", reason: "minor" };
  }
  if (settings?.pregnancy) return { status: "gated", reason: "pregnancy" };
  if (settings?.medical) return { status: "gated", reason: "medical" };

  const invalid = (Object.keys(NUTRITION_LIMITS) as (keyof typeof NUTRITION_LIMITS)[]).filter(
    (k) => !inRange(body[k], NUTRITION_LIMITS[k]),
  );
  if ((body.sex !== "male" && body.sex !== "female") || invalid.length > 0) return { status: "needs_stats", invalid };

  return {
    status: "ok",
    targets: calcNutritionTargets({
      sex: body.sex,
      ageYears: body.ageYears as number,
      heightCm: body.heightCm as number,
      weightKg: body.weightKg as number,
      sessionsPerWeek: Math.max(0, Math.min(14, Number(activity.sessionsPerWeek) || 0)),
      goal: activity.goal,
    }),
  };
}
