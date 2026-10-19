"use client";

import { useHydrated } from "@/lib/store";
import { useCoachData } from "@/lib/useCoachData";
import { CoachInsightCard } from "@/components/CoachInsightCard";
import { CoachNutritionCard } from "@/components/CoachNutritionCard";
import { Skeleton } from "@/components/Skeleton";
import { PageHeader } from "@/components/kit";
import { TrainerChat } from "@/components/coach/TrainerChat";
import { StatusReview } from "@/components/coach/StatusReview";
import { CoachTools } from "@/components/coach/CoachTools";

export default function CoachPage() {
  const hydrated = useHydrated();
  const { enabled, summary, insights, intro, introLoading, nutritionTargets, hasBodyStats, mealIdeas, mealsLoading } =
    useCoachData();

  if (!hydrated) return <main className="min-h-screen" />;

  const noTrainingData = summary.exercises.length === 0 && summary.streakDays === 0;

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="AI Coach" subtitle="Where you stand against your plan, and a coach you can ask." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <StatusReview summary={summary} />
          <CoachTools disabled={!enabled} />
          <TrainerChat />
        </div>

        <aside className="space-y-4">
          <section className="card overflow-hidden p-0" aria-labelledby="coach-signals">
            <div className="space-y-1 p-4 sm:p-5">
              <h2 id="coach-signals" className="font-semibold text-ink">
                Signals
              </h2>
              {noTrainingData ? (
                <p className="text-sm text-inkSoft">
                  Log a few workouts and stalls, records and trends will show up here automatically.
                </p>
              ) : introLoading ? (
                <Skeleton className="h-4 w-3/4" />
              ) : intro ? (
                <p className="enter-fade text-sm text-inkSoft">{intro}</p>
              ) : insights.length === 0 ? (
                <p className="text-sm text-inkSoft">Nothing notable to flag right now — training looks steady.</p>
              ) : null}
            </div>
            {!noTrainingData && insights.length > 0 && (
              <div className="divide-y divide-border border-t border-border">
                {insights.map((insight) => (
                  <CoachInsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </section>
          <div id="nutrition" className="scroll-mt-6">
            <CoachNutritionCard
              hasBodyStats={hasBodyStats}
              targets={nutritionTargets}
              mealIdeas={mealIdeas}
              mealsLoading={mealsLoading}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
