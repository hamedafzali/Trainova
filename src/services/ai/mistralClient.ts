// Mistral AI client configuration
// Handles API communication with proper error handling and rate limiting

import { Mistral } from "@mistralai/mistralai";

let client: Mistral | null = null;

export function getMistralClient(): Mistral {
  if (!client) {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY environment variable is not set");
    }

    client = new Mistral({
      apiKey,
    });
  }

  return client;
}

export function resetMistralClient(): void {
  client = null;
}

// Model constants
export const MISTRAL_MODELS = {
  LARGE: "mistral-large-latest",
  MEDIUM: "open-mistral-7b", // Using open-mistral-7b as medium model
  SMALL: "open-mistral-7b", // Using same model for small initially
  // Alternative models
  OPENMISTRAL: "open-mistral-7b",
  MIXTRAL: "open-mixtral-8x7b",
} as const;

export type MistralModel = (typeof MISTRAL_MODELS)[keyof typeof MISTRAL_MODELS];

// Default model for different use cases
export const DEFAULT_MODELS = {
  ONBOARDING: MISTRAL_MODELS.LARGE,
  WORKOUT_GENERATION: MISTRAL_MODELS.LARGE,
  COACHING: MISTRAL_MODELS.LARGE,
  NUTRITION: MISTRAL_MODELS.LARGE,
  RECOVERY: MISTRAL_MODELS.LARGE,
  MOTIVATION: MISTRAL_MODELS.MEDIUM,
  CLASS_PROGRAMMING: MISTRAL_MODELS.MEDIUM,
  SIMPLE_TASKS: MISTRAL_MODELS.SMALL,
} as const;
