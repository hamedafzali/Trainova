import type {
  Device,
  Exercise,
  Program,
  TemplateExercise,
  WorkoutTemplate,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Devices — structured equipment library (machine numbers are data, not text).
// ---------------------------------------------------------------------------
const DEVICE_DEFS: Omit<Device, "owner" | "imageUrl">[] = [
  { id: "d-22", name: "Leg Press", machineNumber: "22", category: "machine", primaryMuscle: "quads" },
  { id: "d-25", name: "Seated Leg Curl", machineNumber: "25", category: "machine", primaryMuscle: "hamstrings" },
  { id: "d-26", name: "Seated Leg Extension", machineNumber: "26", category: "machine", primaryMuscle: "quads" },
  { id: "d-4", name: "Lat Pulldown", machineNumber: "4", category: "machine", primaryMuscle: "back" },
  { id: "d-7", name: "Seated Row", machineNumber: "7", category: "machine", primaryMuscle: "back" },
  { id: "d-1", name: "Chest Press", machineNumber: "1", category: "machine", primaryMuscle: "chest" },
  { id: "d-12", name: "Back Extension", machineNumber: "12", category: "machine", primaryMuscle: "lower back" },
  { id: "d-11", name: "Abdominal", machineNumber: "11", category: "machine", primaryMuscle: "abs" },
  { id: "d-bb", name: "Barbell", machineNumber: null, category: "free_weight", primaryMuscle: null },
  { id: "d-db", name: "Dumbbell", machineNumber: null, category: "free_weight", primaryMuscle: null },
  { id: "d-cable", name: "Cable Tower", machineNumber: null, category: "cable", primaryMuscle: null },
  { id: "d-pull", name: "Pull-up Bar", machineNumber: null, category: "bodyweight", primaryMuscle: null },
];

export const SEED_DEVICES: Device[] = DEVICE_DEFS.map((d) => ({
  ...d,
  owner: null,
  imageUrl: `/devices/${d.id}.svg`,
}));

// ---------------------------------------------------------------------------
// Exercises — movements linked to a default device.
// ---------------------------------------------------------------------------
type SeedEx = { id: string; name: string; deviceId: string | null; isCompound: boolean; muscle: string | null };
const EXS: SeedEx[] = [
  { id: "e-legpress", name: "Leg Press", deviceId: "d-22", isCompound: true, muscle: "quads" },
  { id: "e-legcurl", name: "Seated Leg Curl", deviceId: "d-25", isCompound: false, muscle: "hamstrings" },
  { id: "e-legext", name: "Seated Leg Extension", deviceId: "d-26", isCompound: false, muscle: "quads" },
  { id: "e-pulldown", name: "Lat Pulldown", deviceId: "d-4", isCompound: false, muscle: "back" },
  { id: "e-row", name: "Seated Row", deviceId: "d-7", isCompound: false, muscle: "back" },
  { id: "e-chestpress", name: "Chest Press", deviceId: "d-1", isCompound: true, muscle: "chest" },
  { id: "e-backext", name: "Back Extension", deviceId: "d-12", isCompound: false, muscle: "lower back" },
  { id: "e-abs", name: "Abdominal", deviceId: "d-11", isCompound: false, muscle: "abs" },
  { id: "e-squat", name: "Back Squat", deviceId: "d-bb", isCompound: true, muscle: "quads" },
  { id: "e-bench", name: "Bench Press", deviceId: "d-bb", isCompound: true, muscle: "chest" },
  { id: "e-deadlift", name: "Deadlift", deviceId: "d-bb", isCompound: true, muscle: "back" },
  { id: "e-ohp", name: "Overhead Press", deviceId: "d-bb", isCompound: true, muscle: "shoulders" },
  { id: "e-curl", name: "Dumbbell Curl", deviceId: "d-db", isCompound: false, muscle: "biceps" },
  { id: "e-pullup", name: "Pull-up", deviceId: "d-pull", isCompound: true, muscle: "back" },
  { id: "e-lateral", name: "Lateral Raise", deviceId: "d-db", isCompound: false, muscle: "shoulders" },
];

export const SEED_EXERCISES: Exercise[] = EXS.map((e) => ({
  id: e.id,
  owner: null,
  name: e.name,
  defaultDeviceId: e.deviceId,
  isCompound: e.isCompound,
  primaryMuscle: e.muscle,
}));

// ---------------------------------------------------------------------------
// Template — reusable, UNDATED. Encodes the user's exact per-set ramps.
// ---------------------------------------------------------------------------
export const SEED_PLAN_ID = "plan-full-body-a";

const ramp = (
  exerciseId: string,
  deviceId: string,
  weights: number[],
  reps = 12
): Omit<TemplateExercise, "id" | "position"> => ({
  exerciseId,
  deviceId,
  restSeconds: 90,
  sets: weights.map((w) => ({ targetReps: reps, targetWeight: w })),
});

export const SEED_PLAN: WorkoutTemplate = {
  id: SEED_PLAN_ID,
  owner: "local-user",
  name: "Full Body A",
  notes: "From coach. Finisher: Cardio — 20 min, incline 10 → ~2.9 mi.",
  exercises: [
    ramp("e-legpress", "d-22", [50, 50, 50]),
    ramp("e-legcurl", "d-25", [27.5, 27.5, 27.5]),
    ramp("e-legext", "d-26", [27.5, 27.5, 27.5]),
    ramp("e-pulldown", "d-4", [35, 40, 35]),
    ramp("e-row", "d-7", [30, 35, 42.5]),
    ramp("e-chestpress", "d-1", [12.5, 20, 20]),
    ramp("e-backext", "d-12", [50, 57.5, 57.5]),
    ramp("e-abs", "d-11", [35, 40, 40]),
  ].map((e, i) => ({ ...e, id: `${SEED_PLAN_ID}-${i}`, position: i })),
};

// ---------------------------------------------------------------------------
// Program — multi-day grouping (the trainer's plan).
// ---------------------------------------------------------------------------
export const SEED_PROGRAM_ID = "program-trainer";

export const SEED_PROGRAM: Program = {
  id: SEED_PROGRAM_ID,
  owner: "local-user",
  name: "Trainer Program",
  source: "trainer",
  notes: "Full-body plan from coach — 3×/week.",
  dayTemplateIds: [SEED_PLAN_ID],
};
