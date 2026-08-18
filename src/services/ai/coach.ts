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

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import { performSafetyCheck } from "./safety";
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
  try {
    const client = getMistralClient();
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.COACHING,
      messages: [
        { role: "system", content: COACH_INTRO_SYSTEM_PROMPT },
        { role: "user", content: createCoachIntroPrompt(input) },
      ],
      temperature: 0.6,
      maxTokens: 150,
    });
    const text = extractContentText(response.choices?.[0]?.message?.content);
    if (!text) return null;

    const parsed = extractJson(text) as { intro?: unknown };
    const intro = typeof parsed.intro === "string" ? parsed.intro.trim() : "";
    if (!intro) return null;

    // Guardrail: reject any response containing a digit — the intro must
    // never state a number, since numbers are only ever trustworthy when
    // they come straight from src/domain/coach.ts.
    if (/\d/.test(intro)) return null;

    const safety = performSafetyCheck(intro);
    if (!safety.isSafe) return null;

    return intro;
  } catch {
    return null;
  }
}

/**
 * Meal ideas fit to already-computed macro targets. Always resolves — falls
 * back to a small static library by goal if the model call fails, times
 * out, or returns something that doesn't validate.
 */
export async function getMealIdeas(input: MealIdeasInput): Promise<MealIdeasResponse> {
  try {
    const client = getMistralClient();
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.COACHING,
      messages: [
        { role: "system", content: MEAL_IDEAS_SYSTEM_PROMPT },
        { role: "user", content: createMealIdeasPrompt(input) },
      ],
      temperature: 0.7,
      maxTokens: 400,
    });
    const text = extractContentText(response.choices?.[0]?.message?.content);
    if (!text) return staticMealIdeas(input.goal);

    const parsed = extractJson(text) as MealIdeasResponse;
    if (!Array.isArray(parsed.mealIdeas) || parsed.mealIdeas.length === 0) {
      return staticMealIdeas(input.goal);
    }
    const clean = parsed.mealIdeas
      .filter(
        (m): m is { meal: string; idea: string } =>
          typeof m?.meal === "string" && typeof m?.idea === "string" && m.idea.trim().length > 0
      )
      .slice(0, 6);
    if (clean.length === 0) return staticMealIdeas(input.goal);

    const safety = performSafetyCheck(clean.map((m) => m.idea).join(" "));
    if (!safety.isSafe) return staticMealIdeas(input.goal);

    return { mealIdeas: clean };
  } catch {
    return staticMealIdeas(input.goal);
  }
}
