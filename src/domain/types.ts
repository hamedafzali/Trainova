// Core domain types. Pure data shapes shared by the UI and the data layer.

export type Units = "kg" | "lb";

export interface Profile {
  id: string;
  displayName: string | null;
  units: Units;
}

export interface Exercise {
  id: string;
  owner: string | null;
  name: string;
  primaryMuscle: string | null;
  equipment: string | null;
  isCompound: boolean;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  restSeconds: number;
}

export interface WorkoutTemplate {
  id: string;
  owner: string;
  name: string;
  notes: string | null;
  exercises: TemplateExercise[];
}

export interface WorkoutSession {
  id: string;
  owner: string;
  templateId: string | null;
  name: string | null;
  startedAt: string; // ISO
  endedAt: string | null;
}

export interface WorkoutSet {
  id: string;
  owner: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  plannedReps: number | null;
  plannedWeight: number | null;
  actualReps: number | null;
  actualWeight: number | null;
  rpe: number | null;
  completed: boolean;
}

export type PrKind = "e1rm" | "max_weight" | "max_reps";

export interface PersonalRecord {
  exerciseId: string;
  kind: PrKind;
  value: number;
  achievedAt: string;
}
