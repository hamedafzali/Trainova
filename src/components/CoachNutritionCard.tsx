"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  NUTRITION_LIMITS,
  type NutritionAdjustment,
  type NutritionGate,
  type NutritionPlan,
  type NutritionTargets,
} from "@/domain/nutrition";
import type { MealIdeasResponse } from "@/services/ai/prompts/coach";
import { Skeleton } from "./Skeleton";

const APPROACH_LABEL: Record<NutritionTargets["approach"], string> = {
  deficit: "Moderate deficit",
  surplus: "Moderate surplus",
  maintenance: "Maintenance",
};

const ADJUSTMENT_NOTE: Record<NutritionAdjustment, string> = {
  calorie_floor: "Calories are held at a safe minimum rather than cut further.",
  fat_reduced_for_carbs: "Fat is trimmed (still above its minimum) to keep enough carbs.",
  calories_raised_for_carbs: "Calories are raised a little to keep carbs and fat above their minimums.",
  protein_capped: "Protein is capped at a sensible maximum.",
};

const GATE_TEXT: Record<NutritionGate, { title: string; body: string }> = {
  minor: {
    title: "Not available under 18",
    body: "Trainova doesn't calculate calorie or macro targets for anyone under 18. Growing bodies need more than a general formula can give; a doctor or registered dietitian can help you plan meals around training.",
  },
  pregnancy: {
    title: "Paused during pregnancy and breastfeeding",
    body: "Energy and nutrient needs change in ways a general calculator can't cover. Your midwife, doctor or a registered dietitian is the right person to set targets with you.",
  },
  medical: {
    title: "Targets aren't shown",
    body: "Because you told us about a condition that affects your diet, or a history of disordered eating, we don't show calorie targets. A doctor or registered dietitian can set them safely with you.",
  },
};

const DISCLAIMER =
  "General guidance only, not medical or dietetic advice. These are moderate estimates based on your training; talk to a professional for a personal plan, especially with a medical condition.";

function useNutritionActions() {
  const updateProfile = useStore((s) => s.updateProfile);
  const nutrition = useStore((s) => s.profile.nutrition);
  return {
    setFlags: (patch: { optOut?: boolean; pregnancy?: boolean; medical?: boolean }) =>
      updateProfile({ nutrition: { ...nutrition, ...patch } }),
    // Opting out removes the body stats collected for this feature. Weight
    // stays: it belongs to the bodyweight log.
    optOut: () => updateProfile({ nutrition: { optOut: true }, sex: null, ageYears: null, heightCm: null }),
  };
}

function BodyStatsForm({ invalid, onDone }: { invalid: string[]; onDone?: () => void }) {
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const { optOut } = useNutritionActions();
  const [sex, setSex] = useState<"male" | "female">(profile.sex ?? "male");
  const [age, setAge] = useState(profile.ageYears ? String(profile.ageYears) : "");
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : "");
  const [weight, setWeight] = useState(profile.weightKg ? String(Math.round(profile.weightKg * 10) / 10) : "");
  const [pregnancy, setPregnancy] = useState(!!profile.nutrition?.pregnancy);
  const [medical, setMedical] = useState(!!profile.nutrition?.medical);

  const num = (v: string) => Number(v.replace(",", "."));
  const fields = [
    { key: "ageYears", label: "Age", value: age, set: setAge, placeholder: "30", limits: { min: 1, max: NUTRITION_LIMITS.ageYears.max } },
    { key: "heightCm", label: "Height (cm)", value: height, set: setHeight, placeholder: "178", limits: NUTRITION_LIMITS.heightCm },
    { key: "weightKg", label: "Weight (kg)", value: weight, set: setWeight, placeholder: "80", limits: NUTRITION_LIMITS.weightKg },
  ] as const;
  const bad = (f: (typeof fields)[number]) => f.value !== "" && !(num(f.value) >= f.limits.min && num(f.value) <= f.limits.max);
  const canSave = fields.every((f) => f.value !== "" && !bad(f));

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="text-h3 text-ink">Nutrition guidance</h3>
        <p className="mt-1 text-body-sm text-inkSoft">
          Add a few details and I&apos;ll estimate daily calorie and protein targets for your training. Optional, and you
          can turn it off any time.
        </p>
      </div>
      <div className="flex gap-2" role="group" aria-label="Sex used in the calorie formula">
        {(["male", "female"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip capitalize ${sex === s ? "!border-transparent !bg-accentFill !text-onAccent" : ""}`}
            aria-pressed={sex === s}
            onClick={() => setSex(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {fields.map((f) => (
          <label key={f.key} className="space-y-1">
            <span className="section-label">{f.label}</span>
            <input
              className="num"
              inputMode="decimal"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.placeholder}
              aria-invalid={bad(f) || invalid.includes(f.key) || undefined}
            />
          </label>
        ))}
      </div>
      {fields.some(bad) && (
        <p className="text-body-sm text-danger" role="alert">
          Check the numbers: height {NUTRITION_LIMITS.heightCm.min}–{NUTRITION_LIMITS.heightCm.max} cm, weight{" "}
          {NUTRITION_LIMITS.weightKg.min}–{NUTRITION_LIMITS.weightKg.max} kg.
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="section-label">Does any of this apply?</legend>
        <label className="flex items-start gap-3 text-body-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={pregnancy} onChange={(e) => setPregnancy(e.target.checked)} />
          I&apos;m pregnant or breastfeeding
        </label>
        <label className="flex items-start gap-3 text-body-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={medical} onChange={(e) => setMedical(e.target.checked)} />
          I have a medical condition that affects my diet, or a history of disordered eating
        </label>
      </fieldset>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!canSave}
        onClick={() => {
          updateProfile({
            sex,
            ageYears: Math.round(num(age)),
            heightCm: num(height),
            weightKg: num(weight),
            nutrition: { ...profile.nutrition, optOut: false, pregnancy, medical },
          });
          onDone?.();
        }}
      >
        Calculate my targets
      </button>
      <button type="button" className="w-full text-center text-body-sm text-muted underline-offset-2 hover:underline" onClick={optOut}>
        Turn off nutrition guidance
      </button>
    </div>
  );
}

function MealIdeasList({ mealIdeas, loading }: { mealIdeas: MealIdeasResponse["mealIdeas"] | null; loading: boolean }) {
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
          <p className="mt-0.5 text-body-sm text-ink">{m.idea}</p>
        </li>
      ))}
    </ul>
  );
}

export function CoachNutritionCard({
  plan,
  mealIdeas,
  mealsLoading,
}: {
  plan: NutritionPlan;
  mealIdeas: MealIdeasResponse["mealIdeas"] | null;
  mealsLoading: boolean;
}) {
  const { setFlags, optOut } = useNutritionActions();
  const [editing, setEditing] = useState(false);

  if (plan.status === "off") {
    return (
      <div className="card space-y-3" data-testid="nutrition-off">
        <h3 className="text-h3 text-ink">Nutrition guidance is off</h3>
        <p className="text-body-sm text-inkSoft">No calorie targets or meal ideas are shown, and no body details are kept for it.</p>
        <button type="button" className="btn-secondary w-full" onClick={() => setFlags({ optOut: false })}>
          Turn it back on
        </button>
      </div>
    );
  }

  if (editing || plan.status === "needs_stats") {
    return <BodyStatsForm invalid={plan.status === "needs_stats" ? plan.invalid : []} onDone={() => setEditing(false)} />;
  }

  if (plan.status === "gated") {
    const text = GATE_TEXT[plan.reason];
    return (
      <div className="card space-y-3" data-testid="nutrition-gated">
        <h3 className="text-h3 text-ink">{text.title}</h3>
        <p className="text-body-sm text-inkSoft">{text.body}</p>
        <p className="text-body-sm text-inkSoft">Everything else in Trainova works as usual.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
            Update my details
          </button>
          <button type="button" className="btn-ghost" onClick={optOut}>
            Turn off nutrition guidance
          </button>
        </div>
      </div>
    );
  }

  const targets = plan.targets;
  const tiles = [
    { value: targets.targetCalories, unit: "", label: "kcal" },
    { value: targets.proteinG, unit: "g", label: "protein" },
    { value: targets.fatG, unit: "g", label: "fat" },
    { value: targets.carbG, unit: "g", label: "carbs" },
  ];

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h3 text-ink">Nutrition guidance</h3>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Estimate</p>
        </div>
        <span className="badge-neutral">{APPROACH_LABEL[targets.approach]}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-control bg-surface2 py-3">
            <p className="text-lg font-bold tabular-nums text-ink">
              {t.value}
              {t.unit}
            </p>
            <p className="section-label mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>

      {targets.adjustments.length > 0 && (
        <ul className="space-y-1 text-body-sm text-inkSoft" aria-label="Safety floors applied">
          {targets.adjustments.map((a) => (
            <li key={a}>{ADJUSTMENT_NOTE[a]}</li>
          ))}
        </ul>
      )}

      <MealIdeasList mealIdeas={mealIdeas} loading={mealsLoading} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
        <button type="button" className="text-accent" onClick={() => setEditing(true)}>
          Edit my details
        </button>
        <button type="button" className="text-muted" onClick={optOut}>
          Turn off
        </button>
      </div>

      <p className="border-t border-border pt-1 text-[11px] leading-relaxed text-muted">{DISCLAIMER}</p>
    </div>
  );
}
