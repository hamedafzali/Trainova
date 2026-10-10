// Controlled vocabularies for the exercise library. Mirrors what leading
// trackers (Hevy/Strong) expose: a logging type per exercise, structured
// equipment, and a fixed primary/secondary muscle list — so filters, charts and
// coaching all agree on the same names instead of free text.

/** How a set of this exercise is logged. */
export type ExerciseType =
  | "weight_reps" // load × reps (barbell, machine, cable…)
  | "bodyweight_reps" // reps only (push-up, crunch)
  | "weighted_bodyweight" // added load × reps (weighted dip/pull-up)
  | "assisted_bodyweight" // counter-weight × reps (assisted pull-up machine)
  | "duration" // timed hold (plank, dead hang)
  | "cardio"; // minutes / speed / incline / distance

export const EXERCISE_TYPES: { key: ExerciseType; label: string }[] = [
  { key: "weight_reps", label: "Weight & reps" },
  { key: "bodyweight_reps", label: "Bodyweight reps" },
  { key: "weighted_bodyweight", label: "Weighted bodyweight" },
  { key: "assisted_bodyweight", label: "Assisted bodyweight" },
  { key: "duration", label: "Duration" },
  { key: "cardio", label: "Cardio" },
];

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "plate_loaded"
  | "cable"
  | "smith"
  | "ez_bar"
  | "trap_bar"
  | "band"
  | "bodyweight"
  | "cardio_machine"
  | "other";

export const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: "barbell", label: "Barbell" },
  { key: "dumbbell", label: "Dumbbell" },
  { key: "machine", label: "Machine" },
  { key: "plate_loaded", label: "Plate-loaded" },
  { key: "cable", label: "Cable" },
  { key: "smith", label: "Smith machine" },
  { key: "kettlebell", label: "Kettlebell" },
  { key: "ez_bar", label: "EZ bar" },
  { key: "trap_bar", label: "Trap bar" },
  { key: "band", label: "Band" },
  { key: "bodyweight", label: "Bodyweight" },
  { key: "cardio_machine", label: "Cardio" },
  { key: "other", label: "Other" },
];

export type Muscle =
  | "chest"
  | "shoulders"
  | "rear delts"
  | "triceps"
  | "biceps"
  | "forearms"
  | "lats"
  | "upper back"
  | "traps"
  | "lower back"
  | "abs"
  | "obliques"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "abductors"
  | "calves"
  | "full body"
  | "cardio";

export const MUSCLES: Muscle[] = [
  "chest",
  "shoulders",
  "rear delts",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "upper back",
  "traps",
  "lower back",
  "abs",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "calves",
  "full body",
  "cardio",
];

/** Coarse body region used for filter chips and weekly-volume charts. */
export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "core" | "legs" | "cardio" | "other";

export const MUSCLE_GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
  { key: "legs", label: "Legs" },
  { key: "cardio", label: "Cardio" },
];

/**
 * Map any muscle string (including legacy free text such as "back" or
 * "lower back") to its region. Unknown values fall back to "other".
 */
export function muscleGroupOf(muscle: string | null | undefined): MuscleGroup {
  const m = (muscle ?? "").toLowerCase();
  if (!m) return "other";
  if (/cardio/.test(m)) return "cardio";
  if (/chest|pec/.test(m)) return "chest";
  if (/rear delt|shoulder|delt/.test(m)) return "shoulders";
  if (/bicep|tricep|forearm|arm/.test(m)) return "arms";
  if (/abs|ab$|oblique|core/.test(m)) return "core";
  if (/lat|back|trap|row/.test(m)) return "back";
  if (/quad|ham|glute|calf|calves|adductor|abductor|leg/.test(m)) return "legs";
  return "other";
}

/** Normalise legacy free-text muscles to the controlled vocabulary. */
export function normaliseMuscle(muscle: string | null | undefined): Muscle | null {
  if (!muscle) return null;
  const m = muscle.trim().toLowerCase();
  if ((MUSCLES as string[]).includes(m)) return m as Muscle;
  if (m === "back") return "upper back";
  if (m === "legs" || m === "leg") return "quads";
  if (m === "core") return "abs";
  if (m === "arms") return "biceps";
  if (m === "delts") return "shoulders";
  return null;
}

export function label(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export type SetKind = "normal" | "warmup" | "drop" | "failure";

export const SET_KINDS: { key: SetKind; short: string; label: string }[] = [
  { key: "normal", short: "", label: "Working" },
  { key: "warmup", short: "W", label: "Warm-up" },
  { key: "drop", short: "D", label: "Drop set" },
  { key: "failure", short: "F", label: "To failure" },
];
