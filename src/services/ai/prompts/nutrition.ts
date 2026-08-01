// Nutrition calculation prompt templates for AI-powered nutrition guidance
// Based on user profile and body composition goals

export interface NutritionInput {
  age: number;
  sex: "male" | "female" | "other";
  height: string; // e.g., "180cm" or "5'11\""
  weight: number; // in kg
  goal: "strength" | "hypertrophy" | "fat_loss" | "health";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  dietaryRestrictions?: string;
  currentDiet?: string;
}

export interface NutritionResponse {
  maintenanceCalories: number;
  targetCalories: number;
  macros: {
    protein: {
      grams: number;
      calories: number;
    };
    fats: {
      grams: number;
      calories: number;
    };
    carbs: {
      grams: number;
      calories: number;
    };
  };
  waterIntake: number; // liters per day
  supplements: {
    creatine: {
      recommended: boolean;
      dosage: string;
    };
    protein: {
      recommended: boolean;
      dosage: string;
    };
  };
  weeklyWeightChangeTarget: string;
  guidelines: string[];
  disclaimer: string;
}

/**
 * Nutrition calculation system prompt
 */
export const NUTRITION_SYSTEM_PROMPT = `You are a registered sports nutritionist. Calculate personalized nutrition targets based on user profile and body composition goals.

Follow these principles:
- Use evidence-based formulas (Mifflin-St Jeor for BMR)
- Prioritize protein for muscle retention/growth
- Ensure adequate healthy fats
- Fill remaining calories with carbohydrates
- Sustainable approach over extreme measures
- Always include medical disclaimer

Your output must be valid JSON following the specified schema.`;

/**
 * Create nutrition calculation prompt
 */
export function createNutritionPrompt(input: NutritionInput): string {
  return `Calculate personalized nutrition targets based on the following user profile:

**User Profile:**
- Age: ${input.age}
- Sex: ${input.sex}
- Height: ${input.height}
- Weight: ${input.weight} kg
- Goal: ${input.goal}
- Activity Level: ${input.activityLevel}
- Dietary Restrictions: ${input.dietaryRestrictions || 'None'}
- Current Diet: ${input.currentDiet || 'Not specified'}

**Calculation Guidelines:**

1. **Basal Metabolic Rate (BMR):**
   - Use Mifflin-St Jeor equation:
     - Male: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5
     - Female: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161

2. **Total Daily Energy Expenditure (TDEE):**
   - Sedentary (little/no exercise): BMR × 1.2
   - Light exercise (1-3 days/week): BMR × 1.375
   - Moderate exercise (3-5 days/week): BMR × 1.55
   - Heavy exercise (6-7 days/week): BMR × 1.725
   - Very heavy exercise (2x/day): BMR × 1.9

3. **Calorie Targets by Goal:**
   - Cutting (fat_loss): TDEE - 300 to 500 calories
   - Bulking (hypertrophy): TDEE + 200 to 300 calories
   - Maintenance (strength/health): TDEE

4. **Macro Distribution:**
   - Protein: 1.6-2.2 g/kg bodyweight (4 cal/g)
   - Fats: 0.6-0.8 g/kg bodyweight minimum (9 cal/g)
   - Carbs: Fill remaining calories (4 cal/g)

5. **Weekly Weight Change Targets:**
   - Cutting: 0.5-1% bodyweight loss per week
   - Bulking: 0.25-0.5% bodyweight gain per week
   - Maintenance: Maintain current weight

6. **Hydration:**
   - Base: 2-3 L/day
   - Additional: 500ml per 30min of exercise

7. **Supplements:**
   - Creatine: 3-5 g/day (optional but recommended for strength/hypertrophy)
   - Protein powder: Optional if protein targets not met through food

**Output Format:**
Provide a JSON response with this structure:
{
  "maintenanceCalories": number (TDEE),
  "targetCalories": number (based on goal),
  "macros": {
    "protein": {
      "grams": number,
      "calories": number
    },
    "fats": {
      "grams": number,
      "calories": number
    },
    "carbs": {
      "grams": number,
      "calories": number
    }
  },
  "waterIntake": number (liters per day),
  "supplements": {
    "creatine": {
      "recommended": boolean,
      "dosage": string
    },
    "protein": {
      "recommended": boolean,
      "dosage": string
    }
  },
  "weeklyWeightChangeTarget": string (e.g., "0.5-1% bodyweight loss per week"),
  "guidelines": [
    "Guideline 1",
    "Guideline 2",
    "Guideline 3"
  ],
  "disclaimer": "Medical disclaimer about consulting healthcare professional"
}

Ensure all JSON is valid and properly formatted. Include the medical disclaimer in the response.`;
}
