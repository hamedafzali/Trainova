import type { Program, WorkoutTemplate } from "@/domain/types";

// Curated starter programs. Installing one copies it into the user's own
// programs (source "library") — after that it is theirs to edit.

export type ProgramGoal = "strength" | "hypertrophy" | "fat_loss" | "health";
export type ProgramSetting = "gym" | "machines" | "dumbbells" | "bodyweight";
type Level = "beginner" | "intermediate" | "advanced";

/** [exerciseId, sets, reps (or seconds/minutes for timed/cardio), rest seconds] */
type Slot = [string, number, number, number];

export interface ProgramBlueprint {
  id: string;
  name: string;
  summary: string;
  daysPerWeek: number;
  level: Level;
  goals: ProgramGoal[];
  setting: ProgramSetting;
  minutes: number; // typical session length
  days: { name: string; focus: string; slots: Slot[] }[];
}

export const PROGRAM_BLUEPRINTS: ProgramBlueprint[] = [
  {
    id: "bp-machine-starter",
    name: "Machine Starter",
    summary: "Two simple full-body days on selectorized machines. The safest way to learn the gym and build a base.",
    daysPerWeek: 2,
    level: "beginner",
    goals: ["health", "hypertrophy", "fat_loss"],
    setting: "machines",
    minutes: 45,
    days: [
      {
        name: "Day A",
        focus: "Full body",
        slots: [
          ["e-legpress", 3, 12, 90],
          ["e-chestpress", 3, 12, 90],
          ["e-pulldown", 3, 12, 90],
          ["e-legcurl", 2, 12, 60],
          ["e-shpressm", 2, 12, 60],
          ["e-abs", 2, 15, 60],
        ],
      },
      {
        name: "Day B",
        focus: "Full body",
        slots: [
          ["e-legext", 3, 12, 60],
          ["e-row", 3, 12, 90],
          ["e-inclinepressm", 3, 12, 90],
          ["e-lycurl", 2, 12, 60],
          ["e-backext", 2, 12, 60],
          ["e-treadmill", 1, 15, 0],
        ],
      },
    ],
  },
  {
    id: "bp-fullbody-3",
    name: "Full Body 3×",
    summary: "Three full-body sessions a week built on the big lifts. Classic beginner progression — add weight when you hit all reps.",
    daysPerWeek: 3,
    level: "beginner",
    goals: ["strength", "hypertrophy", "health"],
    setting: "gym",
    minutes: 60,
    days: [
      {
        name: "Day A",
        focus: "Squat · Bench · Row",
        slots: [
          ["e-squat", 3, 8, 150],
          ["e-bench", 3, 8, 150],
          ["e-cablerow", 3, 10, 90],
          ["e-lateral", 2, 15, 60],
          ["e-plank", 3, 45, 60],
        ],
      },
      {
        name: "Day B",
        focus: "Deadlift · Press · Pulldown",
        slots: [
          ["e-rdl", 3, 8, 150],
          ["e-ohp", 3, 8, 120],
          ["e-pulldown", 3, 10, 90],
          ["e-lunge", 2, 10, 90],
          ["e-curl", 2, 12, 60],
        ],
      },
      {
        name: "Day C",
        focus: "Leg press · Incline · Row",
        slots: [
          ["e-legpress", 3, 10, 120],
          ["e-dbincline", 3, 10, 90],
          ["e-dbrow", 3, 10, 90],
          ["e-legcurl", 2, 12, 60],
          ["e-pushdown", 2, 12, 60],
        ],
      },
    ],
  },
  {
    id: "bp-upper-lower-4",
    name: "Upper / Lower",
    summary: "Four days split between upper and lower body — more volume per muscle for steady size and strength gains.",
    daysPerWeek: 4,
    level: "intermediate",
    goals: ["hypertrophy", "strength"],
    setting: "gym",
    minutes: 65,
    days: [
      {
        name: "Upper 1",
        focus: "Strength",
        slots: [
          ["e-bench", 4, 6, 180],
          ["e-bbrow", 4, 8, 120],
          ["e-dbpress", 3, 10, 90],
          ["e-pulldown", 3, 10, 90],
          ["e-pushdown", 2, 12, 60],
          ["e-hammercurl", 2, 12, 60],
        ],
      },
      {
        name: "Lower 1",
        focus: "Strength",
        slots: [
          ["e-squat", 4, 6, 180],
          ["e-rdl", 3, 8, 150],
          ["e-legpress", 3, 12, 120],
          ["e-legcurl", 3, 12, 60],
          ["e-calfraise", 3, 12, 60],
        ],
      },
      {
        name: "Upper 2",
        focus: "Volume",
        slots: [
          ["e-ohp", 3, 8, 150],
          ["e-pullup", 3, 8, 120],
          ["e-dbincline", 3, 10, 90],
          ["e-cablerow", 3, 12, 90],
          ["e-lateral", 3, 15, 60],
          ["e-facepull", 2, 15, 60],
        ],
      },
      {
        name: "Lower 2",
        focus: "Volume",
        slots: [
          ["e-deadlift", 3, 5, 180],
          ["e-splitsquat", 3, 10, 90],
          ["e-legext", 3, 12, 60],
          ["e-lycurl", 3, 12, 60],
          ["e-cablecrunch", 3, 15, 60],
        ],
      },
    ],
  },
  {
    id: "bp-ppl",
    name: "Push / Pull / Legs",
    summary: "The classic bodybuilding split. Run it 3× a week, or twice through for 6 days if you recover well.",
    daysPerWeek: 3,
    level: "intermediate",
    goals: ["hypertrophy"],
    setting: "gym",
    minutes: 70,
    days: [
      {
        name: "Push",
        focus: "Chest · Shoulders · Triceps",
        slots: [
          ["e-bench", 4, 8, 150],
          ["e-dbincline", 3, 10, 90],
          ["e-shpressm", 3, 10, 90],
          ["e-cablefly", 3, 12, 60],
          ["e-lateral", 3, 15, 60],
          ["e-pushdown", 3, 12, 60],
        ],
      },
      {
        name: "Pull",
        focus: "Back · Rear delts · Biceps",
        slots: [
          ["e-pullup", 3, 8, 120],
          ["e-bbrow", 3, 8, 120],
          ["e-pulldown", 3, 10, 90],
          ["e-facepull", 3, 15, 60],
          ["e-curl", 3, 12, 60],
          ["e-hammercurl", 2, 12, 60],
        ],
      },
      {
        name: "Legs",
        focus: "Quads · Hamstrings · Calves",
        slots: [
          ["e-squat", 4, 8, 180],
          ["e-rdl", 3, 10, 150],
          ["e-legpress", 3, 12, 120],
          ["e-legcurl", 3, 12, 60],
          ["e-calfraise", 4, 12, 60],
          ["e-legraise", 3, 12, 60],
        ],
      },
    ],
  },
  {
    id: "bp-dumbbell",
    name: "Dumbbells Only",
    summary: "Three full-body days that only need a pair of dumbbells and a bench — great for home or a crowded gym.",
    daysPerWeek: 3,
    level: "beginner",
    goals: ["hypertrophy", "health", "fat_loss"],
    setting: "dumbbells",
    minutes: 45,
    days: [
      {
        name: "Day A",
        focus: "Full body",
        slots: [
          ["e-gobletsquat", 3, 12, 90],
          ["e-dbbench", 3, 10, 90],
          ["e-dbrow", 3, 10, 60],
          ["e-lateral", 2, 15, 60],
          ["e-plank", 3, 40, 45],
        ],
      },
      {
        name: "Day B",
        focus: "Full body",
        slots: [
          ["e-dbrdl", 3, 10, 90],
          ["e-dbpress", 3, 10, 90],
          ["e-lunge", 3, 10, 90],
          ["e-curl", 2, 12, 60],
          ["e-dbohext", 2, 12, 60],
        ],
      },
      {
        name: "Day C",
        focus: "Full body",
        slots: [
          ["e-splitsquat", 3, 10, 90],
          ["e-dbincline", 3, 10, 90],
          ["e-dbreversefly", 3, 15, 60],
          ["e-stepup", 2, 12, 60],
          ["e-hammercurl", 2, 12, 60],
        ],
      },
    ],
  },
  {
    id: "bp-fatloss-circuit",
    name: "Fat-Loss Circuit",
    summary: "Short rests and full-body moves to keep your heart rate up, finished with steady cardio.",
    daysPerWeek: 3,
    level: "beginner",
    goals: ["fat_loss", "health"],
    setting: "gym",
    minutes: 45,
    days: [
      {
        name: "Circuit A",
        focus: "Full body + cardio",
        slots: [
          ["e-gobletsquat", 3, 15, 45],
          ["e-pushup", 3, 12, 45],
          ["e-cablerow", 3, 15, 45],
          ["e-kbswing", 3, 15, 45],
          ["e-mountain", 3, 30, 30],
          ["e-bike", 1, 15, 0],
        ],
      },
      {
        name: "Circuit B",
        focus: "Full body + cardio",
        slots: [
          ["e-legpress", 3, 15, 45],
          ["e-chestpress", 3, 15, 45],
          ["e-pulldown", 3, 15, 45],
          ["e-lunge", 3, 12, 45],
          ["e-plank", 3, 40, 30],
          ["e-treadmill", 1, 20, 0],
        ],
      },
      {
        name: "Circuit C",
        focus: "Full body + cardio",
        slots: [
          ["e-thruster", 3, 12, 45],
          ["e-dbrow", 3, 12, 45],
          ["e-glutebridge", 3, 15, 45],
          ["e-burpee", 3, 10, 45],
          ["e-russiantwist", 3, 20, 30],
          ["e-rower", 1, 12, 0],
        ],
      },
    ],
  },
  {
    id: "bp-bodyweight",
    name: "Bodyweight Basics",
    summary: "No equipment needed. Three short sessions to build the foundations anywhere.",
    daysPerWeek: 3,
    level: "beginner",
    goals: ["health", "fat_loss"],
    setting: "bodyweight",
    minutes: 30,
    days: [
      {
        name: "Day A",
        focus: "Full body",
        slots: [
          ["e-bwsquat", 3, 15, 60],
          ["e-pushup", 3, 10, 60],
          ["e-glutebridge", 3, 15, 45],
          ["e-plank", 3, 30, 45],
        ],
      },
      {
        name: "Day B",
        focus: "Full body",
        slots: [
          ["e-bwsquat", 3, 20, 60],
          ["e-benchdip", 3, 10, 60],
          ["e-deadbug", 3, 12, 45],
          ["e-sideplank", 2, 30, 45],
        ],
      },
      {
        name: "Day C",
        focus: "Conditioning",
        slots: [
          ["e-burpee", 3, 8, 60],
          ["e-mountain", 3, 30, 45],
          ["e-glutebridge", 3, 20, 45],
          ["e-hollow", 3, 20, 45],
        ],
      },
    ],
  },
];

export function blueprintById(id: string): ProgramBlueprint | undefined {
  return PROGRAM_BLUEPRINTS.find((b) => b.id === id);
}

/**
 * Pick the best-fitting starter program for a profile. Scores goal match,
 * level, training days and equipment; ties keep catalog order.
 */
export function recommendBlueprint(input: {
  goal?: ProgramGoal | null;
  experience?: Level | null;
  daysPerWeek?: number | null;
  setting?: ProgramSetting | null;
}): ProgramBlueprint {
  let best = PROGRAM_BLUEPRINTS[0];
  let bestScore = -Infinity;
  for (const bp of PROGRAM_BLUEPRINTS) {
    let score = 0;
    if (input.goal && bp.goals.includes(input.goal)) score += bp.goals[0] === input.goal ? 4 : 3;
    if (input.experience) {
      const rank = { beginner: 0, intermediate: 1, advanced: 2 };
      const gap = rank[bp.level] - rank[input.experience];
      score += gap > 0 ? -3 * gap : gap === 0 ? 2 : 1;
    }
    if (input.daysPerWeek) score -= Math.abs(bp.daysPerWeek - input.daysPerWeek);
    if (input.setting) {
      if (bp.setting === input.setting) score += 4;
      // A full gym can run anything; dumbbell/bodyweight users can't run gym plans.
      else if (input.setting !== "gym") score -= 6;
    }
    if (score > bestScore) {
      best = bp;
      bestScore = score;
    }
  }
  return best;
}

/** Materialise a blueprint into a user-owned program + day templates. */
export function buildFromBlueprint(
  bp: ProgramBlueprint,
  owner: string,
  makeId: () => string,
  deviceFor: (exerciseId: string) => string | null
): { program: Program; templates: WorkoutTemplate[] } {
  const templates: WorkoutTemplate[] = bp.days.map((day) => {
    const tid = makeId();
    return {
      id: tid,
      owner,
      name: `${bp.name} · ${day.name}`,
      notes: day.focus,
      exercises: day.slots.map(([exerciseId, sets, reps, rest], i) => ({
        id: `${tid}-${i}`,
        exerciseId,
        deviceId: deviceFor(exerciseId),
        position: i,
        restSeconds: rest,
        sets: Array.from({ length: sets }, () => ({ targetReps: reps, targetWeight: null })),
      })),
    };
  });
  return {
    program: {
      id: makeId(),
      owner,
      name: bp.name,
      source: "library",
      blueprintId: bp.id,
      notes: bp.summary,
      dayTemplateIds: templates.map((t) => t.id),
    },
    templates,
  };
}
