// AI-powered workout generation service
// Generates custom workouts based on user goals, equipment, and preferences

import { getMistralClient, DEFAULT_MODELS } from './mistralClient';
import {
  createWorkoutPrompt,
  createQuickWorkoutPrompt,
  createWorkoutVariationPrompt,
  createProgressionPrompt,
  type WorkoutGenerationInput,
  type GeneratedWorkout,
} from './prompts/workout';
import {
  performSafetyCheck,
  validateUserInput,
  addMedicalDisclaimer,
} from './safety';
import { AiOutputValidationError, validateGeneratedWorkout } from './validate';

export class WorkoutGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkoutGenerationError';
  }
}

/**
 * Generate a custom workout based on user parameters
 */
export async function generateWorkout(
  input: WorkoutGenerationInput
): Promise<GeneratedWorkout> {
  // Validate input
  const safetyCheck = validateUserInput(JSON.stringify(input));
  if (!safetyCheck.isSafe) {
    throw new WorkoutGenerationError(
      'Input validation failed',
      'INVALID_INPUT',
      safetyCheck
    );
  }

  try {
    const client = getMistralClient();
    const prompt = createWorkoutPrompt(input);

    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness coach specializing in workout programming. Your output must be valid JSON following the specified schema. Always include medical disclaimers for fitness-related content.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 3000,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new WorkoutGenerationError('No response from AI', 'NO_RESPONSE');
    }

    // Handle content as string or ContentChunk array
    let contentString: string;
    if (typeof content === 'string') {
      contentString = content;
    } else if (Array.isArray(content)) {
      contentString = content
        .filter((chunk): chunk is { type: 'text'; text: string } => chunk.type === 'text')
        .map(chunk => chunk.text)
        .join('');
    } else {
      contentString = String(content);
    }

    // Parse JSON response
    let parsedWorkout: GeneratedWorkout;
    try {
      const jsonMatch = contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : contentString;
      parsedWorkout = validateGeneratedWorkout(JSON.parse(jsonString));
    } catch (parseError) {
      const message =
        parseError instanceof AiOutputValidationError
          ? parseError.message
          : 'Failed to parse AI response as JSON';
      throw new WorkoutGenerationError(
        message,
        'PARSE_ERROR',
        { rawContent: contentString }
      );
    }

    // Safety check
    const contentSafetyCheck = performSafetyCheck(JSON.stringify(parsedWorkout));
    if (!contentSafetyCheck.isSafe) {
      throw new WorkoutGenerationError(
        'Generated content failed safety check',
        'SAFETY_CHECK_FAILED',
        contentSafetyCheck
      );
    }

    // Ensure medical disclaimer
    if (parsedWorkout.description) {
      parsedWorkout.description = addMedicalDisclaimer(parsedWorkout.description);
    }

    return parsedWorkout;
  } catch (error) {
    if (error instanceof WorkoutGenerationError) {
      throw error;
    }
    
    throw new WorkoutGenerationError(
      `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'AI_SERVICE_ERROR'
    );
  }
}

/**
 * Generate a quick time-efficient workout
 */
export async function generateQuickWorkout(input: {
  duration: number;
  equipment: string[];
  focus: string;
}): Promise<GeneratedWorkout> {
  try {
    const client = getMistralClient();
    const prompt = createQuickWorkoutPrompt(input);

    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness coach specializing in efficient workouts. Your output must be valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new WorkoutGenerationError('No response from AI', 'NO_RESPONSE');
    }

    let contentString: string;
    if (typeof content === 'string') {
      contentString = content;
    } else if (Array.isArray(content)) {
      contentString = content
        .filter((chunk): chunk is { type: 'text'; text: string } => chunk.type === 'text')
        .map(chunk => chunk.text)
        .join('');
    } else {
      contentString = String(content);
    }

    let parsedWorkout: GeneratedWorkout;
    try {
      const jsonMatch = contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : contentString;
      parsedWorkout = validateGeneratedWorkout(JSON.parse(jsonString));
    } catch (parseError) {
      const message =
        parseError instanceof AiOutputValidationError
          ? parseError.message
          : 'Failed to parse AI response as JSON';
      throw new WorkoutGenerationError(
        message,
        'PARSE_ERROR',
        { rawContent: contentString }
      );
    }

    return parsedWorkout;
  } catch (error) {
    if (error instanceof WorkoutGenerationError) {
      throw error;
    }
    
    throw new WorkoutGenerationError(
      `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'AI_SERVICE_ERROR'
    );
  }
}

/**
 * Generate a workout variation based on user feedback
 */
export async function generateWorkoutVariation(
  originalWorkout: GeneratedWorkout,
  feedback: string
): Promise<GeneratedWorkout> {
  try {
    const client = getMistralClient();
    const prompt = createWorkoutVariationPrompt(originalWorkout, feedback);

    const response = await client.chat.complete({
      model: DEFAULT_MODELS.WORKOUT_GENERATION,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness coach. Modify workouts based on user feedback while maintaining effectiveness and safety. Your output must be valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.6,
      maxTokens: 3000,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new WorkoutGenerationError('No response from AI', 'NO_RESPONSE');
    }

    let contentString: string;
    if (typeof content === 'string') {
      contentString = content;
    } else if (Array.isArray(content)) {
      contentString = content
        .filter((chunk): chunk is { type: 'text'; text: string } => chunk.type === 'text')
        .map(chunk => chunk.text)
        .join('');
    } else {
      contentString = String(content);
    }

    let parsedWorkout: GeneratedWorkout;
    try {
      const jsonMatch = contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : contentString;
      parsedWorkout = validateGeneratedWorkout(JSON.parse(jsonString));
    } catch (parseError) {
      const message =
        parseError instanceof AiOutputValidationError
          ? parseError.message
          : 'Failed to parse AI response as JSON';
      throw new WorkoutGenerationError(
        message,
        'PARSE_ERROR',
        { rawContent: contentString }
      );
    }

    return parsedWorkout;
  } catch (error) {
    if (error instanceof WorkoutGenerationError) {
      throw error;
    }
    
    throw new WorkoutGenerationError(
      `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'AI_SERVICE_ERROR'
    );
  }
}

/**
 * Generate a progressive overload plan for an exercise
 */
export async function generateProgressionPlan(
  exercise: string,
  currentStats: {
    weight: number;
    reps: number;
    sets: number;
    rpe: number;
  }
): Promise<{
  exercise: string;
  weeks: Array<{
    week: number;
    weight: number;
    reps: string;
    sets: number;
    rpe: number;
    notes: string;
  }>;
  generalAdvice: string;
}> {
  try {
    const client = getMistralClient();
    const prompt = createProgressionPrompt(exercise, currentStats);

    const response = await client.chat.complete({
      model: DEFAULT_MODELS.COACHING,
      messages: [
        {
          role: 'system',
          content: 'You are an expert strength coach specializing in progressive overload. Your output must be valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      maxTokens: 1500,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new WorkoutGenerationError('No response from AI', 'NO_RESPONSE');
    }

    let contentString: string;
    if (typeof content === 'string') {
      contentString = content;
    } else if (Array.isArray(content)) {
      contentString = content
        .filter((chunk): chunk is { type: 'text'; text: string } => chunk.type === 'text')
        .map(chunk => chunk.text)
        .join('');
    } else {
      contentString = String(content);
    }

    let parsedPlan;
    try {
      const jsonMatch = contentString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : contentString;
      parsedPlan = JSON.parse(jsonString);
    } catch (parseError) {
      throw new WorkoutGenerationError(
        'Failed to parse AI response as JSON',
        'PARSE_ERROR',
        { rawContent: contentString }
      );
    }

    return parsedPlan;
  } catch (error) {
    if (error instanceof WorkoutGenerationError) {
      throw error;
    }
    
    throw new WorkoutGenerationError(
      `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'AI_SERVICE_ERROR'
    );
  }
}

// Re-export types for API usage
export type { WorkoutGenerationInput, GeneratedWorkout } from './prompts/workout';
