import type {
  Device,
  Exercise,
  Program,
  TemplateExercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from "@/domain/types";

import { LIBRARY_DEVICES } from "@/data/devices";
import { LIBRARY_EXERCISES } from "@/data/exercises";

const OWNER = "local-user";

// The shared library lives in src/data. New installs start with it and no
// personal data; the legacy plan/session below only feed the v2 migration for
// installs that already had them.
export const SEED_DEVICES: Device[] = LIBRARY_DEVICES;
export const SEED_EXERCISES: Exercise[] = LIBRARY_EXERCISES;

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
  exercises: [
    ...PLAN.map(
      (p, i): TemplateExercise => ({
        id: `${SEED_PLAN_ID}-${i}`,
        exerciseId: p.exerciseId,
        deviceId: p.deviceId,
        position: i,
        restSeconds: 90,
        sets: p.weights.map((w) => ({ targetReps: PLAN_REPS, targetWeight: w })),
      })
    ),
    // Cardio finisher — logged with minutes/speed/incline (cardio device).
    {
      id: `${SEED_PLAN_ID}-cardio`,
      exerciseId: "e-treadmill",
      deviceId: "d-tm",
      position: PLAN.length,
      restSeconds: 0,
      sets: [{ targetReps: 20, targetWeight: null }],
    },
  ],
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
    actualReps: PLAN_REPS,
    actualWeight: w,
    rpe: null,
    completed: true,
    completedAt: ENDED,
  }))
);
