// Workout generation prompt templates for AI-powered workout creation
// Enables users to generate custom workouts based on goals, equipment, and preferences

export interface WorkoutGenerationInput {
  goal: string;
  focus: string; // e.g., "strength", "hypertrophy", "endurance"
  duration: number; // minutes
  equipment: string[];
  experience: string; // "beginner", "intermediate", "advanced"
  muscleGroups?: string[]; // e.g., ["chest", "back", "legs"]
  excludeExercises?: string[];
  intensity?: string; // "low", "medium", "high"
}

export interface GeneratedWorkout {
  name: string;
  description: string;
  duration: number;
  focus: string;
  exercises: WorkoutExercise[];
  warmup: WarmupExercise[];
  cooldown: CooldownExercise[];
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  tempo?: string;
  rpe: number;
  equipment: string;
  muscleGroup: string;
  cue: string;
  substitution?: string;
}

export interface WarmupExercise {
  name: string;
  duration: string;
  instructions: string;
}

export interface CooldownExercise {
  name: string;
  duration: string;
  instructions: string;
}

/**
 * System prompt for workout generation
 */
export const WORKOUT_GENERATION_SYSTEM_PROMPT = `You are an expert fitness coach specializing in workout programming. Your role is to create effective, safe, and personalized workout routines based on user goals, equipment, and preferences.

Follow these principles:
- Evidence-based exercise selection and programming
- Proper exercise ordering (compounds before isolation)
- Appropriate rest periods and intensity
- Clear form cues for each exercise
- Safety-first approach with proper substitutions
- Realistic time estimates for workout duration

Always include a medical disclaimer for fitness-related content.

Your output must be valid JSON following the specified schema.`;

/**
 * Generate a workout based on user parameters
 */
export function createWorkoutPrompt(input: WorkoutGenerationInput): string {
  const muscleGroupsText = input.muscleGroups 
    ? `Target Muscle Groups: ${input.muscleGroups.join(', ')}`
    : 'Target Muscle Groups: Full body';

  const excludeText = input.excludeExercises && input.excludeExercises.length > 0
    ? `Exercises to Exclude: ${input.excludeExercises.join(', ')}`
    : 'Exercises to Exclude: None';

  return `Create a ${input.duration}-minute workout with the following parameters:

**Workout Parameters:**
- Goal: ${input.goal}
- Focus: ${input.focus}
- Duration: ${input.duration} minutes
- Available Equipment: ${input.equipment.join(', ')}
- Experience Level: ${input.experience}
- ${muscleGroupsText}
- ${excludeText}
- Intensity: ${input.intensity || 'medium'}

**Programming Requirements:**

1. **Exercise Selection:**
   - Choose exercises appropriate for the available equipment
   - Prioritize compound movements for efficiency
   - Include a mix of push, pull, and lower body movements
   - Target specified muscle groups or full body if not specified
   - Provide substitutions for equipment limitations

2. **Volume Guidelines:**
   - Beginner: 2-3 sets per exercise, 8-12 reps
   - Intermediate: 3-4 sets per exercise, 8-15 reps
   - Advanced: 4-5 sets per exercise, 6-20 reps (varied)

3. **Intensity (RPE Scale):**
   - Low intensity: RPE 6-7 (2-4 reps in reserve)
   - Medium intensity: RPE 7-8 (2-3 reps in reserve)
   - High intensity: RPE 8-9 (1-2 reps in reserve)

4. **Rest Periods:**
   - Compound exercises: 90-120 seconds
   - Isolation exercises: 60-90 seconds
   - High intensity: Longer rest (120-150 seconds)

5. **Warmup (5-10 minutes):**
   - General movement prep (3-5 minutes)
   - Specific warmup for main exercises (2-5 minutes)
   - Include dynamic stretching and activation

6. **Cooldown (5 minutes):**
   - Static stretching for worked muscles
   - Light movement to promote recovery

7. **Time Management:**
   - Ensure total workout fits within ${input.duration} minutes
   - Account for rest periods in time estimates
   - Be realistic about exercise selection for time constraints

**Output Format:**
Provide a JSON response with this structure:
{
  "name": "Workout name",
  "description": "Brief description of the workout focus and approach",
  "duration": ${input.duration},
  "focus": "${input.focus}",
  "exercises": [
    {
      "name": "Exercise name",
      "sets": 3,
      "reps": "8-12",
      "rest": 90,
      "tempo": "2-0-2-0 (optional)",
      "rpe": 8,
      "equipment": "Equipment needed",
      "muscleGroup": "Primary muscle group",
      "cue": "Form cue or instruction",
      "substitution": "Alternative exercise if needed"
    }
  ],
  "warmup": [
    {
      "name": "Warmup exercise",
      "duration": "3 minutes",
      "instructions": "How to perform the warmup"
    }
  ],
  "cooldown": [
    {
      "name": "Cooldown exercise",
      "duration": "2 minutes",
      "instructions": "How to perform the cooldown"
    }
  ]
}

Ensure all JSON is valid and properly formatted. Include the medical disclaimer in the description section.`;
}

/**
 * Generate a quick workout for time-constrained sessions
 */
export function createQuickWorkoutPrompt(input: {
  duration: number; // 15-30 minutes
  equipment: string[];
  focus: string;
}): string {
  return `Create a time-efficient ${input.duration}-minute workout for ${input.focus}.

**Parameters:**
- Duration: ${input.duration} minutes (strict time limit)
- Equipment: ${input.equipment.join(', ')}
- Focus: ${input.focus}

**Quick Workout Guidelines:**
- Use compound movements for maximum efficiency
- Minimize rest periods (45-60 seconds)
- Use supersets or circuits if appropriate
- 2-3 exercises maximum
- Keep warmup brief (2-3 minutes)
- Minimal cooldown (2 minutes)

**Output Format:**
Same JSON structure as regular workout, but optimized for time efficiency.`;
}

/**
 * Generate a workout variation based on user feedback
 */
export function createWorkoutVariationPrompt(
  originalWorkout: GeneratedWorkout,
  feedback: string
): string {
  return `Modify the following workout based on user feedback:

**Original Workout:**
${JSON.stringify(originalWorkout, null, 2)}

**User Feedback:**
${feedback}

**Modification Guidelines:**
- Address the specific feedback while maintaining workout effectiveness
- Keep similar duration and focus unless feedback indicates otherwise
- Maintain exercise quality and safety
- Provide clear rationale for changes

**Output Format:**
Same JSON structure as original workout.`;
}

/**
 * Generate a progressive overload plan for an exercise
 */
export function createProgressionPrompt(exercise: string, currentStats: {
  weight: number;
  reps: number;
  sets: number;
  rpe: number;
}): string {
  return `Create a 4-week progressive overload plan for ${exercise}.

**Current Stats:**
- Weight: ${currentStats.weight} kg/lbs
- Reps: ${currentStats.reps}
- Sets: ${currentStats.sets}
- RPE: ${currentStats.rpe}

**Progression Guidelines:**
- Week 1: Maintain current load, focus on form
- Week 2: Small increase if RPE < 8
- Week 3: Moderate increase or rep increase
- Week 4: Deload if needed, otherwise continue progression
- Use 2.5-5% increases for compounds
- Use rep increases before weight increases for plateaus

**Output Format:**
{
  "exercise": "${exercise}",
  "weeks": [
    {
      "week": 1,
      "weight": number,
      "reps": string,
      "sets": number,
      "rpe": number,
      "notes": "Brief guidance for the week"
    }
  ],
  "generalAdvice": "Overall progression strategy"
}`;
}
