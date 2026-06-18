import type { Exercise, WorkoutTemplate } from "@/domain/types";

/** Default shared exercise catalog used in local mode (mirrors supabase/seed.sql). */
const GENERIC_EXERCISES: Omit<Exercise, "id" | "owner">[] = [
  { name: "Back Squat", primaryMuscle: "quads", equipment: "barbell", isCompound: true },
  { name: "Bench Press", primaryMuscle: "chest", equipment: "barbell", isCompound: true },
  { name: "Deadlift", primaryMuscle: "back", equipment: "barbell", isCompound: true },
  { name: "Overhead Press", primaryMuscle: "shoulders", equipment: "barbell", isCompound: true },
  { name: "Barbell Row", primaryMuscle: "back", equipment: "barbell", isCompound: true },
  { name: "Pull-up", primaryMuscle: "back", equipment: "bodyweight", isCompound: true },
  { name: "Romanian Deadlift", primaryMuscle: "hamstrings", equipment: "barbell", isCompound: true },
  { name: "Lat Pulldown", primaryMuscle: "back", equipment: "cable", isCompound: false },
  { name: "Dumbbell Curl", primaryMuscle: "biceps", equipment: "dumbbell", isCompound: false },
  { name: "Triceps Pushdown", primaryMuscle: "triceps", equipment: "cable", isCompound: false },
  { name: "Leg Press", primaryMuscle: "quads", equipment: "machine", isCompound: true },
  { name: "Lateral Raise", primaryMuscle: "shoulders", equipment: "dumbbell", isCompound: false },
];

/**
 * Machines from the user's gym, keyed by their floor number so the catalog matches
 * the equipment in front of them. Stable ids let the seed plan reference them.
 */
export const GYM_MACHINES: Exercise[] = [
  { id: "m-22", name: "Leg Press (No.22)", primaryMuscle: "quads", equipment: "machine", isCompound: true },
  { id: "m-25", name: "Seated Leg Curl (No.25)", primaryMuscle: "hamstrings", equipment: "machine", isCompound: false },
  { id: "m-26", name: "Seated Leg Extension (No.26)", primaryMuscle: "quads", equipment: "machine", isCompound: false },
  { id: "m-4", name: "Pulldown (No.4)", primaryMuscle: "back", equipment: "machine", isCompound: false },
  { id: "m-7", name: "Row (No.7)", primaryMuscle: "back", equipment: "machine", isCompound: false },
  { id: "m-1", name: "Chest Press (No.1)", primaryMuscle: "chest", equipment: "machine", isCompound: true },
  { id: "m-12", name: "Back Extension (No.12)", primaryMuscle: "lower back", equipment: "machine", isCompound: false },
  { id: "m-11", name: "Abdominal (No.11)", primaryMuscle: "abs", equipment: "machine", isCompound: false },
].map((e) => ({ ...e, owner: null }));

export const SEED_EXERCISES: Exercise[] = [
  ...GENERIC_EXERCISES.map((e, i) => ({ ...e, id: `seed-${i + 1}`, owner: null })),
  ...GYM_MACHINES,
];

/** Stable id so the seeding migration is idempotent. */
export const SEED_PLAN_ID = "plan-gymplan-1606";

/**
 * The user's current gym plan (16.06). Target weight is the top working set from
 * the plan so the first session starts there; reps default to 12 for machine work.
 */
export const SEED_PLAN: WorkoutTemplate = {
  id: SEED_PLAN_ID,
  owner: "local-user",
  name: "Gym Plan — 16.06",
  notes: "Finisher: Cardio — 20 min, incline 10 → ~2.9 mi.",
  exercises: [
    { exerciseId: "m-22", targetWeight: 50 },
    { exerciseId: "m-25", targetWeight: 27.5 },
    { exerciseId: "m-26", targetWeight: 27.5 },
    { exerciseId: "m-4", targetWeight: 40 },
    { exerciseId: "m-7", targetWeight: 42.5 },
    { exerciseId: "m-1", targetWeight: 20 },
    { exerciseId: "m-12", targetWeight: 57.5 },
    { exerciseId: "m-11", targetWeight: 40 },
  ].map((e, i) => ({
    id: `${SEED_PLAN_ID}-${i}`,
    exerciseId: e.exerciseId,
    position: i,
    targetSets: 3,
    targetReps: 12,
    targetWeight: e.targetWeight,
    restSeconds: 90,
  })),
};
