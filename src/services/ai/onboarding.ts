// AI-powered onboarding service
// Generates personalized training programs based on user assessment

import { getMistralClient, DEFAULT_MODELS } from "./mistralClient";
import {
  createOnboardingPrompt,
  createFollowUpPrompt,
  createWeeklyCheckInPrompt,
  type OnboardingInput,
  type OnboardingResponse,
} from "./prompts/onboarding";
import {
  performSafetyCheck,
  validateUserInput,
  addMedicalDisclaimer,
  type SafetyCheckResult,
} from "./safety";

// Re-export types for API usage
export type { OnboardingInput, OnboardingResponse } from "./prompts/onboarding";

export class OnboardingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

/**
 * Generate a personalized training program based on user onboarding data
 */
export async function generateOnboardingProgram(
  input: OnboardingInput,
): Promise<OnboardingResponse> {
  // Validate input
  const safetyCheck = validateUserInput(JSON.stringify(input));
  if (!safetyCheck.isSafe) {
    throw new OnboardingError(
      "Input validation failed",
      "INVALID_INPUT",
      safetyCheck,
    );
  }

  try {
    const client = getMistralClient();
    const prompt = createOnboardingPrompt(input);

    // Call Mistral AI
    const response = await client.chat.complete({
      model: DEFAULT_MODELS.ONBOARDING,
      messages: [
        {
          role: "system",
          content:
            "You are a professional fitness coach. Your output must be valid JSON following the specified schema. Always include medical disclaimers for fitness-related content.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7, // Balanced creativity and consistency
      maxTokens: 4000, // Sufficient for program generation
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new OnboardingError("No response from AI", "NO_RESPONSE");
    }

    // Handle content as string or ContentChunk array
    let contentString: string;
    if (typeof content === "string") {
      contentString = content;
    } else if (Array.isArray(content)) {
      // Filter out image chunks and join text chunks
      contentString = content
        .filter(
          (chunk): chunk is { type: "text"; text: string } =>
            chunk.type === "text",
        )
        .map((chunk) => chunk.text)
        .join("");
    } else {
      contentString = String(content);
    }

    // Parse JSON response
    let parsedResponse: OnboardingResponse;
    try {
      // Extract JSON from response (in case AI adds extra text)
      const jsonMatch = contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : contentString;
      parsedResponse = JSON.parse(jsonString);
    } catch (parseError) {
      throw new OnboardingError(
        "Failed to parse AI response as JSON",
        "PARSE_ERROR",
        { rawContent: contentString },
      );
    }

    // Safety check on generated content
    const contentSafetyCheck = performSafetyCheck(
      JSON.stringify(parsedResponse),
    );
    if (!contentSafetyCheck.isSafe) {
      throw new OnboardingError(
        "Generated content failed safety check",
        "SAFETY_CHECK_FAILED",
        contentSafetyCheck,
      );
    }

    // Ensure medical disclaimer is present
    if (parsedResponse.recommendations) {
      parsedResponse.recommendations.nutrition = addMedicalDisclaimer(
        parsedResponse.recommendations.nutrition,
      );
    }

    return parsedResponse;
  } catch (error) {
    if (error instanceof OnboardingError) {
      throw error;
    }

    // Handle Mistral API errors
    if (error instanceof Error) {
      throw new OnboardingError(
        `AI service error: ${error.message}`,
        "AI_SERVICE_ERROR",
        { originalError: error.message },
      );
    }

    throw new OnboardingError("Unknown error occurred", "UNKNOWN_ERROR", {
      error,
    });
  }
}

/**
 * Generate follow-up question for incomplete onboarding
 */
export async function generateFollowUpQuestion(
  missingFields: string[],
  currentData: Partial<OnboardingInput>,
): Promise<string> {
  try {
    const client = getMistralClient();
    const prompt = createFollowUpPrompt(missingFields, currentData);

    const response = await client.chat.complete({
      model: DEFAULT_MODELS.MOTIVATION,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful fitness coach assistant. Guide users to complete their onboarding by asking for missing information in a friendly, encouraging way.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      maxTokens: 500,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new OnboardingError("No response from AI", "NO_RESPONSE");
    }

    // Handle content as string or ContentChunk array
    let contentString: string;
    if (typeof content === "string") {
      contentString = content;
    } else if (Array.isArray(content)) {
      contentString = content
        .filter(
          (chunk): chunk is { type: "text"; text: string } =>
            chunk.type === "text",
        )
        .map((chunk) => chunk.text)
        .join("");
    } else {
      contentString = String(content);
    }

    return contentString;
  } catch (error) {
    // Fallback to simple prompt if AI fails
    return `Please provide the following information to complete your profile: ${missingFields.join(", ")}.`;
  }
}

/**
 * Generate weekly check-in recommendations
 */
export async function generateWeeklyCheckIn(
  programName: string,
  weekNumber: number,
  checkInData: {
    weight?: string;
    sessionsCompleted: number;
    sessionsPlanned: number;
    painOrInjuries?: string;
    averageRPE: number;
    sleepQuality: number;
    energyLevel: number;
    whatFeltGood: string;
    whatFeltDifficult: string;
    weightChanges?: string;
  },
): Promise<{
  assessment: string;
  adjustments: {
    volumeChange: string;
    intensityChange: string;
    exerciseChanges: string[];
    deloadRecommended: boolean;
    reasoning: string;
  };
  encouragement: string;
  focusForNextWeek: string;
}> {
  // Validate input
  const safetyCheck = validateUserInput(JSON.stringify(checkInData));
  if (!safetyCheck.isSafe) {
    throw new OnboardingError(
      "Input validation failed",
      "INVALID_INPUT",
      safetyCheck,
    );
  }

  try {
    const client = getMistralClient();
    const prompt = createWeeklyCheckInPrompt(
      programName,
      weekNumber,
      checkInData,
    );

    const response = await client.chat.complete({
      model: DEFAULT_MODELS.COACHING,
      messages: [
        {
          role: "system",
          content:
            "You are a professional fitness coach providing weekly check-in guidance. Your output must be valid JSON. Always prioritize safety and sustainable progress.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.6, // Lower temperature for consistent recommendations
      maxTokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new OnboardingError("No response from AI", "NO_RESPONSE");
    }

    // Handle content as string or ContentChunk array
    let contentString: string;
    if (typeof content === "string") {
      contentString = content;
    } else if (Array.isArray(content)) {
      contentString = content
        .filter(
          (chunk): chunk is { type: "text"; text: string } =>
            chunk.type === "text",
        )
        .map((chunk) => chunk.text)
        .join("");
    } else {
      contentString = String(content);
    }

    // Parse JSON response
    let parsedResponse;
    try {
      const jsonMatch = contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : contentString;
      parsedResponse = JSON.parse(jsonString);
    } catch (parseError) {
      throw new OnboardingError(
        "Failed to parse AI response as JSON",
        "PARSE_ERROR",
        { rawContent: contentString },
      );
    }

    // Safety check
    const contentSafetyCheck = performSafetyCheck(
      JSON.stringify(parsedResponse),
    );
    if (!contentSafetyCheck.isSafe) {
      throw new OnboardingError(
        "Generated content failed safety check",
        "SAFETY_CHECK_FAILED",
        contentSafetyCheck,
      );
    }

    return parsedResponse;
  } catch (error) {
    if (error instanceof OnboardingError) {
      throw error;
    }

    throw new OnboardingError(
      `AI service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "AI_SERVICE_ERROR",
    );
  }
}

/**
 * Validate onboarding input completeness
 */
export function validateOnboardingInput(input: Partial<OnboardingInput>): {
  isValid: boolean;
  missingFields: string[];
} {
  const requiredFields: (keyof OnboardingInput)[] = [
    "goal",
    "timeline",
    "experience",
    "daysPerWeek",
    "sessionDuration",
    "equipment",
    "age",
    "sex",
    "height",
    "weight",
    "sleepQuality",
    "stressLevel",
    "nutrition",
  ];

  const missingFields = requiredFields.filter(
    (field) => !input[field] || input[field] === "",
  );

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}
