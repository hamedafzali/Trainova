// AI-powered program comparison and next phase recommendation service
// Analyzes program history and recommends next training phase

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import { performSafetyCheck } from "./safety";
import {
  createProgramComparisonPrompt,
  type ProgramComparisonInput,
  type ProgramComparisonResponse,
} from "./prompts/programComparison";

export class ProgramComparisonError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "ProgramComparisonError";
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
 * Analyze program completion and recommend next phase
 */
export async function analyzeProgramCompletion(
  input: ProgramComparisonInput
): Promise<ProgramComparisonResponse> {
  try {
    // Validate input
    if (!input.initialStats || !input.finalStats) {
      throw new ProgramComparisonError(
        "Initial and final stats are required",
        "MISSING_STATS"
      );
    }
    if (!input.programName || !input.programGoal) {
      throw new ProgramComparisonError(
        "Program name and goal are required",
        "MISSING_PROGRAM_INFO"
      );
    }

    // Safety check
    const safetyCheck = performSafetyCheck(JSON.stringify(input));
    if (!safetyCheck.isSafe) {
      throw new ProgramComparisonError(
        `Safety check failed: ${safetyCheck.reason}`,
        "SAFETY_VIOLATION"
      );
    }

    // Get Mistral client
    const client = getMistralClient();

    // Create prompt
    const prompt = createProgramComparisonPrompt(input);

    // Call Mistral API
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: "system",
          content:
            "You are a professional strength and conditioning coach. Analyze program completion data and recommend the next training phase.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 1500,
    });

    // Extract response content
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new ProgramComparisonError("No response from AI", "NO_RESPONSE");
    }
    const content = extractContentText(rawContent);

    // Parse JSON response
    let parsed: ProgramComparisonResponse;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new ProgramComparisonError("Failed to parse AI response", "PARSE_ERROR");
    }

    // Validate response structure
    if (!parsed.progressSummary || !parsed.nextPhaseRecommendation) {
      throw new ProgramComparisonError(
        "Invalid response structure from AI",
        "INVALID_RESPONSE"
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ProgramComparisonError) {
      throw error;
    }
    throw new ProgramComparisonError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR"
    );
  }
}
