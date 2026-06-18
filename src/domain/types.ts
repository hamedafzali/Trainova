// Core domain types. Pure data shapes shared by the UI and the data layer.
// See ARCHITECTURE.md for the design rationale.

export type Units = "kg" | "lb";

export interface Profile {
  id: string;
  displayName: string | null;
  units: Units;
}

// ---------------------------------------------------------------------------
// Equipment — structured first-class entity (replaces free-text `equipment`).
// ---------------------------------------------------------------------------
export type DeviceCategory = "machine" | "free_weight" | "cable" | "bodyweight" | "cardio";

export interface Device {
  id: string;
  owner: string | null; // null = shared library
  name: string; // "Leg Press" — NO number in the name
  machineNumber: string | null; // "22" — structured, optional
  category: DeviceCategory;
  imageUrl: string | null;
  primaryMuscle: string | null;
}

// ---------------------------------------------------------------------------
// Movement — the loggable exercise, linked to a default Device.
// ---------------------------------------------------------------------------
export interface Exercise {
  id: string;
  owner: string | null;
  name: string;
  defaultDeviceId: string | null; // structured link, not text
  isCompound: boolean;
  primaryMuscle: string | null;
}

// ---------------------------------------------------------------------------
// Definition — reusable, UNDATED template.
// ---------------------------------------------------------------------------
export interface TemplateSet {
  targetReps: number;
  targetWeight: number | null;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  deviceId: string | null; // device assigned in this template
  position: number;
  sets: TemplateSet[]; // per-set targets → supports ramps (30×12, 35×12, 42.5×12)
  restSeconds: number;
}

export interface WorkoutTemplate {
  id: string;
  owner: string;
  name: string; // INVARIANT: no dates
  notes: string | null;
  exercises: TemplateExercise[];
}

/**
 * A multi-day plan — e.g. the program a trainer hands you. Groups ordered day
 * templates (Day A / B / C) under one name.
 */
export interface Program {
  id: string;
  owner: string;
  name: string;
  source: "trainer" | "self";
  notes: string | null;
  dayTemplateIds: string[];
}

// ---------------------------------------------------------------------------
// Execution — dated instance with an explicit lifecycle.
// ---------------------------------------------------------------------------
export type SessionStatus = "active" | "completed" | "archived";

export interface WorkoutSession {
  id: string;
  owner: string;
  templateId: string | null; // null = free-form
  title: string; // snapshot of template name at start
  date: string; // YYYY-MM-DD — the calendar key
  status: SessionStatus; // explicit; replaces "endedAt === null"
  startedAt: string; // ISO
  completedAt: string | null;
  reopenedAt: string | null; // audit for completed→active edits
  updatedAt: string;
}

export interface WorkoutSet {
  id: string;
  owner: string;
  sessionId: string;
  exerciseId: string;
  deviceId: string | null;
  setIndex: number;
  targetReps: number | null; // snapshot from template at start
  targetWeight: number | null;
  actualReps: number | null;
  actualWeight: number | null;
  rpe: number | null;
  completed: boolean;
  completedAt: string | null;
}

export type PrKind = "e1rm" | "max_weight" | "max_reps";

export interface PersonalRecord {
  exerciseId: string;
  kind: PrKind;
  value: number;
  achievedAt: string;
}
