import { describe, expect, it } from "vitest";
import {
  buildDeterministicInsights,
  buildTrainingSummary,
  calcNutritionTargets,
} from "./coach";

const NOW = new Date("2026-08-15T12:00:00");

describe("buildTrainingSummary", () => {
  it("computes streak, gaps, and volume trend from raw inputs", () => {
    const summary = buildTrainingSummary({
      now: NOW,
      trainedDayKeys: ["2026-08-13", "2026-08-14", "2026-08-15"],
      sessionDatesLast60d: ["2026-08-13", "2026-08-14", "2026-08-15"],
      volumeByDateLast60d: [
        { date: "2026-08-14", volume: 1000 },
        { date: "2026-08-15", volume: 1000 },
        { date: "2026-07-01", volume: 1000 },
      ],
      exercises: [],
      recentPRs: [],
      units: "kg",
      goal: "strength",
      experience: "intermediate",
    });

    expect(summary.streakDays).toBe(3);
    expect(summary.daysSinceLastSession).toBe(0);
    expect(summary.volumeLast30d).toBe(2000);
    expect(summary.volumePrev30d).toBe(1000);
    expect(summary.volumeTrendPct).toBe(100);
  });

  it("reports zero streak once the gap since the last session exceeds 2 days", () => {
    const summary = buildTrainingSummary({
      now: NOW,
      trainedDayKeys: ["2026-08-01"],
      sessionDatesLast60d: ["2026-08-01"],
      volumeByDateLast60d: [],
      exercises: [],
      recentPRs: [],
      units: "kg",
      goal: null,
      experience: null,
    });
    expect(summary.streakDays).toBe(0);
    expect(summary.daysSinceLastSession).toBe(14);
  });

  it("flags an exercise as stalled after 3 non-increasing sessions", () => {
    const summary = buildTrainingSummary({
      now: NOW,
      trainedDayKeys: ["2026-08-15"],
      sessionDatesLast60d: ["2026-08-15"],
      volumeByDateLast60d: [],
      exercises: [
        {
          exerciseId: "bench",
          name: "Bench Press",
          history: [
            { date: "2026-08-01", topWeight: 60, volume: 600 },
            { date: "2026-08-05", topWeight: 60, volume: 600 },
            { date: "2026-08-10", topWeight: 60, volume: 600 },
            { date: "2026-08-15", topWeight: 60, volume: 600 },
          ],
        },
      ],
      recentPRs: [],
      units: "kg",
      goal: "strength",
      experience: "intermediate",
    });
    expect(summary.exercises[0].stalledSessions).toBe(3);
  });
});

describe("buildDeterministicInsights", () => {
  it("only ever cites numbers present in the summary", () => {
    const summary = buildTrainingSummary({
      now: NOW,
      trainedDayKeys: ["2026-08-13", "2026-08-14", "2026-08-15"],
      sessionDatesLast60d: ["2026-08-13", "2026-08-14", "2026-08-15"],
      volumeByDateLast60d: [
        { date: "2026-08-14", volume: 3000 },
        { date: "2026-08-15", volume: 3000 },
        { date: "2026-07-01", volume: 1000 },
      ],
      exercises: [
        {
          exerciseId: "bench",
          name: "Bench Press",
          history: [
            { date: "2026-08-01", topWeight: 60, volume: 600 },
            { date: "2026-08-05", topWeight: 60, volume: 600 },
            { date: "2026-08-10", topWeight: 60, volume: 600 },
            { date: "2026-08-15", topWeight: 60, volume: 600 },
          ],
        },
      ],
      recentPRs: [
        { exerciseId: "squat", name: "Squat", kind: "max_weight", value: 100, achievedAt: "2026-08-14" },
      ],
      units: "kg",
      goal: "strength",
      experience: "intermediate",
    });

    const insights = buildDeterministicInsights(summary);
    const kinds = insights.map((i) => i.kind);
    expect(kinds).toContain("stall");
    expect(kinds).toContain("pr");
    expect(kinds).toContain("streak");

    const stall = insights.find((i) => i.kind === "stall")!;
    expect(stall.message).toContain("60kg");
    expect(stall.message).toContain("3 sessions");
    for (const n of stall.numbers) {
      expect(stall.message).toMatch(new RegExp(String(n)));
    }
  });

  it("produces no insights for a summary with nothing notable", () => {
    const summary = buildTrainingSummary({
      now: NOW,
      trainedDayKeys: [],
      sessionDatesLast60d: [],
      volumeByDateLast60d: [],
      exercises: [],
      recentPRs: [],
      units: "kg",
      goal: null,
      experience: null,
    });
    expect(buildDeterministicInsights(summary)).toEqual([]);
  });
});

describe("calcNutritionTargets", () => {
  it("never applies more than a moderate deficit for fat_loss", () => {
    const targets = calcNutritionTargets({
      sex: "male",
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      sessionsPerWeek: 4,
      goal: "fat_loss",
    });
    expect(targets.approach).toBe("deficit");
    expect(targets.tdee - targets.targetCalories).toBeLessThanOrEqual(300);
  });

  it("never applies more than a moderate surplus for hypertrophy", () => {
    const targets = calcNutritionTargets({
      sex: "female",
      ageYears: 25,
      heightCm: 165,
      weightKg: 60,
      sessionsPerWeek: 3,
      goal: "hypertrophy",
    });
    expect(targets.approach).toBe("surplus");
    expect(targets.targetCalories - targets.tdee).toBeLessThanOrEqual(250);
  });

  it("stays at maintenance for strength/health goals", () => {
    const targets = calcNutritionTargets({
      sex: "male",
      ageYears: 40,
      heightCm: 175,
      weightKg: 75,
      sessionsPerWeek: 3,
      goal: "strength",
    });
    expect(targets.approach).toBe("maintenance");
    expect(targets.targetCalories).toBe(targets.tdee);
  });

  it("produces macro grams that roughly reconcile with target calories", () => {
    const targets = calcNutritionTargets({
      sex: "male",
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      sessionsPerWeek: 4,
      goal: "strength",
    });
    const macroCals = targets.proteinG * 4 + targets.fatG * 9 + targets.carbG * 4;
    expect(Math.abs(macroCals - targets.targetCalories)).toBeLessThan(20);
  });
});
