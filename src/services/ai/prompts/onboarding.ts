// Onboarding prompt templates for AI-powered user assessment
// Based on the fitness-coach-prompt.md workflow

export interface OnboardingInput {
  goal: string;
  timeline: number;
  experience: string;
  daysPerWeek: number;
  sessionDuration: number;
  equipment: string;
  age: number;
  sex: string;
  height: string;
  weight: string;
  bodyFatPercentage?: number; // Optional body fat %
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    leftArm?: number;
    rightArm?: number;
    leftThigh?: number;
    rightThigh?: number;
  };
  injuries: string;
  sleepQuality: number;
  stressLevel: string;
  nutrition: string;
  enjoyActivities: string;
  hateActivities: string;
  supplements: string;
}

export interface OnboardingResponse {
  program: {
    name: string;
    description: string;
    focus: string;
    split: string;
    sessions: Session[];
  };
  recommendations: {
    nutrition: string;
    recovery: string;
    progression: string;
  };
}

export interface Session {
  day: number;
  focus: string;
  exercises: Exercise[];
  warmup: string[];
  cooldown: string[];
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  tempo?: string;
  rpe: number;
  cue: string;
  substitution?: string;
}

/**
 * Main onboarding system prompt
 */
export const ONBOARDING_SYSTEM_PROMPT = `You are a professional fitness coach with expertise in program design, exercise science, and behavior change. Your role is to create personalized training programs based on comprehensive user assessment.

Follow these principles:
- Evidence-based programming using established training principles
- Progressive overload with appropriate deload periods
- Individualization based on goals, experience, and equipment
- Safety-first approach with proper form cues
- Sustainable habits over extreme measures

Always include a medical disclaimer for fitness-related content.

Your output must be valid JSON following the specified schema.`;

/**
 * User onboarding prompt
 */
export function createOnboardingPrompt(input: OnboardingInput): string {
  return `Create a personalized training program based on the following user profile:

**User Profile:**
- Primary Goal: ${input.goal}
- Timeline: ${input.timeline} weeks
- Training Experience: ${input.experience}
- Available Days per Week: ${input.daysPerWeek}
- Session Duration: ${input.sessionDuration} minutes
- Available Equipment: ${input.equipment}
- Age: ${input.age}
- Sex: ${input.sex}
- Height: ${input.height}
- Current Weight: ${input.weight}
${input.bodyFatPercentage ? `- Body Fat Percentage: ${input.bodyFatPercentage}%` : ""}
${
  input.measurements
    ? `- Measurements: ${Object.entries(input.measurements)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}cm`)
        .join(", ")}`
    : ""
}
- Injuries/Limitations: ${input.injuries || "None"}
- Sleep Quality (1-5): ${input.sleepQuality}
- Stress Level: ${input.stressLevel}
- Nutrition Situation: ${input.nutrition}
- Activities They Enjoy: ${input.enjoyActivities}
- Activities They Hate: ${input.hateActivities}
- Supplements: ${input.supplements || "None"}

**Programming Requirements:**

1. **Split Selection:**
   - 3 days/week: Full Body or Upper/Lower rotation
   - 4 days/week: Upper/Lower
   - 5 days/week: Push/Pull/Legs + Upper or Full Body
   - 6 days/week: Push/Pull/Legs x2

2. **Volume Guidelines:**
   - Beginners (first 4 weeks): 6-10 sets per muscle group per week
   - Intermediate: 10-16 sets per muscle group per week
   - Advanced: 14-20 sets per muscle group per week

3. **Exercise Selection:**
   - Compounds before accessories
   - Each full-body session: vertical push, vertical pull, horizontal push, horizontal pull, knee-dominant, hip-dominant, core
   - Target weak points based on injuries/limitations
   - Minimum 2 core sessions per week
   - Provide a substitution for every main exercise

4. **RPE Scale (RIR-based):**
   - RPE 6 = 4 reps in reserve (easy)
   - RPE 7 = 3 reps in reserve (moderate)
   - RPE 8 = 2 reps in reserve (standard working sets)
   - RPE 9 = 1 rep in reserve (hard - use sparingly)
   - RPE 10 = 0 reps in reserve (max effort - controlled use only)

5. **Rest Periods:**
   - Compounds: 90-120 seconds
   - Isolation: 60-90 seconds

6. **Phasing:**
   - 4-8 weeks: 2 phases (adaptation → progression)
   - 9-12 weeks: 3 phases (adaptation → progression → peak)
   - Over 8 weeks: deload every 4th week (reduce volume by 30-40%, keep intensity similar)

7. **Equipment Adaptations:**
   - Bodyweight only: Use progressions (wall → knee → standard → advanced)
   - Home dumbbells: Higher reps (15-25), single-arm/leg work, tempo
   - Full gym: 5-12 reps compounds, 12-20 isolation, machines for accessories

**Output Format:**
Provide a JSON response with this structure:
{
  "program": {
    "name": "Program name",
    "description": "Brief description of the program approach",
    "focus": "Primary training focus",
    "split": "Training split used",
    "sessions": [
      {
        "day": 1,
        "focus": "Training focus for this day",
        "exercises": [
          {
            "name": "Exercise name",
            "sets": 3,
            "reps": "8-12",
            "rest": 90,
            "tempo": "2-0-2-0 (optional)",
            "rpe": 8,
            "cue": "Form cue or instruction",
            "substitution": "Alternative exercise if needed"
          }
        ],
        "warmup": ["Warmup exercise 1", "Warmup exercise 2"],
        "cooldown": ["Cooldown exercise 1"]
      }
    ]
  },
  "recommendations": {
    "nutrition": "Brief nutrition guidance",
    "recovery": "Recovery recommendations based on sleep/stress",
    "progression": "How to progress this program"
  }
}

Ensure all JSON is valid and properly formatted. Include the medical disclaimer in the recommendations section.`;
}

/**
 * Follow-up question prompt for incomplete onboarding
 */
export function createFollowUpPrompt(
  missingFields: string[],
  currentData: Partial<OnboardingInput>,
): string {
  const missingFieldsList = missingFields.join(", ");
  return `I need more information to create your personalized program. Please provide the following: ${missingFieldsList}.

Current information I have:
${Object.entries(currentData)
  .filter(([_, value]) => value !== undefined && value !== "")
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}

Please respond with the missing information so I can generate your program.`;
}

/**
 * Weekly check-in prompt for program adjustment
 */
export function createWeeklyCheckInPrompt(
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
): string {
  return `Review the following weekly check-in for the "${programName}" program (Week ${weekNumber}):

**Check-in Data:**
- Sessions Completed: ${checkInData.sessionsCompleted} / ${checkInData.sessionsPlanned}
- Average Session RPE: ${checkInData.averageRPE} / 10
- Sleep Quality (1-5): ${checkInData.sleepQuality}
- Energy Level (1-5): ${checkInData.energyLevel}
- Pain or Injuries: ${checkInData.painOrInjuries || "None"}
- Weight: ${checkInData.weight || "Not reported"}
- Weight Changes: ${checkInData.weightChanges || "None reported"}
- What Felt Good: ${checkInData.whatFeltGood}
- What Felt Difficult: ${checkInData.whatFeltDifficult}

**Provide recommendations in JSON format:**
{
  "assessment": "Brief assessment of the week",
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

Consider these adjustment rules:
- Adherence < 70%: reduce volume 15-20%, simplify to 3 core lifts per session
- All RPE < 7 for 2+ weeks: increase weight next week
- Any compound RPE = 10: deload that lift 10% next week
- Pain reported: substitute specific exercise, recommend professional eval if persistent
- Energy low 2+ weeks: reduce volume 15%, investigate sleep/nutrition/stress
- Plateau 3+ weeks: change exercise variation or rep scheme`;
}
