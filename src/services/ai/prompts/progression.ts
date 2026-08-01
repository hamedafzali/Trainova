// Progression analysis prompt templates for AI-powered workout adjustments
// Based on actual workout data analysis

export interface ProgressionInput {
  exerciseId: string;
  exerciseName: string;
  workoutHistory: {
    date: string;
    sets: {
      weight: number;
      reps: number;
      rpe: number;
    }[];
  }[];
  userExperience: "beginner" | "intermediate" | "advanced";
  goal: "strength" | "hypertrophy" | "fat_loss" | "health";
}

export interface ProgressionResponse {
  analysis: string;
  currentLevel: string;
  recommendations: {
    weightAdjustment: number; // kg or lbs to add/subtract
    repAdjustment: number; // reps to add/subtract
    setAdjustment: number; // sets to add/subtract
    reasoning: string;
  };
  formCues: string[];
  nextSessionTarget: {
    weight: number;
    reps: number;
    sets: number;
    targetRPE: number;
  };
}

/**
 * Progression analysis system prompt
 */
export const PROGRESSION_SYSTEM_PROMPT = `You are a professional strength and conditioning coach. Analyze workout data to provide evidence-based progression recommendations.

Follow these principles:
- Progressive overload is the primary driver of adaptation
- RPE (Rate of Perceived Exertion) should guide intensity management
- Form quality takes precedence over loading
- Individualization based on goals and experience level
- Sustainable progression over rapid jumps

Your output must be valid JSON following the specified schema.`;

/**
 * Create progression analysis prompt
 */
export function createProgressionPrompt(input: ProgressionInput): string {
  const recentWorkouts = input.workoutHistory.slice(-4); // Last 4 sessions
  
  return `Analyze the following workout data for ${input.exerciseName} and provide progression recommendations:

**User Profile:**
- Experience Level: ${input.userExperience}
- Primary Goal: ${input.goal}

**Workout History (Last ${recentWorkouts.length} sessions):**
${recentWorkouts.map((workout, idx) => `
Session ${idx + 1} (${workout.date}):
${workout.sets.map((set, setIdx) => `  Set ${setIdx + 1}: ${set.weight}kg × ${set.reps} reps @ RPE ${set.rpe}`).join('\n')}
`).join('\n')}

**Analysis Guidelines:**

1. **RPE Trend Analysis:**
   - If all sets consistently hit RPE ≤ 8 at top of rep range → increase weight 2.5-5%
   - If last rep reaches RPE 9 with reps still in reserve → maintain weight, try +1 rep
   - If any set fails to reach bottom of rep range → reduce weight 5%
   - If technique degrades before target RPE → maintain weight, prioritize form
   - If all sets RPE ≥ 9.5 for 2+ sessions → deload 10% next session

2. **Progression Rules by Experience:**
   - Beginner: Focus on technique, small weight increments (1.25-2.5kg)
   - Intermediate: Standard progression (2.5-5kg), rep ranges 6-12
   - Advanced: Periodized progression, can handle higher RPE (9-10) sparingly

3. **Goal-Specific Progression:**
   - Strength: Lower rep ranges (3-6), higher intensity (RPE 8-9)
   - Hypertrophy: Moderate rep ranges (8-12), moderate intensity (RPE 7-8)
   - Fat Loss: Higher volume (12-15+), moderate intensity (RPE 6-8)
   - Health: Focus on consistency, moderate intensity (RPE 6-7)

4. **Form Cues:**
   - Provide 2-3 specific form cues based on the exercise
   - Address common technique errors
   - Focus on safety and effectiveness

**Output Format:**
Provide a JSON response with this structure:
{
  "analysis": "Brief assessment of current performance and trends",
  "currentLevel": "Description of user's current level on this exercise",
  "recommendations": {
    "weightAdjustment": number (positive to add, negative to reduce, in kg),
    "repAdjustment": number (positive to add, negative to reduce),
    "setAdjustment": number (positive to add, negative to reduce),
    "reasoning": "Explanation for the recommended adjustments"
  },
  "formCues": ["Form cue 1", "Form cue 2", "Form cue 3"],
  "nextSessionTarget": {
    "weight": number (recommended weight for next session),
    "reps": number (recommended reps for next session),
    "sets": number (recommended sets for next session),
    "targetRPE": number (target RPE for next session)
  }
}

Ensure all JSON is valid and properly formatted. Weight adjustments should be in kg (convert from lbs if needed).`;
}

/**
 * Weekly analysis prompt for overall program adjustment
 */
export interface WeeklyAnalysisInput {
  programName: string;
  weekNumber: number;
  workoutData: {
    sessionsCompleted: number;
    sessionsPlanned: number;
    averageRPE: number;
    adherenceRate: number; // percentage
    totalVolume: number; // total weight × reps across all sessions
    energyLevel: number; // 1-5 user reported
    sleepQuality: number; // 1-5 user reported
    painOrInjuries: string | null;
  };
  userGoal: "strength" | "hypertrophy" | "fat_loss" | "health";
}

export interface WeeklyAnalysisResponse {
  assessment: string;
  adjustments: {
    volumeChange: string; // e.g., "+10%", "-15%", "no change"
    intensityChange: string;
    exerciseChanges: string[];
    deloadRecommended: boolean;
    reasoning: string;
  };
  encouragement: string;
  focusForNextWeek: string;
}

export function createWeeklyAnalysisPrompt(input: WeeklyAnalysisInput): string {
  return `Analyze the following weekly check-in data for the "${input.programName}" program (Week ${input.weekNumber}):

**Weekly Data:**
- Sessions Completed: ${input.workoutData.sessionsCompleted} / ${input.workoutData.sessionsPlanned}
- Adherence Rate: ${input.workoutData.adherenceRate}%
- Average Session RPE: ${input.workoutData.averageRPE} / 10
- Total Volume: ${input.workoutData.totalVolume}
- Energy Level (1-5): ${input.workoutData.energyLevel}
- Sleep Quality (1-5): ${input.workoutData.sleepQuality}
- Pain or Injuries: ${input.workoutData.painOrInjuries || 'None'}
- User Goal: ${input.userGoal}

**Adjustment Rules:**

1. **Adherence-Based Adjustments:**
   - Adherence < 70%: reduce volume 15-20%, simplify to 3 core lifts per session
   - Adherence 70-85%: maintain current volume, focus on consistency
   - Adherence > 85%: consider progressive overload increases

2. **RPE-Based Adjustments:**
   - All RPE < 7 for 2+ weeks: increase weight next week
   - Average RPE 7-8: optimal for hypertrophy/strength balance
   - Any compound RPE = 10: deload that lift 10% next week
   - Average RPE > 9 for 2+ weeks: reduce volume 15%

3. **Recovery-Based Adjustments:**
   - Energy low (1-2) for 2+ weeks: reduce volume 15%, investigate sleep/nutrition/stress
   - Sleep quality < 3 for 2+ weeks: prioritize recovery, reduce intensity
   - Pain reported: substitute specific exercise, recommend professional eval if persistent

4. **Plateau Detection:**
   - No progress (strength/volume) for 3+ weeks: change exercise variation or rep scheme
   - Consistent progress: continue current approach, consider small increases

**Output Format:**
Provide a JSON response with this structure:
{
  "assessment": "Brief assessment of the week's performance",
  "adjustments": {
    "volumeChange": "percentage change (e.g., '+10%', '-15%', 'no change')",
    "intensityChange": "percentage change or 'no change'",
    "exerciseChanges": ["specific exercise modifications if needed"],
    "deloadRecommended": boolean,
    "reasoning": "Explanation for any adjustments"
  },
  "encouragement": "Motivational message",
  "focusForNextWeek": "One thing to focus on next week"
}

Ensure all JSON is valid and properly formatted.`;
}
