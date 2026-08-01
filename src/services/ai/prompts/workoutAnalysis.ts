// Comprehensive workout analysis prompt templates for AI-powered strength/weakness analysis
// Analyzes overall workout data to identify patterns, strengths, weaknesses, and provide actionable insights

export interface WorkoutAnalysisInput {
  userProfile: {
    goal: "strength" | "hypertrophy" | "fat_loss" | "health";
    experience: "beginner" | "intermediate" | "advanced";
    age: number;
    sex: "male" | "female" | "other";
  };
  workoutData: {
    totalWorkouts: number;
    dateRange: string; // e.g., "last 30 days"
    exercises: {
      exerciseId: string;
      exerciseName: string;
      muscleGroup: string;
      totalSets: number;
      totalVolume: number; // weight × reps
      averageRPE: number;
      progressionTrend: "improving" | "stable" | "declining" | "insufficient_data";
      lastWeight: number;
      bestWeight: number;
      consistency: number; // percentage of planned sessions completed
    }[];
    overallStats: {
      totalVolume: number;
      averageSessionRPE: number;
      adherenceRate: number;
      frequency: number; // workouts per week
      restDays: number;
    };
  };
  timeframe: string; // e.g., "last 4 weeks", "last 3 months"
}

export interface WorkoutAnalysisResponse {
  overallAssessment: {
    summary: string;
    performanceLevel: "excellent" | "good" | "moderate" | "needs_improvement";
    keyAchievement: string;
  };
  strengths: {
    category: string; // e.g., "Upper Body Strength", "Consistency", "Volume"
    description: string;
    supportingData: string;
    exercises: string[];
  }[];
  weaknesses: {
    category: string; // e.g., "Lower Body", "Recovery", "Exercise Variety"
    description: string;
    impact: string;
    recommendations: string[];
    exercises: string[];
  }[];
  muscleBalance: {
    balanced: boolean;
    imbalances: {
      muscleGroup: string;
      status: "undertrained" | "overtrained" | "well_balanced";
      recommendation: string;
    }[];
  };
  progressionAnalysis: {
    overallTrend: "gaining" | "maintaining" | "plateaued" | "declining";
    exercisesProgressing: string[];
    exercisesPlateaued: string[];
    exercisesDeclining: string[];
  };
  actionableRecommendations: {
    priority: "high" | "medium" | "low";
    category: string;
    recommendation: string;
    expectedImpact: string;
  }[];
  nextSteps: {
    focusAreas: string[];
    weeklyGoals: string[];
    longTermGoals: string[];
  };
}

export const WORKOUT_ANALYSIS_SYSTEM_PROMPT = `You are a professional strength and conditioning coach and sports scientist. Analyze comprehensive workout data to provide detailed strength/weakness analysis with actionable insights.

Follow these principles:
- Evidence-based analysis using performance metrics
- Identify both strengths to build upon and weaknesses to address
- Consider muscle balance and symmetry
- Account for training age and experience level
- Provide specific, actionable recommendations
- Focus on sustainable long-term progress
- Consider recovery and adherence factors

Your output must be valid JSON following the specified schema.`;

export function createWorkoutAnalysisPrompt(input: WorkoutAnalysisInput): string {
  const topExercises = input.workoutData.exercises.slice(0, 10);
  
  return `Analyze the following comprehensive workout data and provide a detailed strength/weakness analysis:

**User Profile:**
- Goal: ${input.userProfile.goal}
- Experience Level: ${input.userProfile.experience}
- Age: ${input.userProfile.age}
- Sex: ${input.userProfile.sex}

**Workout Overview (${input.timeframe}):**
- Total Workouts: ${input.workoutData.totalWorkouts}
- Overall Volume: ${input.workoutData.overallStats.totalVolume}
- Average Session RPE: ${input.workoutData.overallStats.averageSessionRPE}/10
- Adherence Rate: ${input.workoutData.overallStats.adherenceRate}%
- Training Frequency: ${input.workoutData.overallStats.frequency} workouts/week
- Rest Days: ${input.workoutData.overallStats.restDays}

**Exercise Performance:**
${topExercises.map((ex, idx) => `
${idx + 1}. ${ex.exerciseName} (${ex.muscleGroup})
   - Total Sets: ${ex.totalSets}
   - Total Volume: ${ex.totalVolume}
   - Average RPE: ${ex.averageRPE}/10
   - Progression: ${ex.progressionTrend}
   - Current Weight: ${ex.lastWeight}
   - Best Weight: ${ex.bestWeight}
   - Consistency: ${ex.consistency}%
`).join('\n')}

**Analysis Guidelines:**

1. **Strength Identification:**
   - Look for exercises with consistent progression (improving trend)
   - Identify muscle groups with high volume and good progression
   - Note excellent adherence or consistency patterns
   - Recognize appropriate RPE management for experience level

2. **Weakness Detection:**
   - Identify exercises with declining or stagnant progression
   - Find muscle groups with low volume or frequency
   - Spot poor adherence patterns
   - Detect RPE mismanagement (too high or too low for goals)
   - Note imbalances between opposing muscle groups

3. **Muscle Balance Analysis:**
   - Compare push vs pull exercises
   - Compare upper vs lower body volume
   - Compare left vs right unilateral exercises (if data available)
   - Consider antagonist muscle group balance

4. **Progression Analysis:**
   - Classify overall trend based on majority of exercises
   - Identify specific exercises driving progress
   - Spot plateaus (stable trend for 3+ data points)
   - Flag concerning declines

5. **Recommendation Prioritization:**
   - High: Safety issues, significant imbalances, declining performance
   - Medium: Plateaued exercises, suboptimal adherence
   - Low: Minor optimizations, variety improvements

**Output Format:**
Provide a JSON response with this structure:
{
  "overallAssessment": {
    "summary": "2-3 sentence overall performance summary",
    "performanceLevel": "excellent|good|moderate|needs_improvement",
    "keyAchievement": "Highlight the user's biggest accomplishment"
  },
  "strengths": [
    {
      "category": "e.g., Upper Body Strength, Consistency, Volume Management",
      "description": "Detailed explanation of this strength",
      "supportingData": "Specific metrics supporting this strength",
      "exercises": ["exercise1", "exercise2"]
    }
  ],
  "weaknesses": [
    {
      "category": "e.g., Lower Body, Recovery, Exercise Variety",
      "description": "Detailed explanation of this weakness",
      "impact": "How this weakness affects overall performance",
      "recommendations": ["specific actionable recommendation 1", "recommendation 2"],
      "exercises": ["exercise1", "exercise2"]
    }
  ],
  "muscleBalance": {
    "balanced": boolean,
    "imbalances": [
      {
        "muscleGroup": "e.g., Chest vs Back, Quads vs Hamstrings",
        "status": "undertrained|overtrained|well_balanced",
        "recommendation": "Specific recommendation for this imbalance"
      }
    ]
  },
  "progressionAnalysis": {
    "overallTrend": "gaining|maintaining|plateaued|declining",
    "exercisesProgressing": ["exercise1", "exercise2"],
    "exercisesPlateaued": ["exercise1", "exercise2"],
    "exercisesDeclining": ["exercise1", "exercise2"]
  },
  "actionableRecommendations": [
    {
      "priority": "high|medium|low",
      "category": "e.g., Strength, Hypertrophy, Recovery, Technique",
      "recommendation": "Specific actionable recommendation",
      "expectedImpact": "Expected outcome if followed"
    }
  ],
  "nextSteps": {
    "focusAreas": ["area1", "area2"],
    "weeklyGoals": ["goal1", "goal2"],
    "longTermGoals": ["goal1", "goal2"]
  }
}

Ensure all JSON is valid and properly formatted. Be specific and actionable in your recommendations.`;
}
