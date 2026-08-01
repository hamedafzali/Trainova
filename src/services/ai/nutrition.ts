// AI-powered nutrition calculation service
// Calculates personalized nutrition targets based on user profile and goals

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import { performSafetyCheck } from "./safety";
import {
  createNutritionPrompt,
  type NutritionInput,
  type NutritionResponse,
} from "./prompts/nutrition";

export class NutritionError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "NutritionError";
  }
}

/**
 * Helper function to extract text from Mistral content
 */
function extractContentText(content: string | any[]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((chunk) => chunk.type === "text")
      .map((chunk) => chunk.text)
      .join("");
  }
  return "";
}

/**
 * Calculate personalized nutrition targets
 */
export async function calculateNutrition(input: NutritionInput): Promise<NutritionResponse> {
  try {
    // Validate input
    if (!input.age || !input.weight || !input.height) {
      throw new NutritionError("Age, weight, and height are required", "MISSING_DATA");
    }
    if (!input.goal) {
      throw new NutritionError("Goal is required", "MISSING_GOAL");
    }
    if (!input.activityLevel) {
      throw new NutritionError("Activity level is required", "MISSING_ACTIVITY");
    }

    // Safety check
    const safetyCheck = performSafetyCheck(JSON.stringify(input));
    if (!safetyCheck.isSafe) {
      throw new NutritionError(`Safety check failed: ${safetyCheck.reason}`, "SAFETY_VIOLATION");
    }

    // Get Mistral client
    const client = getMistralClient();

    // Create prompt
    const prompt = createNutritionPrompt(input);

    // Call Mistral API
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.NUTRITION,
      messages: [
        {
          role: "system",
          content:
            "You are a registered sports nutritionist. Calculate personalized nutrition targets based on user profile and body composition goals.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      maxTokens: 1000,
    });

    // Extract response content
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new NutritionError("No response from AI", "NO_RESPONSE");
    }
    const content = extractContentText(rawContent);

    // Parse JSON response
    let parsed: NutritionResponse;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new NutritionError("Failed to parse AI response", "PARSE_ERROR");
    }

    // Validate response structure
    if (!parsed.maintenanceCalories || !parsed.targetCalories || !parsed.macros) {
      throw new NutritionError("Invalid response structure from AI", "INVALID_RESPONSE");
    }

    return parsed;
  } catch (error) {
    if (error instanceof NutritionError) {
      throw error;
    }
    throw new NutritionError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR"
    );
  }
}
