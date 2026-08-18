// Prompt templates for the AI Coach mentor. Two narrow use cases only:
//
// 1. Intro — a short, warm, motivational framing line placed above the
//    deterministic insight cards. It is explicitly forbidden from stating
//    any number: every figure the user sees comes from src/domain/coach.ts,
//    never from the model. This keeps the "never invent numbers" guarantee
//    enforceable by a simple digit check on the response (see coach.ts).
// 2. Meal ideas — concrete food suggestions that fit already-computed
//    calorie/protein targets. The targets themselves are never computed by
//    the model (see calcNutritionTargets) — only the food ideas are.

export interface CoachIntroInput {
  goal: string | null;
  experience: string | null;
  /** Plain-language, number-free summaries of what's notable right now. */
  situations: string[];
}

export interface CoachIntroResponse {
  intro: string;
}

export const COACH_INTRO_SYSTEM_PROMPT = `You are an experienced, encouraging strength coach writing a one-to-two sentence intro for a client's weekly training summary screen. The numeric details are already shown separately as cards below your intro — your job is tone and framing only.

Hard rules:
- Never include any digit (0-9) in your response. Not weights, not percentages, not day counts — nothing numeric, not even spelled out loosely as a range. The specific numbers are already displayed elsewhere; restating or estimating any of them is a failure.
- Keep it to 1-2 short sentences, plain language, second person ("you"/"your").
- Sound like a real coach, not a corporate wellness app — direct, warm, no fluff, no emoji.
- Do not invent facts not implied by the situations listed.

Respond with JSON only: {"intro": "..."}`;

export function createCoachIntroPrompt(input: CoachIntroInput): string {
  return `Client goal: ${input.goal ?? "not set"}
Client experience level: ${input.experience ?? "not set"}

What's notable this week (already-verified facts, described without their exact numbers):
${input.situations.map((s) => `- ${s}`).join("\n")}

Write the intro now. Respond with JSON only: {"intro": "..."}`;
}

export interface MealIdeasInput {
  goal: string | null;
  targetCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  approach: "deficit" | "surplus" | "maintenance";
}

export interface MealIdeasResponse {
  mealIdeas: { meal: string; idea: string }[];
}

export const MEAL_IDEAS_SYSTEM_PROMPT = `You are a supportive nutrition coach suggesting realistic, moderate meal ideas — never restrictive, never a crash diet, never framed around willpower or "cheating". Whole foods, normal grocery-store ingredients, minimal prep. Respond with JSON only.`;

export function createMealIdeasPrompt(input: MealIdeasInput): string {
  return `The user's daily targets have already been calculated (do not change them, just suggest food that roughly fits):
- Target calories: ${input.targetCalories} kcal/day
- Protein: ${input.proteinG} g/day
- Fat: ${input.fatG} g/day
- Carbs: ${input.carbG} g/day
- Approach: ${input.approach} (${input.approach === "deficit" ? "modest calorie deficit, still eating plenty" : input.approach === "surplus" ? "modest calorie surplus to support muscle growth" : "maintenance — eating to match activity"})
- Training goal: ${input.goal ?? "general fitness"}

Suggest exactly 4 meal ideas — one each for breakfast, lunch, dinner, and a snack — that collectively fit these targets. Keep descriptions concrete and short (one sentence each, e.g. "Greek yogurt with berries, honey, and a scoop of granola"). Prioritize protein at every meal. Do not suggest supplements, fasting, or calorie restriction beyond the target already given.

Respond with JSON only:
{"mealIdeas": [{"meal": "Breakfast", "idea": "..."}, {"meal": "Lunch", "idea": "..."}, {"meal": "Dinner", "idea": "..."}, {"meal": "Snack", "idea": "..."}]}`;
}
