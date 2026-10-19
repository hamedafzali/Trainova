// The AI tasks Trainova runs and how each is routed.
//
// "deep" tasks read a whole training history and write the longer answers,
// so they start on the largest model the key may use. "fast" tasks sit on a
// hot path (the live workout sheet, the one-line coach intro) and start on a
// small model so they stay quick and cheap. Either way chatComplete falls back
// down/up the list when a model is denied or rate limited.
//
// The prompt version is a short hash of the task's system prompt, so a prompt
// edit shows up as a new version in ai_runs without anyone bumping a number.

export type AiTier = "deep" | "fast";

export type AiTask = "analyst" | "trainer.chat" | "trainer.review" | "exercise_coach" | "coach.intro" | "coach.meals";

export const AI_TASKS: Record<AiTask, { capability: string; tier: AiTier }> = {
  analyst: { capability: "analyst", tier: "deep" },
  "trainer.chat": { capability: "trainer", tier: "deep" },
  "trainer.review": { capability: "trainer", tier: "deep" },
  exercise_coach: { capability: "exercise_coach", tier: "fast" },
  "coach.intro": { capability: "coach", tier: "fast" },
  "coach.meals": { capability: "coach", tier: "fast" },
};

/** Best first for each tier; all support JSON mode. */
export const TIER_MODELS: Record<AiTier, readonly string[]> = {
  deep: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mistral-nemo", "ministral-8b-latest"],
  fast: ["mistral-small-latest", "ministral-8b-latest", "open-mistral-nemo", "mistral-medium-latest", "mistral-large-latest"],
};

/** Optional per-tier pin, e.g. MISTRAL_MODEL_FAST=ministral-8b-latest. MISTRAL_MODEL pins every tier. */
export function pinnedModel(tier: AiTier): string | null {
  const v = (tier === "fast" ? process.env.MISTRAL_MODEL_FAST : process.env.MISTRAL_MODEL_DEEP)?.trim() || process.env.MISTRAL_MODEL?.trim();
  return v || null;
}

/** FNV-1a, 32-bit, as 8 hex digits. Not for security; just a stable fingerprint. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** `task@hash` of the system prompt(s) the task sends. */
export function promptVersion(task: AiTask, ...prompts: string[]): string {
  return `${task}@${fnv1a(prompts.join("\n\u0000\n"))}`;
}
