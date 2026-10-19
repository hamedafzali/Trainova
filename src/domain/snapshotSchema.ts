// Server-side validation for the synced per-user document (PUT /api/state).
//
// The client is untrusted: this enforces structure (known keys, record ids,
// array/item limits) and physically plausible numbers before anything is
// persisted. It never rewrites values — a payload either passes or is rejected
// with a reason, so a sync can't silently alter someone's history.

export const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

const RECORD_ARRAYS = {
  devices: 5_000,
  exercises: 5_000,
  programs: 1_000,
  templates: 2_000,
  sessions: 20_000,
  sets: 400_000,
  feedback: 20_000,
  prs: 20_000,
  bodyLog: 20_000,
  checkIns: 5_000,
  audit: 50_000,
  planChanges: 1_000,
} as const;

const ID_RE = /^[\w:.-]{1,128}$/;

export type SnapshotIssue = { path: string; problem: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function finiteIn(v: unknown, min: number, max: number): boolean {
  return v === null || v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
}

export function validateSnapshot(data: unknown): SnapshotIssue[] {
  const issues: SnapshotIssue[] = [];
  const add = (path: string, problem: string) => {
    if (issues.length < 20) issues.push({ path, problem });
  };
  if (!isObj(data)) return [{ path: "$", problem: "must be an object" }];

  if (data.units !== undefined && data.units !== "kg" && data.units !== "lb") add("units", "must be kg or lb");
  if (data.profile !== undefined && data.profile !== null && !isObj(data.profile)) add("profile", "must be an object");
  const coaching = isObj(data.profile) ? data.profile.coaching : undefined;
  if (coaching !== undefined && coaching !== null) {
    if (!isObj(coaching)) add("profile.coaching", "must be an object");
    else {
      if (!finiteIn(coaching.daysPerWeek, 1, 7)) add("profile.coaching.daysPerWeek", "must be 1–7");
      if (!finiteIn(coaching.sessionMinutes, 15, 180)) add("profile.coaching.sessionMinutes", "must be 15–180");
      for (const k of ["limitations", "coachNotes"] as const) {
        const v = coaching[k];
        if (v != null && (typeof v !== "string" || v.length > 2000)) add(`profile.coaching.${k}`, "must be text up to 2000 characters");
      }
    }
  }
  const profile = isObj(data.profile) ? data.profile : null;
  if (profile) {
    // Body stats aren't range-checked here (older copies may hold anything);
    // nutritionPlan ignores implausible values instead.
    const n = profile.nutrition;
    if (n !== undefined && n !== null) {
      if (!isObj(n)) add("profile.nutrition", "must be an object");
      else for (const k of ["optOut", "pregnancy", "medical"] as const) {
        if (n[k] !== undefined && typeof n[k] !== "boolean") add(`profile.nutrition.${k}`, "must be true or false");
      }
    }
  }
  if (data.schema !== undefined && (typeof data.schema !== "number" || !Number.isInteger(data.schema))) {
    add("schema", "must be an integer");
  }

  for (const [key, limit] of Object.entries(RECORD_ARRAYS)) {
    const value = data[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      add(key, "must be an array");
      continue;
    }
    if (value.length > limit) add(key, `too many records (max ${limit})`);
    value.forEach((rec, i) => {
      if (!isObj(rec)) return add(`${key}[${i}]`, "must be an object");
      // PRs are keyed by exercise + kind rather than an id.
      if (key === "prs") {
        if (typeof rec.exerciseId !== "string") add(`${key}[${i}].exerciseId`, "missing");
        if (!finiteIn(rec.value, 0, 100_000)) add(`${key}[${i}].value`, "out of range");
        return;
      }
      if (typeof rec.id !== "string" || !ID_RE.test(rec.id)) add(`${key}[${i}].id`, "missing or malformed id");
      if (key === "sets") {
        // Weights are kilograms. 1 500 kg exceeds any human lift or machine.
        if (!finiteIn(rec.actualWeight, -500, 1_500)) add(`sets[${i}].actualWeight`, "out of range");
        if (!finiteIn(rec.targetWeight, -500, 1_500)) add(`sets[${i}].targetWeight`, "out of range");
        if (!finiteIn(rec.actualReps, 0, 10_000)) add(`sets[${i}].actualReps`, "out of range");
        if (!finiteIn(rec.rpe, 0, 10)) add(`sets[${i}].rpe`, "out of range");
        if (!finiteIn(rec.durationSec, 0, 86_400)) add(`sets[${i}].durationSec`, "out of range");
        if (!finiteIn(rec.durationMin, 0, 1_440)) add(`sets[${i}].durationMin`, "out of range");
      }
      if (key === "bodyLog" && !finiteIn(rec.weightKg, 20, 400)) add(`bodyLog[${i}].weightKg`, "out of range");
      if (key === "checkIns") {
        for (const k of ["sleep", "energy", "soreness", "stress"] as const) {
          if (!(Number.isInteger(rec[k]) && finiteIn(rec[k], 1, 5))) add(`checkIns[${i}].${k}`, "must be 1–5");
        }
      }
    });
  }

  const tombstones = data.tombstones;
  if (tombstones !== undefined && !Array.isArray(tombstones) && !isObj(tombstones)) {
    add("tombstones", "must be an array or object");
  }
  return issues;
}
