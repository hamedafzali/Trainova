// What the coach needs to know about how someone can train: schedule, session
// length, equipment, limitations and preferences. All optional — every field
// left empty just means "not told", and the coach must not assume a value.

export type EquipmentAccess = "gym" | "machines" | "dumbbells" | "bodyweight";
export type RpePreference = "always" | "sometimes" | "never";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, like Date.getDay()

export interface CoachingProfile {
  daysPerWeek: number | null;
  /** Days they can usually train; empty = flexible. */
  trainingDays: Weekday[];
  sessionMinutes: number | null;
  equipment: EquipmentAccess | null;
  /** Injuries, pain or movements to avoid, in their own words. */
  limitations: string | null;
  rpe: RpePreference | null;
  /** Anything else the coach should know (likes, dislikes, context). */
  coachNotes: string | null;
}

export const COACHING_LIMITS = {
  minDays: 1,
  maxDays: 7,
  minMinutes: 15,
  maxMinutes: 180,
  limitationsChars: 500,
  notesChars: 1000,
} as const;

export const EMPTY_COACHING: CoachingProfile = {
  daysPerWeek: null,
  trainingDays: [],
  sessionMinutes: null,
  equipment: null,
  limitations: null,
  rpe: null,
  coachNotes: null,
};

const EQUIPMENT: readonly EquipmentAccess[] = ["gym", "machines", "dumbbells", "bodyweight"];
const RPE: readonly RpePreference[] = ["always", "sometimes", "never"];

function int(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // Collapse control characters; keep line breaks.
  const t = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** Coerces anything (a backup, a synced copy, a request body) into a valid profile. */
export function normalizeCoaching(raw: unknown): CoachingProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY_COACHING, trainingDays: [] };
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r.trainingDays)
    ? [...new Set(r.trainingDays.filter((d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  return {
    daysPerWeek: int(r.daysPerWeek, COACHING_LIMITS.minDays, COACHING_LIMITS.maxDays),
    trainingDays: days,
    sessionMinutes: int(r.sessionMinutes, COACHING_LIMITS.minMinutes, COACHING_LIMITS.maxMinutes),
    equipment: EQUIPMENT.includes(r.equipment as EquipmentAccess) ? (r.equipment as EquipmentAccess) : null,
    limitations: text(r.limitations, COACHING_LIMITS.limitationsChars),
    rpe: RPE.includes(r.rpe as RpePreference) ? (r.rpe as RpePreference) : null,
    coachNotes: text(r.coachNotes, COACHING_LIMITS.notesChars),
  };
}

/** True when the set screen should offer the RPE picker. */
export function showsRpe(c: Pick<CoachingProfile, "rpe"> | null | undefined): boolean {
  return c?.rpe !== "never";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One-line summary for the coach prompt; only facts the user actually gave. */
export function describeSetup(c: CoachingProfile): string | null {
  const parts: string[] = [];
  if (c.daysPerWeek) parts.push(`${c.daysPerWeek} days/week`);
  if (c.trainingDays.length) parts.push(`usually ${c.trainingDays.map((d) => DAY_NAMES[d]).join("/")}`);
  if (c.sessionMinutes) parts.push(`~${c.sessionMinutes} min sessions`);
  if (c.equipment) parts.push(`equipment: ${c.equipment === "gym" ? "full gym" : c.equipment === "bodyweight" ? "no equipment" : c.equipment}`);
  if (c.rpe) parts.push(`logs RPE ${c.rpe}`);
  return parts.length ? parts.join(", ") : null;
}
