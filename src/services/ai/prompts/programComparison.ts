// Program comparison and next phase recommendation prompt templates
// Analyzes program history and recommends next training phase

export interface ProgramComparisonInput {
  initialStats: {
    weight: number;
    strength: Record<string, number>; // exerciseId -> max weight
    bodyComposition?: string;
  };
  finalStats: {
    weight: number;
    strength: Record<string, number>; // exerciseId -> max weight
    bodyComposition?: string;
  };
  programDuration: number; // weeks
  programGoal: "strength" | "hypertrophy" | "fat_loss" | "health";
  programName: string;
  adherenceRate: number; // percentage
  userExperience: "beginner" | "intermediate" | "advanced";
  currentGoal: "strength" | "hypertrophy" | "fat_loss" | "health";
}

export interface ProgramComparisonResponse {
  progressSummary: {
    weightChange: number; // kg
    strengthGains: Record<string, number>; // exerciseId -> kg gained
    overallProgress: string; // "excellent", "good", "moderate", "minimal"
  };
  analysis: string;
  nextPhaseRecommendation: {
    action: "continue_same_goal" | "switch_goal" | "deload_then_reload" | "maintain";
    newGoal?: "strength" | "hypertrophy" | "fat_loss" | "health";
    reasoning: string;
  };
  suggestedAdjustments: {
    volumeChange: string;
    intensityChange: string;
    exerciseVariations: string[];
  };
  encouragement: string;
}

/**
 * Program comparison system prompt
 */
export const PROGRAM_COMPARISON_SYSTEM_PROMPT = `You are a professional strength and conditioning coach. Analyze program completion data and recommend the next training phase.

Follow these principles:
- Celebrate progress while being realistic about results
- Consider adherence when evaluating program effectiveness
- Recommend sustainable next steps
- Avoid rapid goal switching unless justified
- Prioritize long-term progress over short-term gains

Your output must be valid JSON following the specified schema.`;

/**
 * Create program comparison prompt
 */
export function createProgramComparisonPrompt(input: ProgramComparisonInput): string {
  const strengthChanges: Record<string, number> = {};
  Object.keys(input.initialStats.strength).forEach(exerciseId => {
    const initial = input.initialStats.strength[exerciseId] || 0;
    const final = input.finalStats.strength[exerciseId] || 0;
    strengthChanges[exerciseId] = final - initial;
  });

  const weightChange = input.finalStats.weight - input.initialStats.weight;

  return `Analyze the following program completion data and recommend the next training phase:

**Program Details:**
- Program Name: ${input.programName}
- Duration: ${input.programDuration} weeks
- Program Goal: ${input.programGoal}
- Adherence Rate: ${input.adherenceRate}%
- User Experience Level: ${input.userExperience}
- Current Goal: ${input.currentGoal}

**Progress Summary:**
- Weight Change: ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg
- Strength Gains:
${Object.entries(strengthChanges)
  .filter(([_, change]) => change !== 0)
  .map(([exerciseId, change]) => `  - ${exerciseId}: ${change > 0 ? '+' : ''}${change.toFixed(1)} kg`)
  .join('\n') || '  - No strength data available'}

**Analysis Guidelines:**

1. **Progress Evaluation:**
   - Excellent: 2-3% bodyweight change in target direction, 10-15%+ strength gains, 85%+ adherence
   - Good: 1-2% bodyweight change, 5-10% strength gains, 70-85% adherence
   - Moderate: 0.5-1% bodyweight change, 2-5% strength gains, 50-70% adherence
   - Minimal: <0.5% bodyweight change, <2% strength gains, <50% adherence

2. **Next Phase Decision Logic:**
   - Continue same goal: Good/excellent progress, goal not yet achieved
   - Switch goal: Goal achieved or plateaued 3+ weeks, ready for new focus
   - Deload then reload: Excellent progress but accumulated fatigue, or moderate progress with high adherence
   - Maintain: Goal achieved, want to maintain current level

3. **Adjustment Recommendations:**
   - If strength gains <5%: Increase volume 10-15% or change exercise variations
   - If adherence <70%: Simplify program, reduce volume 15-20%
   - If progress excellent: Consider progressive overload increases (2.5-5% weight)
   - If plateaued: Change exercise variations or rep schemes

4. **Goal-Specific Considerations:**
   - Strength: Focus on compound lifts, lower rep ranges (3-6), higher intensity
   - Hypertrophy: Focus on volume, moderate rep ranges (8-12), moderate intensity
   - Fat Loss: Focus on maintenance of strength, higher volume, calorie deficit
   - Health: Focus on consistency, balanced training, moderate intensity

**Output Format:**
Provide a JSON response with this structure:
{
  "progressSummary": {
    "weightChange": number (kg, positive for gain, negative for loss),
    "strengthGains": {
      "exerciseId": number (kg gained, positive for gain, negative for loss)
    },
    "overallProgress": "excellent" | "good" | "moderate" | "minimal"
  },
  "analysis": "Brief analysis of program performance and factors",
  "nextPhaseRecommendation": {
    "action": "continue_same_goal" | "switch_goal" | "deload_then_reload" | "maintain",
    "newGoal": "strength" | "hypertrophy" | "fat_loss" | "health" (only if action is switch_goal),
    "reasoning": "Explanation for the recommended action"
  },
  "suggestedAdjustments": {
    "volumeChange": "percentage change (e.g., '+10%', '-15%', 'no change')",
    "intensityChange": "percentage change or 'no change'",
    "exerciseVariations": ["suggested exercise changes"]
  },
  "encouragement": "Motivational message acknowledging progress"
}

Ensure all JSON is valid and properly formatted.`;
}
