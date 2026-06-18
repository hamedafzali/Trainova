import type {
  Device,
  Exercise,
  Program,
  TemplateExercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from "@/domain/types";

const OWNER = "local-user";

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
  { id: "d-tm", name: "Treadmill", machineNumber: null, category: "cardio", primaryMuscle: "cardio" },
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
  { id: "e-treadmill", name: "Treadmill", deviceId: "d-tm", isCompound: false, muscle: "cardio" },
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
// The user's 16.06.2026 session, the single source of truth for both the plan
// (targets) and the completed history (actuals). reps = 12 throughout.
// ---------------------------------------------------------------------------
const PLAN_REPS = 12;
const PLAN: { exerciseId: string; deviceId: string; weights: number[] }[] = [
  { exerciseId: "e-legpress", deviceId: "d-22", weights: [50, 50, 50] },
  { exerciseId: "e-legcurl", deviceId: "d-25", weights: [27.5, 27.5, 27.5] },
  { exerciseId: "e-legext", deviceId: "d-26", weights: [27.5, 27.5, 27.5] },
  { exerciseId: "e-pulldown", deviceId: "d-4", weights: [35, 40, 35] },
  { exerciseId: "e-row", deviceId: "d-7", weights: [30, 35, 42.5] },
  { exerciseId: "e-chestpress", deviceId: "d-1", weights: [12.5, 20, 20] },
  { exerciseId: "e-backext", deviceId: "d-12", weights: [50, 57.5, 57.5] },
  { exerciseId: "e-abs", deviceId: "d-11", weights: [35, 40, 40] },
];

const CARDIO_NOTE = "Finisher: Treadmill — 20 min, incline 10 → 2.9 mi.";

// ---------------------------------------------------------------------------
// Template — reusable, UNDATED. Per-set ramps from the plan.
// ---------------------------------------------------------------------------
export const SEED_PLAN_ID = "plan-full-body-a";

export const SEED_PLAN: WorkoutTemplate = {
  id: SEED_PLAN_ID,
  owner: OWNER,
  name: "Full Body A",
  notes: CARDIO_NOTE,
  exercises: PLAN.map((p, i): TemplateExercise => ({
    id: `${SEED_PLAN_ID}-${i}`,
    exerciseId: p.exerciseId,
    deviceId: p.deviceId,
    position: i,
    restSeconds: 90,
    sets: p.weights.map((w) => ({ targetReps: PLAN_REPS, targetWeight: w })),
  })),
};

// ---------------------------------------------------------------------------
// Program — multi-day grouping (the trainer's plan).
// ---------------------------------------------------------------------------
export const SEED_PROGRAM_ID = "program-trainer";

export const SEED_PROGRAM: Program = {
  id: SEED_PROGRAM_ID,
  owner: OWNER,
  name: "Trainer Program",
  source: "trainer",
  notes: "Full-body plan from coach — 3×/week.",
  dayTemplateIds: [SEED_PLAN_ID],
};

// ---------------------------------------------------------------------------
// Completed session for 16.06.2026 — gives real "previous" data to build on.
// ---------------------------------------------------------------------------
export const SEED_SESSION_ID = "session-2026-06-16";
const STARTED = "2026-06-16T18:00:00.000Z";
const ENDED = "2026-06-16T18:50:00.000Z";

export const SEED_SESSION: WorkoutSession = {
  id: SEED_SESSION_ID,
  owner: OWNER,
  templateId: SEED_PLAN_ID,
  title: "Full Body A",
  date: "2026-06-16",
  status: "completed",
  startedAt: STARTED,
  completedAt: ENDED,
  reopenedAt: null,
  updatedAt: ENDED,
};

export const SEED_SESSION_SETS: WorkoutSet[] = PLAN.flatMap((p, exIdx) =>
  p.weights.map((w, setIdx) => ({
    id: `sess1606-${exIdx}-${setIdx}`,
    owner: OWNER,
    sessionId: SEED_SESSION_ID,
    exerciseId: p.exerciseId,
    deviceId: p.deviceId,
    setIndex: setIdx,
    targetReps: null,
    targetWeight: w,
    actualReps: null,
    actualWeight: w,
    rpe: null,
    completed: true,
    completedAt: ENDED,
  }))
);
