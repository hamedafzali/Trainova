"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";
import { isAiEnabled } from "@/lib/supabase/client";
import { stableHash } from "@/lib/hash";
import {
  buildDeterministicInsights,
  buildTrainingSummary,
  calcNutritionTargets,
  type CoachInsight,
  type NutritionTargets,
  type TrainingSummary,
} from "@/domain/coach";
import type { MealIdeasResponse } from "@/services/ai/prompts/coach";

const LOCAL_CACHE_PREFIX = "trainova-coach-cache-";

type CacheEntry<T> = { hash: string; value: T; savedAt: number };
const LOCAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // mirrors the server-side CACHE_TTL.AI_COACH

function readLocalCache<T>(key: string, hash: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.hash !== hash) return null;
    if (Date.now() - entry.savedAt > LOCAL_CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function writeLocalCache<T>(key: string, hash: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { hash, value, savedAt: Date.now() };
    window.localStorage.setItem(LOCAL_CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full/unavailable — caching is a pure optimization, safe to skip
  }
}

async function postCoach<T>(action: string, data: unknown, contextHash: string): Promise<T | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/ai/coach", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, data, contextHash }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const KIND_TO_SITUATION: Record<CoachInsight["kind"], string> = {
  stall: "a lift has stalled at the same weight for several sessions in a row",
  pr: "a new personal record was just set",
  volume_up: "overall training volume has climbed notably in the last month",
  volume_down: "overall training volume has dropped in the last month",
  missed: "it's been several days since the last logged session",
  streak: "there's a solid, ongoing training streak right now",
};

/**
 * Assembles the deterministic TrainingSummary + insights from the local
 * store (the same source History/Progress read from), then layers on the
 * two narrow AI enrichments (intro line, meal ideas) with client + server
 * caching so unchanged training data never re-hits the model.
 */
export function useCoachData() {
  const enabled = isAiEnabled();

  const profile = useStore((s) => s.profile);
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const exercises = useStore((s) => s.exercises);
  const trainedDays = useStore((s) => s.trainedDays);
  const exercisesWithHistory = useStore((s) => s.exercisesWithHistory);
  const exerciseHistory = useStore((s) => s.exerciseHistory);

  const summary: TrainingSummary = useMemo(() => {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const completedDates = sessions
      .filter((s) => s.status === "completed" && s.date >= sixtyDaysAgo.toISOString().slice(0, 10))
      .map((s) => s.date);

    const exerciseIds = exercisesWithHistory();
    const exerciseInputs = exerciseIds.map((id) => {
      const ex = exercises.find((e) => e.id === id);
      const history = exerciseHistory(id).filter((h) => h.date >= sixtyDaysAgo.toISOString().slice(0, 10));
      return {
        exerciseId: id,
        name: ex?.name ?? "Exercise",
        history: history.map((h) => ({ date: h.date, topWeight: h.topWeight, volume: h.volume })),
      };
    });

    const volumeByDate = new Map<string, number>();
    for (const ex of exerciseInputs) {
      for (const h of ex.history) {
        volumeByDate.set(h.date, (volumeByDate.get(h.date) ?? 0) + h.volume);
      }
    }

    const recentPRs = prs
      .filter((p) => p.achievedAt >= sixtyDaysAgo.toISOString().slice(0, 10))
      .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
      .slice(0, 5)
      .map((p) => ({
        exerciseId: p.exerciseId,
        name: exercises.find((e) => e.id === p.exerciseId)?.name ?? "Exercise",
        kind: p.kind,
        value: p.value,
        achievedAt: p.achievedAt,
      }));

    return buildTrainingSummary({
      now,
      trainedDayKeys: Array.from(trainedDays()),
      sessionDatesLast60d: completedDates,
      volumeByDateLast60d: Array.from(volumeByDate.entries()).map(([date, volume]) => ({ date, volume })),
      exercises: exerciseInputs,
      recentPRs,
      units,
      goal: profile.goal,
      experience: profile.experience,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sets, prs, exercises, profile.goal, profile.experience, units]);

  const insights = useMemo(() => buildDeterministicInsights(summary), [summary]);

  const nutritionInput =
    profile.sex && profile.ageYears && profile.heightCm && profile.weightKg
      ? {
          sex: profile.sex,
          ageYears: profile.ageYears,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          sessionsPerWeek: summary.sessionsLast30d / 4.3,
          goal: profile.goal,
        }
      : null;

  const nutritionTargets: NutritionTargets | null = useMemo(
    () => (nutritionInput ? calcNutritionTargets(nutritionInput) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nutritionInput?.sex, nutritionInput?.ageYears, nutritionInput?.heightCm, nutritionInput?.weightKg, nutritionInput?.sessionsPerWeek, nutritionInput?.goal]
  );

  const introHash = useMemo(
    () => stableHash({ goal: profile.goal, experience: profile.experience, kinds: insights.map((i) => i.kind).sort() }),
    [profile.goal, profile.experience, insights]
  );
  const mealsHash = useMemo(
    () => (nutritionTargets ? stableHash(nutritionTargets) : ""),
    [nutritionTargets]
  );

  const [intro, setIntro] = useState<string | null>(null);
  const [introLoading, setIntroLoading] = useState(false);
  const [mealIdeas, setMealIdeas] = useState<MealIdeasResponse["mealIdeas"] | null>(null);
  const [mealsLoading, setMealsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || insights.length === 0) {
      setIntro(null);
      return;
    }
    const cachedIntro = readLocalCache<string | null>("intro", introHash);
    if (cachedIntro !== null) {
      setIntro(cachedIntro);
      return;
    }
    let cancelled = false;
    setIntroLoading(true);
    const situations = Array.from(new Set(insights.map((i) => KIND_TO_SITUATION[i.kind])));
    postCoach<{ intro: string | null }>(
      "intro",
      { goal: profile.goal, experience: profile.experience, situations },
      introHash
    ).then((res) => {
      if (cancelled) return;
      const value = res?.intro ?? null;
      setIntro(value);
      writeLocalCache("intro", introHash, value);
      setIntroLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, introHash]);

  useEffect(() => {
    if (!enabled || !nutritionTargets) {
      setMealIdeas(null);
      return;
    }
    const cachedMeals = readLocalCache<MealIdeasResponse["mealIdeas"]>("meals", mealsHash);
    if (cachedMeals) {
      setMealIdeas(cachedMeals);
      return;
    }
    let cancelled = false;
    setMealsLoading(true);
    postCoach<MealIdeasResponse>(
      "meals",
      {
        goal: profile.goal,
        targetCalories: nutritionTargets.targetCalories,
        proteinG: nutritionTargets.proteinG,
        fatG: nutritionTargets.fatG,
        carbG: nutritionTargets.carbG,
        approach: nutritionTargets.approach,
      },
      mealsHash
    ).then((res) => {
      if (cancelled) return;
      const ideas = res?.mealIdeas ?? null;
      setMealIdeas(ideas);
      if (ideas) writeLocalCache("meals", mealsHash, ideas);
      setMealsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mealsHash]);

  return {
    enabled,
    summary,
    insights,
    intro,
    introLoading,
    nutritionTargets,
    hasBodyStats: !!nutritionInput,
    mealIdeas,
    mealsLoading,
  };
}
