import Anthropic from "@anthropic-ai/sdk";

// Server-side Claude integration for plan generation. Disabled (and the API
// answers 503) until ANTHROPIC_API_KEY is configured.
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export interface PlanRequest {
  goal: string;
  experience: string;
  equipment?: string;
}
export interface GeneratedExercise {
  name: string;
  muscle: string | null;
  sets: number;
  reps: number;
}
export interface GeneratedPlan {
  name: string;
  notes: string | null;
  exercises: GeneratedExercise[];
}

const SHAPE =
  '{"name":string,"notes":string,"exercises":[{"name":string,"muscle":string,"sets":number,"reps":number}]}';

export async function generatePlan(req: PlanRequest): Promise<GeneratedPlan> {
  const c = getClient();
  if (!c) throw new Error("AI not configured");

  const system =
    `You are an expert strength coach. Design ONE safe, effective workout day. ` +
    `Output ONLY valid minified JSON (no prose, no code fences) matching exactly: ${SHAPE}. ` +
    `Use 4–8 exercises; choose beginner-friendly machine and free-weight movements when the ` +
    `lifter is a beginner. sets between 2 and 4, reps between 8 and 15. "muscle" is the primary ` +
    `muscle group. "notes" is one short coaching tip.`;
  const user = `Goal: ${req.goal}. Experience: ${req.experience}. Equipment available: ${
    req.equipment || "a full commercial gym"
  }.`;

  const resp = await c.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(json) as GeneratedPlan;
  if (!parsed?.name || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
    throw new Error("Unexpected AI response");
  }
  return parsed;
}
