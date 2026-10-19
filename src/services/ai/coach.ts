// AI Coach mentor service — two narrow AI calls layered on top of the
// deterministic math in src/domain/coach.ts:
//   1. getCoachIntro   — a short, number-free motivational framing line.
//   2. getMealIdeas    — concrete food ideas fit to already-computed macros.
//
// Neither call is allowed to originate a number the user relies on. Every
// figure shown in the Coach UI comes from src/domain/coach.ts; the model
// only ever adds tone (intro) or non-numeric content (food ideas). Both
// functions fail closed: any error, timeout, or guardrail violation returns
// a safe fallback rather than throwing, so an AI outage never breaks the
// Coach screen — callers can render the fallback exactly like a real result.

import { chatComplete } from "./mistralClient";
import { performSafetyCheck } from "./safety";
import { currentRun, notePromptVersion, noteRejected } from "./runMeter";
import { promptVersion } from "./tasks";
import { nutritionPlan, type NutritionPlan, type NutritionSettings } from "@/domain/nutrition";
import {
  createCoachIntroPrompt,
  createMealIdeasPrompt,
  COACH_INTRO_SYSTEM_PROMPT,
  MEAL_IDEAS_SYSTEM_PROMPT,
  type CoachIntroInput,
  type MealIdeasInput,
  type MealIdeasResponse,
} from "./prompts/coach";

export class CoachError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "CoachError";
  }
}

function extractContentText(content: string | unknown[] | null | undefined): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: string; text: string } => (c as any)?.type === "text")
      .map((c) => c.text)
      .join("");
  }
  return "";
}

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = fenced ? fenced[1] : (content.match(/\{[\s\S]*\}/)?.[0] ?? content);
  return JSON.parse(jsonStr);
}

const STATIC_MEAL_IDEAS: Record<string, { meal: string; idea: string }[]> = {
  fat_loss: [
    { meal: "Breakfast", idea: "Greek yogurt with berries and a drizzle of honey" },
    { meal: "Lunch", idea: "Grilled chicken salad with olive oil dressing and a whole-grain roll" },
    { meal: "Dinner", idea: "Baked salmon, roasted vegetables, and a small portion of rice" },
    { meal: "Snack", idea: "A handful of almonds and an apple" },
  ],
  hypertrophy: [
    { meal: "Breakfast", idea: "Oats with milk, banana, peanut butter, and a scoop of whey" },
    { meal: "Lunch", idea: "Beef or turkey burrito bowl with rice, beans, and cheese" },
    { meal: "Dinner", idea: "Pasta with ground turkey, marinara, and a side salad" },
    { meal: "Snack", idea: "Cottage cheese with pineapple, or a protein shake with a bagel" },
  ],
  default: [
    { meal: "Breakfast", idea: "Eggs, whole-grain toast, and avocado" },
    { meal: "Lunch", idea: "Chicken or tofu stir-fry with vegetables and rice" },
    { meal: "Dinner", idea: "Lean protein, a starch (potato/rice/pasta), and vegetables" },
    { meal: "Snack", idea: "Greek yogurt or a piece of fruit with nut butter" },
  ],
};

/**
 * Meal-idea input rebuilt on the server from the body stats the client sent,
 * through the same floors and gates as the app. Targets the client computed
 * are never trusted. Health flags and the opt-out are honoured from either
 * the request or the synced profile, whichever is stricter.
 */
export function mealIdeasInputFor(
  data: unknown,
  synced: NutritionSettings | null | undefined,
): { ok: true; input: MealIdeasInput } | { ok: false; status: Exclude<NutritionPlan["status"], "ok"> } {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const sent = (d.nutrition && typeof d.nutrition === "object" ? d.nutrition : {}) as NutritionSettings;
  const settings: NutritionSettings = {
    optOut: sent.optOut === true || synced?.optOut === true,
    pregnancy: sent.pregnancy === true || synced?.pregnancy === true,
    medical: sent.medical === true || synced?.medical === true,
  };
  const goals = ["strength", "hypertrophy", "fat_loss", "health"] as const;
  const goal = goals.find((g) => g === d.goal) ?? null;
  const plan = nutritionPlan(d, settings, { sessionsPerWeek: Number(d.sessionsPerWeek) || 0, goal });
  if (plan.status !== "ok") return { ok: false, status: plan.status };
  const t = plan.targets;
  return {
    ok: true,
    input: { goal, targetCalories: t.targetCalories, proteinG: t.proteinG, fatG: t.fatG, carbG: t.carbG, approach: t.approach },
  };
}

export function staticMealIdeas(goal: string | null): MealIdeasResponse {
  return { mealIdeas: STATIC_MEAL_IDEAS[goal ?? "default"] ?? STATIC_MEAL_IDEAS.default };
}

/**
 * Short, number-free motivational intro. Returns `null` (not a throw) on
 * any failure or guardrail violation — callers render the insight cards
 * without an intro in that case, which is a fully valid, complete UI.
 */
export async function getCoachIntro(input: CoachIntroInput): Promise<string | null> {
  if (input.situations.length === 0) return null;
  notePromptVersion(promptVersion("coach.intro", COACH_INTRO_SYSTEM_PROMPT));
  const reject = (code: string) => {
    noteRejected(code);
    return null;
  };
  try {
    const response = await chatComplete({
      messages: [
        { role: "system", content: COACH_INTRO_SYSTEM_PROMPT },
        { role: "user", content: createCoachIntroPrompt(input) },
      ],
      temperature: 0.6,
      maxTokens: 150,
    });
    const text = extractContentText(response.choices?.[0]?.message?.content);
    if (!text) return reject("BAD_OUTPUT");

    const parsed = extractJson(text) as { intro?: unknown };
    const intro = typeof parsed.intro === "string" ? parsed.intro.trim() : "";
    if (!intro) return reject("BAD_OUTPUT");

    // Guardrail: reject any response containing a digit — the intro must
    // never state a number, since numbers are only ever trustworthy when
    // they come straight from src/domain/coach.ts.
    if (/\d/.test(intro)) return reject("INVALID");

    const safety = performSafetyCheck(intro);
    if (!safety.isSafe) return reject("UNSAFE");

    return intro;
  } catch {
    // An outage is already on the run; anything else here is an unparseable reply.
    if (!currentRun()?.errorCode) noteRejected("BAD_OUTPUT");
    return null;
  }
}

/**
 * Meal ideas fit to already-computed macro targets. Always resolves — falls
 * back to a small static library by goal if the model call fails, times
 * out, or returns something that doesn't validate.
 */
export async function getMealIdeas(input: MealIdeasInput): Promise<MealIdeasResponse> {
  notePromptVersion(promptVersion("coach.meals", MEAL_IDEAS_SYSTEM_PROMPT));
  const reject = (code: string) => {
    noteRejected(code);
    return staticMealIdeas(input.goal);
  };
  try {
    const response = await chatComplete({
      messages: [
        { role: "system", content: MEAL_IDEAS_SYSTEM_PROMPT },
        { role: "user", content: createMealIdeasPrompt(input) },
      ],
      temperature: 0.7,
      maxTokens: 400,
    });
    const text = extractContentText(response.choices?.[0]?.message?.content);
    if (!text) return reject("BAD_OUTPUT");

    const parsed = extractJson(text) as MealIdeasResponse;
    if (!Array.isArray(parsed.mealIdeas) || parsed.mealIdeas.length === 0) return reject("BAD_OUTPUT");
    const clean = parsed.mealIdeas
      .filter(
        (m): m is { meal: string; idea: string } =>
          typeof m?.meal === "string" && typeof m?.idea === "string" && m.idea.trim().length > 0
      )
      .slice(0, 6);
    if (clean.length === 0) return reject("INVALID");

    const safety = performSafetyCheck(clean.map((m) => m.idea).join(" "));
    if (!safety.isSafe) return reject("UNSAFE");

    return { mealIdeas: clean };
  } catch {
    if (!currentRun()?.errorCode) noteRejected("BAD_OUTPUT");
    return staticMealIdeas(input.goal);
  }
}
