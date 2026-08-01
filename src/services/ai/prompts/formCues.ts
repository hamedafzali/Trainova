// Form cues prompt templates for AI-powered exercise guidance
// Provides exercise-specific form cues based on exercise name and user experience

export interface FormCuesInput {
  exerciseName: string;
  userExperience: "beginner" | "intermediate" | "advanced";
  equipment?: string;
}

export interface FormCuesResponse {
  exerciseName: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setup: string[];
  execution: string[];
  commonMistakes: string[];
  cues: string[];
  safetyNotes: string[];
  disclaimer: string;
}

/**
 * Form cues system prompt
 */
export const FORM_CUES_SYSTEM_PROMPT = `You are a professional strength and conditioning coach. Provide exercise-specific form guidance based on the exercise name and user experience level.

Follow these principles:
- Focus on safety and effectiveness
- Provide clear, actionable cues
- Adapt complexity to experience level
- Highlight common mistakes
- Always include safety disclaimers

Your output must be valid JSON following the specified schema.`;

/**
 * Create form cues prompt
 */
export function createFormCuesPrompt(input: FormCuesInput): string {
  return `Provide form guidance for the following exercise:

**Exercise:** ${input.exerciseName}
**Experience Level:** ${input.userExperience}
**Equipment:** ${input.equipment || "Standard gym equipment"}

**Guidelines:**

1. **Setup (3-5 points):**
   - Body position and alignment
   - Grip and stance
   - Equipment setup
   - Starting position

2. **Execution (3-5 points):**
   - Movement pattern
   - Tempo and rhythm
   - Key positions
   - Breathing

3. **Common Mistakes (3-5 points):**
   - Typical form errors
   - Why they're problematic
   - How to correct them

4. **Cues (3-5 short, memorable cues):**
   - Simple, actionable reminders
   - Easy to remember during exercise
   - Focus on key technique points

5. **Safety Notes (2-3 points):**
   - Injury prevention
   - When to stop
   - Red flags

**Experience Level Adaptation:**
- Beginner: Focus on basic form, safety, simple cues
- Intermediate: Add technique refinement, progressive cues
- Advanced: Include performance optimization, advanced cues

**Output Format:**
Provide a JSON response with this structure:
{
  "exerciseName": "Exercise name",
  "primaryMuscles": ["muscle1", "muscle2"],
  "secondaryMuscles": ["muscle1", "muscle2"],
  "setup": ["Setup point 1", "Setup point 2", "Setup point 3"],
  "execution": ["Execution point 1", "Execution point 2", "Execution point 3"],
  "commonMistakes": ["Mistake 1", "Mistake 2", "Mistake 3"],
  "cues": ["Short cue 1", "Short cue 2", "Short cue 3"],
  "safetyNotes": ["Safety note 1", "Safety note 2"],
  "disclaimer": "Medical disclaimer about consulting professional"
}

Ensure all JSON is valid and properly formatted. Include the medical disclaimer in the response.`;
}
