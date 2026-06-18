import type { Exercise } from "@/domain/types";

/** Default shared exercise catalog used in local mode (mirrors supabase/seed.sql). */
export const SEED_EXERCISES: Exercise[] = [
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
].map((e, i) => ({ ...e, id: `seed-${i + 1}`, owner: null }));
