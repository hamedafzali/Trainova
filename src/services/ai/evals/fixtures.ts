// Named inputs for the AI eval dataset. Each builds the same deterministic
// evidence on every run, so the dataset's canned model replies can cite its
// fact ids and numbers.

import type { AnalystInput } from "@/domain/analyst";
import type { ExerciseCoachInput } from "@/domain/exerciseCoach";
import { buildTrainerContext, type TrainerContext } from "@/domain/trainer";
import type { Device, Exercise, Program, WorkoutSession, WorkoutSet, WorkoutTemplate } from "@/domain/types";
import { LIBRARY_EXERCISES } from "@/data/exercises";
import type { CoachIntroInput, MealIdeasInput } from "../prompts/coach";

export const EVAL_TODAY = "2026-08-28";

const ex = (id: string, name: string, primaryMuscle: string, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  owner: null,
  name,
  defaultDeviceId: null,
  isCompound: true,
  primaryMuscle,
  ...extra,
});

const session = (id: string, date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  owner: "u",
  templateId: null,
  title: "W",
  date,
  status: "completed",
  startedAt: `${date}T10:00:00Z`,
  completedAt: `${date}T11:00:00Z`,
  reopenedAt: null,
  updatedAt: `${date}T11:00:00Z`,
  ...extra,
});

/** [kg, reps, rpe?, completed?] */
type S = [number | null, number | null, number?, boolean?];
const sets = (sessionId: string, exerciseId: string, list: S[], deviceId: string | null = null): WorkoutSet[] =>
  list.map(([w, r, rpe, completed], i) => ({
    id: `${sessionId}-${exerciseId}-${i}`,
    owner: "u",
    sessionId,
    exerciseId,
    deviceId,
    setIndex: i,
    targetReps: null,
    targetWeight: null,
    actualReps: r,
    actualWeight: w,
    rpe: rpe ?? null,
    completed: completed ?? true,
    completedAt: completed === false ? null : `2026-08-28T10:20:00Z`,
  }));

// ---------------------------------------------------------------------------
// Analyst

function analystLog(workouts: [string, [string, number, number][]][]): AnalystInput {
  const sessions = workouts.map(([date], i) => session(`s${i}`, date));
  return {
    sessions,
    sets: workouts.flatMap(([, list], i) => list.flatMap(([id, w, r], j) => sets(`s${i}`, id, [[w, r]]).map((x) => ({ ...x, id: `s${i}-${j}`, setIndex: j })))),
    exercises: [ex("squat", "Back Squat", "quads"), ex("bench", "Bench Press", "chest"), ex("row", "Row", "lats")],
    devices: [],
    units: "kg",
    coaching: { daysPerWeek: 3 } as AnalystInput["coaching"],
  };
}

export const ANALYST_FIXTURES: Record<string, { input: AnalystInput; weeks: number }> = {
  /** Squat climbing every week, bench flat, one workout a week against a target of three. */
  squat_up_bench_flat: {
    weeks: 4,
    input: analystLog([
      ["2026-08-03", [["squat", 100, 5], ["bench", 80, 5]]],
      ["2026-08-10", [["squat", 105, 5], ["bench", 80, 5]]],
      ["2026-08-17", [["squat", 110, 5], ["bench", 80, 5]]],
      ["2026-08-24", [["squat", 115, 5], ["bench", 80, 5]]],
      ["2026-07-20", [["squat", 95, 5]]],
    ]),
  },
};

// ---------------------------------------------------------------------------
// Exercise coach

const legPress = {
  id: "d-lp",
  owner: null,
  name: "Leg Press",
  machineNumber: "22",
  category: "machine",
  primaryMuscle: "quads",
  guidance: "Feet shoulder-width on the platform.",
  loading: "stack",
} as Device;

const library: Exercise[] = [
  ex("lp", "Leg Press", "quads", { equipment: "machine", defaultDeviceId: "d-lp", secondaryMuscles: ["glutes"] }),
  ex("squat", "Back Squat", "quads", { equipment: "barbell", secondaryMuscles: ["glutes", "hamstrings"] }),
  ex("goblet", "Goblet Squat", "quads", { equipment: "dumbbell", secondaryMuscles: ["glutes"] }),
  ex("hack", "Hack Squat", "quads", { equipment: "plate_loaded" }),
  ex("ext", "Leg Extension", "quads", { equipment: "machine", isCompound: false }),
];

const legDay = {
  id: "t1",
  owner: "u",
  name: "Legs",
  notes: null,
  exercises: [
    {
      exerciseId: "lp",
      deviceId: "d-lp",
      sets: [
        { targetReps: 8, targetWeight: 100 },
        { targetReps: 8, targetWeight: 100 },
        { targetReps: 8, targetWeight: 100 },
      ],
      restSeconds: 120,
      targetRpe: 8,
      repMax: 10,
      cue: "Control the bottom",
      substitution: "Hack Squat",
    },
  ],
} as WorkoutTemplate;

function liveLegPress(today: S[]): ExerciseCoachInput {
  return {
    sessions: [
      session("old1", "2026-08-14"),
      session("old2", "2026-08-21"),
      session("now", "2026-08-28", { status: "active", templateId: "t1", completedAt: null }),
    ],
    sets: [
      ...sets("old1", "lp", [[90, 10], [90, 9]], "d-lp"),
      ...sets("old2", "lp", [[95, 9], [95, 8]], "d-lp"),
      ...sets("now", "lp", today, "d-lp"),
    ],
    exercises: library,
    devices: [legPress],
    templates: [legDay],
    units: "kg",
    coaching: null,
  };
}

export const EXERCISE_FIXTURES: Record<string, { input: ExerciseCoachInput; sessionId: string; exerciseId: string }> = {
  /** First working set landed in range at the target RPE. */
  leg_press_on_target: { input: liveLegPress([[100, 8, 8]]), sessionId: "now", exerciseId: "lp" },
  /** First set was a near-max grind: the app drops a plate. */
  leg_press_near_max: { input: liveLegPress([[100, 8, 10]]), sessionId: "now", exerciseId: "lp" },
  /** Easy set past the range, but a poor check-in: the app holds the load. */
  leg_press_low_readiness: {
    input: {
      ...liveLegPress([[100, 13, 6]]),
      checkIns: [{ id: "c1", date: "2026-08-28", sleep: 1, energy: 2, soreness: 5, stress: 4, updatedAt: "2026-08-28T07:00:00Z" }],
    },
    sessionId: "now",
    exerciseId: "lp",
  },
};

// ---------------------------------------------------------------------------
// Trainer

const tpl = (id: string, name: string, exerciseIds: string[]): WorkoutTemplate => ({
  id,
  owner: "u",
  name,
  notes: null,
  exercises: exerciseIds.map((exerciseId, i) => ({
    id: `${id}-te${i}`,
    exerciseId,
    deviceId: null,
    position: i,
    restSeconds: 90,
    sets: [
      { targetReps: 8, targetWeight: 60 },
      { targetReps: 8, targetWeight: 60 },
    ],
  })),
});

function starterContext(pain: string | null = null): TrainerContext {
  const templates = [tpl("dayA", "Day A", ["e-squat", "e-bench", "e-plank"])];
  const programs: Program[] = [{ id: "p", owner: "u", name: "Starter", source: "library", notes: null, dayTemplateIds: ["dayA"] }];
  return buildTrainerContext({
    now: new Date("2026-10-10T12:00:00Z"),
    units: "kg",
    profile: { displayName: null, role: "user", goal: "strength", experience: "beginner", onboarded: true },
    programs,
    templates,
    sessions: [{ ...session("s1", "2026-10-08", { templateId: "dayA", title: "Day A" }) }],
    sets: sets("s1", "e-squat", [[60, 8], [65, 6]]),
    prs: [],
    feedback: pain ? [{ sessionId: "s1", pain } as never] : [],
    exercises: LIBRARY_EXERCISES,
    nextTemplateId: "dayA",
  });
}

export const TRAINER_FIXTURES: Record<string, TrainerContext> = {
  starter: starterContext(),
};

// ---------------------------------------------------------------------------
// Coach intro and meal ideas

export const COACH_INTRO_FIXTURES: Record<string, CoachIntroInput> = {
  steady: { goal: "strength", experience: "beginner", situations: ["Training has been consistent", "Squat is trending up"] },
};

export const MEAL_FIXTURES: Record<string, MealIdeasInput> = {
  cut: { goal: "fat_loss", targetCalories: 2000, proteinG: 160, fatG: 60, carbG: 200, approach: "deficit" },
};
