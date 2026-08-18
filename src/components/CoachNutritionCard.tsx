"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { NutritionTargets } from "@/domain/coach";
import type { MealIdeasResponse } from "@/services/ai/prompts/coach";
import { Skeleton } from "./Skeleton";

const APPROACH_LABEL: Record<NutritionTargets["approach"], string> = {
  deficit: "Moderate deficit",
  surplus: "Moderate surplus",
  maintenance: "Maintenance",
};

function BodyStatsForm() {
  const updateProfile = useStore((s) => s.updateProfile);
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const canSave = Number(age) > 0 && Number(height) > 0 && Number(weight) > 0;

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-h3 text-ink">Nutrition guidance</h3>
        <p className="text-body-sm text-inkSoft mt-1">
          Add a few body stats and I&apos;ll estimate a daily calorie and protein target based on
          your training.
        </p>
      </div>
      <div className="flex gap-2">
        {(["male", "female"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip capitalize ${sex === s ? "!bg-accentFill !text-onAccent !border-transparent" : ""}`}
            aria-pressed={sex === s}
            onClick={() => setSex(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="section-label">Age</span>
          <input
            className="num"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="30"
          />
        </label>
        <label className="space-y-1">
          <span className="section-label">Height (cm)</span>
          <input
            className="num"
            inputMode="numeric"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="178"
          />
        </label>
        <label className="space-y-1">
          <span className="section-label">Weight (kg)</span>
          <input
            className="num"
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="80"
          />
        </label>
      </div>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!canSave}
        onClick={() =>
          updateProfile({
            sex,
            ageYears: Number(age),
            heightCm: Number(height),
            weightKg: Number(weight),
          })
        }
      >
        Calculate my targets
      </button>
    </div>
  );
}

function MealIdeasList({
  mealIdeas,
  loading,
}: {
  mealIdeas: MealIdeasResponse["mealIdeas"] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!mealIdeas || mealIdeas.length === 0) return null;
  return (
    <ul className="space-y-2 pt-1">
      {mealIdeas.map((m) => (
        <li key={m.meal} className="rounded-control bg-surface2 px-4 py-3">
          <p className="section-label">{m.meal}</p>
          <p className="text-body-sm text-ink mt-0.5">{m.idea}</p>
        </li>
      ))}
    </ul>
  );
}

export function CoachNutritionCard({
  hasBodyStats,
  targets,
  mealIdeas,
  mealsLoading,
}: {
  hasBodyStats: boolean;
  targets: NutritionTargets | null;
  mealIdeas: MealIdeasResponse["mealIdeas"] | null;
  mealsLoading: boolean;
}) {
  if (!hasBodyStats || !targets) return <BodyStatsForm />;

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-h3 text-ink">Nutrition guidance</h3>
        <span className="badge-neutral">{APPROACH_LABEL[targets.approach]}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-control bg-surface2 py-3">
          <p className="text-lg font-bold tabular-nums text-ink">{targets.targetCalories}</p>
          <p className="section-label mt-0.5">kcal</p>
        </div>
        <div className="rounded-control bg-surface2 py-3">
          <p className="text-lg font-bold tabular-nums text-ink">{targets.proteinG}g</p>
          <p className="section-label mt-0.5">protein</p>
        </div>
        <div className="rounded-control bg-surface2 py-3">
          <p className="text-lg font-bold tabular-nums text-ink">{targets.fatG}g</p>
          <p className="section-label mt-0.5">fat</p>
        </div>
        <div className="rounded-control bg-surface2 py-3">
          <p className="text-lg font-bold tabular-nums text-ink">{targets.carbG}g</p>
          <p className="section-label mt-0.5">carbs</p>
        </div>
      </div>

      <MealIdeasList mealIdeas={mealIdeas} loading={mealsLoading} />

      <p className="text-[11px] text-muted leading-relaxed pt-1 border-t border-border">
        General guidance only, not medical or dietetic advice. These are moderate estimates based
        on your training — consult a professional for personalized nutrition planning, especially
        if you have a medical condition.
      </p>
    </div>
  );
}
