// Deterministic coaching logic. No I/O, no AI calls — this is the source of
// truth for every number the AI mentor is allowed to cite. The AI layer
// (src/services/ai/coach.ts) is only ever allowed to add tone/prioritization
// on top of what's computed here; it must never originate a figure.

import type { PrKind, Units, UserProfile } from "./types";

// ---------------------------------------------------------------------------
// Training summary — a compact, aggregated picture of a user's training.
// Built from data the caller already has via existing store selectors
// (exerciseHistory, trainedDays, etc.) — see src/lib/useCoachData.ts.
// ---------------------------------------------------------------------------

export interface ExerciseHistoryPoint {
  date: string; // YYYY-MM-DD
  topWeight: number;
  volume: number;
}

export interface ExerciseCoachInput {
  exerciseId: string;
  name: string;
  /** Ascending by date, most recent last — same order as store.exerciseHistory(). */
  history: ExerciseHistoryPoint[];
}

export interface ExerciseCoachSummary {
  exerciseId: string;
  name: string;
  sessionsLogged: number;
  lastDate: string;
  lastTopWeight: number;
  daysSinceLast: number;
  /** Consecutive most-recent sessions with no increase in top weight. */
  stalledSessions: number;
}

export interface RecentPr {
  exerciseId: string;
  name: string;
  kind: PrKind;
  value: number;
  achievedAt: string; // YYYY-MM-DD
}

export interface TrainingSummary {
  today: string;
  streakDays: number;
  daysSinceLastSession: number | null;
  sessionsLast30d: number;
  sessionsPrev30d: number;
  volumeLast30d: number;
  volumePrev30d: number;
  /** Percent change in volume, last 30d vs prior 30d. Null if no prior baseline. */
  volumeTrendPct: number | null;
  /** Capped to the most-trained exercises so the payload stays small. */
  exercises: ExerciseCoachSummary[];
  recentPRs: RecentPr[];
  units: Units;
  goal: UserProfile["goal"];
  experience: UserProfile["experience"];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: Date): number {
  const d = new Date(a + "T00:00:00");
  const bMidnight = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMidnight.getTime() - d.getTime()) / DAY_MS);
}

/** Days between two YYYY-MM-DD keys (later minus earlier, always >= 0 for sorted input). */
function daysDiff(earlier: string, later: string): number {
  const a = new Date(earlier + "T00:00:00");
  const b = new Date(later + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Consecutive trailing sessions where top weight didn't increase. */
function countStalledSessions(history: ExerciseHistoryPoint[]): number {
  if (history.length < 2) return 0;
  let stalled = 0;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i].topWeight <= history[i - 1].topWeight) stalled++;
    else break;
  }
  return stalled;
}

/**
 * Current streak: walk backward from the most recent trained day, counting
 * consecutive entries as long as the gap between them is <=2 days (so a
 * planned rest day doesn't break the streak, but a multi-day lapse does).
 */
function computeStreak(sortedDayKeys: string[], now: Date): number {
  if (sortedDayKeys.length === 0) return 0;
  const last = sortedDayKeys[sortedDayKeys.length - 1];
  if (daysBetween(last, now) > 2) return 0; // streak already broken

  let streak = 1;
  for (let i = sortedDayKeys.length - 1; i > 0; i--) {
    const gap = daysDiff(sortedDayKeys[i - 1], sortedDayKeys[i]);
    if (gap <= 2) streak++;
    else break;
  }
  return streak;
}

export function buildTrainingSummary(input: {
  now: Date;
  /** All distinct trained day keys (YYYY-MM-DD), any order. */
  trainedDayKeys: string[];
  /** All completed session dates in the last 60 days, any order. */
  sessionDatesLast60d: string[];
  /** Total volume per session date, last 60 days (for the 30d/30d trend). */
  volumeByDateLast60d: { date: string; volume: number }[];
  exercises: ExerciseCoachInput[];
  recentPRs: RecentPr[];
  units: Units;
  goal: UserProfile["goal"];
  experience: UserProfile["experience"];
  /** Cap on how many exercises to summarize (most-recently-trained first). */
  maxExercises?: number;
}): TrainingSummary {
  const { now } = input;
  const todayKey = now.toISOString().slice(0, 10);

  const sortedDays = [...input.trainedDayKeys].sort();
  const streakDays = computeStreak(sortedDays, now);
  const daysSinceLastSession =
    sortedDays.length > 0 ? daysBetween(sortedDays[sortedDays.length - 1], now) : null;

  const last30 = input.volumeByDateLast60d.filter((v) => daysBetween(v.date, now) <= 30);
  const prev30 = input.volumeByDateLast60d.filter(
    (v) => daysBetween(v.date, now) > 30 && daysBetween(v.date, now) <= 60
  );
  const volumeLast30d = Math.round(last30.reduce((s, v) => s + v.volume, 0));
  const volumePrev30d = Math.round(prev30.reduce((s, v) => s + v.volume, 0));
  const volumeTrendPct =
    volumePrev30d > 0 ? Math.round(((volumeLast30d - volumePrev30d) / volumePrev30d) * 100) : null;

  const sessionsLast30d = input.sessionDatesLast60d.filter((d) => daysBetween(d, now) <= 30).length;
  const sessionsPrev30d = input.sessionDatesLast60d.filter(
    (d) => daysBetween(d, now) > 30 && daysBetween(d, now) <= 60
  ).length;

  const maxExercises = input.maxExercises ?? 8;
  const exercises: ExerciseCoachSummary[] = input.exercises
    .filter((e) => e.history.length > 0)
    .sort((a, b) => b.history.length - a.history.length)
    .slice(0, maxExercises)
    .map((e) => {
      const lastPoint = e.history[e.history.length - 1];
      return {
        exerciseId: e.exerciseId,
        name: e.name,
        sessionsLogged: e.history.length,
        lastDate: lastPoint.date,
        lastTopWeight: lastPoint.topWeight,
        daysSinceLast: daysBetween(lastPoint.date, now),
        stalledSessions: countStalledSessions(e.history),
      };
    });

  return {
    today: todayKey,
    streakDays,
    daysSinceLastSession,
    sessionsLast30d,
    sessionsPrev30d,
    volumeLast30d,
    volumePrev30d,
    volumeTrendPct,
    exercises,
    recentPRs: input.recentPRs,
    units: input.units,
    goal: input.goal,
    experience: input.experience,
  };
}

// ---------------------------------------------------------------------------
// Deterministic insights — every message below is built entirely from
// TrainingSummary fields. The `numbers` array lists every figure the message
// cites, so the AI enrichment layer can be checked against it (see
// src/services/ai/coach.ts) — the AI is never the source of these values.
// ---------------------------------------------------------------------------

export type InsightKind =
  | "stall"
  | "pr"
  | "volume_up"
  | "volume_down"
  | "missed"
  | "streak";
export type InsightSeverity = "success" | "info" | "warning";

export interface CoachInsight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  exerciseId?: string;
  message: string;
  numbers: number[];
}

export function buildDeterministicInsights(summary: TrainingSummary): CoachInsight[] {
  const insights: CoachInsight[] = [];
  const unit = summary.units;

  for (const ex of summary.exercises) {
    if (ex.stalledSessions >= 3) {
      const backoff = Math.round((ex.lastTopWeight * 0.9) / 2.5) * 2.5;
      insights.push({
        id: `stall-${ex.exerciseId}`,
        kind: "stall",
        severity: "warning",
        exerciseId: ex.exerciseId,
        message: `Your ${ex.name} has stalled at ${ex.lastTopWeight}${unit} for ${ex.stalledSessions} sessions in a row — try ${backoff}${unit} this week for higher reps to break through.`,
        numbers: [ex.lastTopWeight, ex.stalledSessions, backoff],
      });
    }
  }

  for (const pr of summary.recentPRs) {
    insights.push({
      id: `pr-${pr.exerciseId}-${pr.kind}-${pr.achievedAt}`,
      kind: "pr",
      severity: "success",
      exerciseId: pr.exerciseId,
      message:
        pr.kind === "max_weight"
          ? `New PR on ${pr.name}: ${pr.value}${unit}.`
          : pr.kind === "max_reps"
            ? `New PR on ${pr.name}: ${pr.value} reps.`
            : `New PR on ${pr.name}: ~${pr.value}${unit} estimated 1RM.`,
      numbers: [pr.value],
    });
  }

  if (summary.volumeTrendPct != null && summary.volumeTrendPct >= 20) {
    insights.push({
      id: "volume-up",
      kind: "volume_up",
      severity: "info",
      message: `Total training volume is up ${summary.volumeTrendPct}% over the last 30 days — make sure sleep and protein are keeping pace so recovery doesn't fall behind.`,
      numbers: [summary.volumeTrendPct],
    });
  } else if (summary.volumeTrendPct != null && summary.volumeTrendPct <= -20) {
    insights.push({
      id: "volume-down",
      kind: "volume_down",
      severity: "info",
      message: `Total training volume is down ${Math.abs(summary.volumeTrendPct)}% over the last 30 days compared to the 30 days before.`,
      numbers: [Math.abs(summary.volumeTrendPct)],
    });
  }

  if (summary.daysSinceLastSession != null && summary.daysSinceLastSession >= 4) {
    insights.push({
      id: "missed",
      kind: "missed",
      severity: "warning",
      message: `It's been ${summary.daysSinceLastSession} days since your last logged session.`,
      numbers: [summary.daysSinceLastSession],
    });
  }

  if (summary.streakDays >= 3) {
    insights.push({
      id: "streak",
      kind: "streak",
      severity: "success",
      message: `${summary.streakDays}-day training streak — keep it going.`,
      numbers: [summary.streakDays],
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Nutrition targets — deterministic BMR/TDEE/macro math (Mifflin-St Jeor).
// Deliberately hand-rolled rather than left to the LLM so the numbers are
// exact and the calorie adjustment can never exceed a moderate, documented
// bound (never an "aggressive deficit"). The AI layer only ever generates
// meal ideas around these already-fixed numbers, never the targets.
// ---------------------------------------------------------------------------

export interface NutritionInput {
  sex: "male" | "female";
  ageYears: number;
  heightCm: number;
  weightKg: number;
  /** Trained sessions per week, used as the activity multiplier. */
  sessionsPerWeek: number;
  goal: UserProfile["goal"];
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  approach: "deficit" | "surplus" | "maintenance";
}

const MODERATE_DEFICIT = 300; // kcal/day below TDEE — never more aggressive than this
const MODERATE_SURPLUS = 250; // kcal/day above TDEE

function activityMultiplier(sessionsPerWeek: number): number {
  if (sessionsPerWeek >= 6) return 1.725;
  if (sessionsPerWeek >= 4) return 1.55;
  if (sessionsPerWeek >= 2) return 1.375;
  return 1.2;
}

export function calcNutritionTargets(input: NutritionInput): NutritionTargets {
  const { sex, ageYears, heightCm, weightKg, sessionsPerWeek, goal } = input;
  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  const tdee = bmr * activityMultiplier(sessionsPerWeek);

  let targetCalories = tdee;
  let approach: NutritionTargets["approach"] = "maintenance";
  if (goal === "fat_loss") {
    targetCalories = tdee - MODERATE_DEFICIT;
    approach = "deficit";
  } else if (goal === "hypertrophy") {
    targetCalories = tdee + MODERATE_SURPLUS;
    approach = "surplus";
  }

  const proteinG = Math.round(weightKg * 1.8);
  const fatG = Math.round(weightKg * 0.8);
  const proteinCal = proteinG * 4;
  const fatCal = fatG * 9;
  const carbCal = Math.max(0, targetCalories - proteinCal - fatCal);
  const carbG = Math.round(carbCal / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    proteinG,
    fatG,
    carbG,
    approach,
  };
}
