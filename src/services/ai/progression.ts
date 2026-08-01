// AI-powered progression analysis service
// Analyzes workout data to provide evidence-based progression recommendations

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import { performSafetyCheck } from "./safety";
import {
  createProgressionPrompt,
  createWeeklyAnalysisPrompt,
  type ProgressionInput,
  type ProgressionResponse,
  type WeeklyAnalysisInput,
  type WeeklyAnalysisResponse,
} from "./prompts/progression";

export class ProgressionError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ProgressionError";
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
 * Analyze workout progression for a specific exercise
 */
export async function analyzeProgression(
  input: ProgressionInput,
): Promise<ProgressionResponse> {
  try {
    // Validate input
    if (!input.exerciseId || !input.exerciseName) {
      throw new ProgressionError(
        "Exercise ID and name are required",
        "MISSING_EXERCISE",
      );
    }
    if (!input.workoutHistory || input.workoutHistory.length === 0) {
      throw new ProgressionError(
        "Workout history is required for analysis",
        "MISSING_HISTORY",
      );
    }

    // Safety check
    const safetyCheck = performSafetyCheck(JSON.stringify(input));
    if (!safetyCheck.isSafe) {
      throw new ProgressionError(
        `Safety check failed: ${safetyCheck.reason}`,
        "SAFETY_VIOLATION",
      );
    }

    // Get Mistral client
    const client = getMistralClient();

    // Create prompt
    const prompt = createProgressionPrompt(input);

    // Call Mistral API
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: "system",
          content:
            "You are a professional strength and conditioning coach. Analyze workout data to provide evidence-based progression recommendations.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 1500,
    });

    // Extract response content
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new ProgressionError("No response from AI", "NO_RESPONSE");
    }
    const content = extractContentText(rawContent);

    // Parse JSON response
    let parsed: ProgressionResponse;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new ProgressionError("Failed to parse AI response", "PARSE_ERROR");
    }

    // Validate response structure
    if (
      !parsed.analysis ||
      !parsed.recommendations ||
      !parsed.nextSessionTarget
    ) {
      throw new ProgressionError(
        "Invalid response structure from AI",
        "INVALID_RESPONSE",
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ProgressionError) {
      throw error;
    }
    throw new ProgressionError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR",
    );
  }
}

/**
 * Analyze weekly workout data for program adjustments
 */
export async function analyzeWeeklyProgression(
  input: WeeklyAnalysisInput,
): Promise<WeeklyAnalysisResponse> {
  try {
    // Validate input
    if (!input.programName) {
      throw new ProgressionError("Program name is required", "MISSING_PROGRAM");
    }
    if (!input.workoutData) {
      throw new ProgressionError("Workout data is required", "MISSING_DATA");
    }

    // Safety check
    const safetyCheck = performSafetyCheck(JSON.stringify(input));
    if (!safetyCheck.isSafe) {
      throw new ProgressionError(
        `Safety check failed: ${safetyCheck.reason}`,
        "SAFETY_VIOLATION",
      );
    }

    // Get Mistral client
    const client = getMistralClient();

    // Create prompt
    const prompt = createWeeklyAnalysisPrompt(input);

    // Call Mistral API
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: "system",
          content:
            "You are a professional strength and conditioning coach. Analyze weekly workout data to provide program adjustment recommendations.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 1500,
    });

    // Extract response content
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new ProgressionError("No response from AI", "NO_RESPONSE");
    }
    const content = extractContentText(rawContent);

    // Parse JSON response
    let parsed: WeeklyAnalysisResponse;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new ProgressionError("Failed to parse AI response", "PARSE_ERROR");
    }

    // Validate response structure
    if (!parsed.assessment || !parsed.adjustments) {
      throw new ProgressionError(
        "Invalid response structure from AI",
        "INVALID_RESPONSE",
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ProgressionError) {
      throw error;
    }
    throw new ProgressionError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR",
    );
  }
}
