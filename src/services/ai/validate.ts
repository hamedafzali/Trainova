import type { GeneratedWorkout, WorkoutExercise } from "./prompts/workout";

export class AiOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputValidationError";
  }
}

function asText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AiOutputValidationError(`AI response is missing ${field}.`);
  }
  return value.trim();
}

function asNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new AiOutputValidationError(`AI response has an invalid ${field}.`);
  }
  return value;
}

function exercise(value: unknown): WorkoutExercise {
  if (!value || typeof value !== "object") {
    throw new AiOutputValidationError("AI response has an invalid exercise.");
  }
  const item = value as Record<string, unknown>;
  return {
    name: asText(item.name, "exercise name"),
    sets: asNumber(item.sets, "set count", 1, 8),
    reps: asText(item.reps, "rep range"),
    rest: asNumber(item.rest, "rest time", 15, 600),
    ...(typeof item.tempo === "string" ? { tempo: item.tempo.trim() || undefined } : {}),
    rpe: asNumber(item.rpe, "RPE", 1, 10),
    equipment: asText(item.equipment, "equipment"),
    muscleGroup: asText(item.muscleGroup, "muscle group"),
    cue: asText(item.cue, "form cue"),
    ...(typeof item.substitution === "string"
      ? { substitution: item.substitution.trim() || undefined }
      : {}),
  };
}

/** Validates the generated shape before it becomes product data. */
export function validateGeneratedWorkout(value: unknown): GeneratedWorkout {
  if (!value || typeof value !== "object") {
    throw new AiOutputValidationError("AI response must be an object.");
  }
  const workout = value as Record<string, unknown>;
  if (!Array.isArray(workout.exercises) || workout.exercises.length === 0 || workout.exercises.length > 12) {
    throw new AiOutputValidationError("AI response must contain 1–12 exercises.");
  }
  if (!Array.isArray(workout.warmup) || !Array.isArray(workout.cooldown)) {
    throw new AiOutputValidationError("AI response is missing warmup or cooldown details.");
  }

  const instruction = (value: unknown, field: string) => {
    if (!value || typeof value !== "object") {
      throw new AiOutputValidationError(`AI response has an invalid ${field} item.`);
    }
    const item = value as Record<string, unknown>;
    return {
      name: asText(item.name, `${field} name`),
      duration: asText(item.duration, `${field} duration`),
      instructions: asText(item.instructions, `${field} instructions`),
    };
  };

  return {
    name: asText(workout.name, "workout name"),
    description: asText(workout.description, "workout description"),
    duration: asNumber(workout.duration, "duration", 10, 180),
    focus: asText(workout.focus, "focus"),
    exercises: workout.exercises.map(exercise),
    warmup: workout.warmup.map((item) => instruction(item, "warmup")),
    cooldown: workout.cooldown.map((item) => instruction(item, "cooldown")),
  };
}
