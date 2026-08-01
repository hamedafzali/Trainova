// Deprecated: Old Anthropic AI integration
// Replaced with Mistral AI integration in src/services/ai/
// This file is kept for backward compatibility but is not used

export function isAiEnabled(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY);
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

export async function generatePlan(_req: PlanRequest): Promise<GeneratedPlan> {
  throw new Error(
    "Old AI integration deprecated. Use new Mistral AI endpoints at /api/ai/onboarding or /api/ai/workout",
  );
}
