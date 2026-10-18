// Validation for a trainer-assigned plan. The payload is stored server-side
// and later imported into the client's local data, so it's checked strictly
// and normalised to the known fields only.

export interface AssignedPlanPayload {
  name: string;
  notes: string | null;
  exercises: {
    name: string;
    muscle: string | null;
    sets: { targetReps: number; targetWeight: number | null }[];
  }[];
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);

/** Returns the cleaned plan, or a human-readable reason it was rejected. */
export function parseAssignedPlan(input: unknown): { plan: AssignedPlanPayload } | { error: string } {
  if (typeof input !== "object" || input === null) return { error: "payload must be an object" };
  const p = input as Record<string, unknown>;
  const name = str(p.name, 120);
  if (!name) return { error: "plan name is required (max 120 characters)" };
  if (p.notes !== undefined && p.notes !== null && (typeof p.notes !== "string" || p.notes.length > 2000)) {
    return { error: "notes must be text (max 2000 characters)" };
  }
  if (!Array.isArray(p.exercises) || p.exercises.length === 0 || p.exercises.length > 40) {
    return { error: "a plan needs 1–40 exercises" };
  }
  const exercises: AssignedPlanPayload["exercises"] = [];
  for (const [i, raw] of p.exercises.entries()) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const exName = str(e.name, 120);
    if (!exName) return { error: `exercise ${i + 1} needs a name` };
    if (!Array.isArray(e.sets) || e.sets.length === 0 || e.sets.length > 20) {
      return { error: `exercise ${i + 1} needs 1–20 sets` };
    }
    const sets: AssignedPlanPayload["exercises"][number]["sets"] = [];
    for (const rawSet of e.sets) {
      const s = (rawSet ?? {}) as Record<string, unknown>;
      const reps = s.targetReps;
      const w = s.targetWeight ?? null;
      if (typeof reps !== "number" || !Number.isInteger(reps) || reps < 0 || reps > 1000) {
        return { error: `exercise ${i + 1}: target reps must be a whole number 0–1000` };
      }
      // Kilograms; negative = assisted.
      if (w !== null && (typeof w !== "number" || !Number.isFinite(w) || w < -500 || w > 1500)) {
        return { error: `exercise ${i + 1}: target weight is out of range` };
      }
      sets.push({ targetReps: reps, targetWeight: w as number | null });
    }
    exercises.push({ name: exName, muscle: str(e.muscle, 60), sets });
  }
  return { plan: { name, notes: typeof p.notes === "string" ? p.notes : null, exercises } };
}
