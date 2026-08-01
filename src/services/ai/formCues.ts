// AI-powered form cues service
// Provides exercise-specific form guidance based on exercise name and user experience

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import { performSafetyCheck } from "./safety";
import {
  createFormCuesPrompt,
  type FormCuesInput,
  type FormCuesResponse,
} from "./prompts/formCues";

export class FormCuesError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "FormCuesError";
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
 * Get exercise-specific form cues
 */
export async function getFormCues(input: FormCuesInput): Promise<FormCuesResponse> {
  try {
    // Validate input
    if (!input.exerciseName) {
      throw new FormCuesError("Exercise name is required", "MISSING_EXERCISE");
    }
    if (!input.userExperience) {
      throw new FormCuesError("Experience level is required", "MISSING_EXPERIENCE");
    }

    // Safety check
    const safetyCheck = performSafetyCheck(JSON.stringify(input));
    if (!safetyCheck.isSafe) {
      throw new FormCuesError(
        `Safety check failed: ${safetyCheck.reason}`,
        "SAFETY_VIOLATION"
      );
    }

    // Get Mistral client
    const client = getMistralClient();

    // Create prompt
    const prompt = createFormCuesPrompt(input);

    // Call Mistral API
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.SIMPLE_TASKS,
      messages: [
        {
          role: "system",
          content:
            "You are a professional strength and conditioning coach. Provide exercise-specific form guidance based on the exercise name and user experience level.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      maxTokens: 1000,
    });

    // Extract response content
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new FormCuesError("No response from AI", "NO_RESPONSE");
    }
    const content = extractContentText(rawContent);

    // Parse JSON response
    let parsed: FormCuesResponse;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new FormCuesError("Failed to parse AI response", "PARSE_ERROR");
    }

    // Validate response structure
    if (!parsed.setup || !parsed.execution || !parsed.cues) {
      throw new FormCuesError("Invalid response structure from AI", "INVALID_RESPONSE");
    }

    return parsed;
  } catch (error) {
    if (error instanceof FormCuesError) {
      throw error;
    }
    throw new FormCuesError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR"
    );
  }
}
