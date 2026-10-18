// Period summaries for the Progress overview: workouts, time, an estimated
// calorie burn, records and where the working sets went. Pure functions over
// the log; the screen picks the period.

import { localDayKey, startOfWeek } from "./streak";
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from "./taxonomy";
import type { Exercise, PersonalRecord, WorkoutSession, WorkoutSet } from "./types";

export type PeriodKind = "week" | "month" | "quarter";

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  week: "This Week",
  month: "This Month",
  quarter: "Last 3 Months",
};

export interface Period {
  kind: PeriodKind;
  /** Inclusive local day keys. */
  from: string;
  to: string;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The period `offset` steps back from the one containing `today` (0 = current). */
export function periodFor(kind: PeriodKind, offset: number, today: Date): Period {
  if (kind === "week") {
    const start = addDays(startOfWeek(today), -7 * offset);
    return { kind, from: localDayKey(start), to: localDayKey(addDays(start, 6)) };
  }
  const months = kind === "month" ? 1 : 3;
  const endMonth = today.getMonth() - months * offset;
  const start = new Date(today.getFullYear(), endMonth - months + 1, 1);
  const end = new Date(today.getFullYear(), endMonth + 1, 0);
  return { kind, from: localDayKey(start), to: localDayKey(end) };
}

/** Moderate resistance training (Compendium of Physical Activities, ~5 MET). */
export const STRENGTH_MET = 5;
/** Used when no bodyweight is known; the UI says the figure is an estimate. */
export const DEFAULT_BODYWEIGHT_KG = 75;

/** Minutes between start and finish, clamped to a sane workout length. */
export function sessionMinutes(s: Pick<WorkoutSession, "startedAt" | "completedAt">): number {
  if (!s.completedAt) return 0;
  const m = Math.round((+new Date(s.completedAt) - +new Date(s.startedAt)) / 60000);
  return Number.isFinite(m) ? Math.min(240, Math.max(1, m)) : 0;
}

/** kcal ≈ MET × bodyweight (kg) × hours. */
export function estimateCalories(minutes: number, bodyweightKg: number | null | undefined): number {
  const kg = bodyweightKg && bodyweightKg > 0 ? bodyweightKg : DEFAULT_BODYWEIGHT_KG;
  return Math.round((STRENGTH_MET * kg * minutes) / 60);
}

export interface MuscleShare {
  group: MuscleGroup;
  label: string;
  sets: number;
  /** Whole percent; the shares add up to 100. */
  pct: number;
}

export interface PeriodSummary {
  workouts: number;
  minutes: number;
  calories: number;
  /** True when no bodyweight was logged and the default was used. */
  bodyweightAssumed: boolean;
  prs: number;
  workingSets: number;
  muscles: MuscleShare[];
}

export interface PeriodInput {
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  exercises: Exercise[];
  prs: PersonalRecord[];
  bodyweightKg: number | null;
}

const inPeriod = (day: string, p: Period) => day >= p.from && day <= p.to;

/** Largest-remainder rounding so the shown percentages sum to exactly 100. */
function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) out[i]++;
  return out;
}

export function summarisePeriod(input: PeriodInput, period: Period, maxGroups = 5): PeriodSummary {
  const done = input.sessions.filter((s) => s.status === "completed" && inPeriod(s.date, period));
  const ids = new Set(done.map((s) => s.id));
  const minutes = done.reduce((n, s) => n + sessionMinutes(s), 0);
  const byId = new Map(input.exercises.map((e) => [e.id, e]));

  const counts = new Map<MuscleGroup, number>();
  let workingSets = 0;
  for (const x of input.sets) {
    if (!ids.has(x.sessionId) || !x.completed || x.kind === "warmup") continue;
    const group = muscleGroupOf(byId.get(x.exerciseId)?.primaryMuscle);
    if (group === "cardio") continue;
    workingSets++;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, sorted.length > maxGroups ? maxGroups - 1 : maxGroups);
  const rest = sorted.slice(head.length).reduce((n, [, c]) => n + c, 0);
  const rows: [MuscleGroup, number][] = rest > 0 ? [...head, ["other", rest]] : head;
  const pcts = percentages(rows.map(([, c]) => c));
  const labelOf = (g: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.key === g)?.label ?? "Other";

  return {
    workouts: done.length,
    minutes,
    calories: estimateCalories(minutes, input.bodyweightKg),
    bodyweightAssumed: !(input.bodyweightKg && input.bodyweightKg > 0),
    prs: input.prs.filter((p) => inPeriod(localDayKey(new Date(p.achievedAt)), period)).length,
    workingSets,
    muscles: rows.map(([group, sets], i) => ({ group, label: labelOf(group), sets, pct: pcts[i] })),
  };
}

/** "3h 45m", "50m". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The best value per week (Mon–Sun) for the last `weeks` weeks ending with the
 * week containing `today`. Weeks without a session are left out.
 */
export function weeklyBest(
  history: { date: string; value: number }[],
  weeks: number,
  today: Date,
): { week: string; value: number }[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const best = new Map<string, number>();
  for (const h of history) {
    if (!(h.value > 0)) continue;
    const d = new Date(h.date + "T00:00:00");
    if (d < first) continue;
    const wk = localDayKey(startOfWeek(d));
    best.set(wk, Math.max(best.get(wk) ?? 0, h.value));
  }
  return [...best.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, value]) => ({ week, value }));
}
