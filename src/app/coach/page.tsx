"use client";

import { useHydrated } from "@/lib/store";
import { useCoachData } from "@/lib/useCoachData";
import { CoachHeroInsight, pickHeroInsight } from "@/components/CoachHeroInsight";
import { CoachInsightCard } from "@/components/CoachInsightCard";
import { CoachNutritionCard } from "@/components/CoachNutritionCard";
import { CoachSummaryHero } from "@/components/CoachSummaryHero";
import { Skeleton } from "@/components/Skeleton";
import { TrainerChat } from "@/components/coach/TrainerChat";

export default function CoachPage() {
  const hydrated = useHydrated();
  const { summary, insights, intro, introLoading, nutritionTargets, hasBodyStats, mealIdeas, mealsLoading } =
    useCoachData();

  if (!hydrated) return <main className="min-h-screen" />;

  const noTrainingData = summary.exercises.length === 0 && summary.streakDays === 0;
  const heroInsight = pickHeroInsight(insights);
  const secondaryInsights = heroInsight ? insights.filter((i) => i.id !== heroInsight.id) : insights;

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="page-title">Coach</h1>
        <p className="page-subtitle">Notes from your logged training, and a coach you can ask.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {heroInsight && <CoachHeroInsight insight={heroInsight} />}
          <TrainerChat />
        </div>

        <aside className="space-y-4">
          {noTrainingData ? (
            <p className="card p-5 text-sm text-inkSoft">
              Log a few workouts and stalls, records and trends will show up here automatically.
            </p>
          ) : (
            <>
              <CoachSummaryHero summary={summary} />
              {introLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : intro ? (
                <p className="enter-fade text-body-sm text-inkSoft">{intro}</p>
              ) : null}
              {secondaryInsights.length > 0 ? (
                <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                  {secondaryInsights.map((insight) => (
                    <CoachInsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              ) : (
                !heroInsight && (
                  <p className="text-body-sm text-inkSoft">Nothing notable to flag right now — training looks steady.</p>
                )
              )}
            </>
          )}
          <CoachNutritionCard
            hasBodyStats={hasBodyStats}
            targets={nutritionTargets}
            mealIdeas={mealIdeas}
            mealsLoading={mealsLoading}
          />
        </aside>
      </div>
    </main>
  );
}
