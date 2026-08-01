// AI-powered comprehensive workout analysis service
// Analyzes workout data to identify strengths, weaknesses, and provide actionable insights

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import { performSafetyCheck } from "./safety";
import {
  createWorkoutAnalysisPrompt,
  type WorkoutAnalysisInput,
  type WorkoutAnalysisResponse,
} from "./prompts/workoutAnalysis";

export class WorkoutAnalysisError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "WorkoutAnalysisError";
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
 * Perform comprehensive workout analysis
 */
export async function analyzeWorkout(
  input: WorkoutAnalysisInput,
): Promise<WorkoutAnalysisResponse> {
  try {
    // Validate input
    if (!input.userProfile || !input.workoutData) {
      throw new WorkoutAnalysisError(
        "User profile and workout data are required",
        "MISSING_DATA",
      );
    }
    if (!input.workoutData.exercises || input.workoutData.exercises.length === 0) {
      throw new WorkoutAnalysisError(
        "Exercise data is required for analysis",
        "MISSING_EXERCISES",
      );
    }

    // Safety check
    const safetyCheck = performSafetyCheck(JSON.stringify(input));
    if (!safetyCheck.isSafe) {
      throw new WorkoutAnalysisError(
        `Safety check failed: ${safetyCheck.reason}`,
        "SAFETY_VIOLATION",
      );
    }

    // Get Mistral client
    const client = getMistralClient();

    // Create prompt
    const prompt = createWorkoutAnalysisPrompt(input);

    // Call Mistral API
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: "system",
          content:
            "You are a professional strength and conditioning coach and sports scientist. Analyze comprehensive workout data to provide detailed strength/weakness analysis with actionable insights.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 2500,
    });

    // Extract response content
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new WorkoutAnalysisError("No response from AI", "NO_RESPONSE");
    }
    const content = extractContentText(rawContent);

    // Parse JSON response
    let parsed: WorkoutAnalysisResponse;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new WorkoutAnalysisError("Failed to parse AI response", "PARSE_ERROR");
    }

    // Validate response structure
    if (
      !parsed.overallAssessment ||
      !parsed.strengths ||
      !parsed.weaknesses ||
      !parsed.muscleBalance ||
      !parsed.progressionAnalysis ||
      !parsed.actionableRecommendations ||
      !parsed.nextSteps
    ) {
      throw new WorkoutAnalysisError(
        "Invalid response structure from AI",
        "INVALID_RESPONSE",
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof WorkoutAnalysisError) {
      throw error;
    }
    throw new WorkoutAnalysisError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR",
    );
  }
}
