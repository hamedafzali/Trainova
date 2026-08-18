"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/store";
import { useCoachData } from "@/lib/useCoachData";
import { isAiEnabled } from "@/lib/supabase/client";
import { CoachHeroInsight, pickHeroInsight } from "@/components/CoachHeroInsight";
import { CoachInsightCard } from "@/components/CoachInsightCard";
import { CoachNutritionCard } from "@/components/CoachNutritionCard";
import { CoachSummaryHero } from "@/components/CoachSummaryHero";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";

export default function CoachPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const enabled = isAiEnabled();

  useEffect(() => {
    if (hydrated && !enabled) router.replace("/");
  }, [hydrated, enabled, router]);

  const {
    summary,
    insights,
    intro,
    introLoading,
    nutritionTargets,
    hasBodyStats,
    mealIdeas,
    mealsLoading,
  } = useCoachData();

  if (!hydrated || !enabled) return <main className="min-h-screen" />;

  const noTrainingData = summary.exercises.length === 0 && summary.streakDays === 0;
  const heroInsight = pickHeroInsight(insights);
  const secondaryInsights = heroInsight
    ? insights.filter((i) => i.id !== heroInsight.id)
    : [];

  return (
    <main className="space-y-6">
      <header>
        <h1 className="page-title">Coach</h1>
        <p className="page-subtitle">Proactive notes from your logged training, not guesses.</p>
      </header>

      {noTrainingData ? (
        <EmptyState
          icon="🧠"
          title="Nothing to coach yet"
          body="Log a few sessions and I'll start surfacing stalls, PRs, and trends here."
        />
      ) : (
        <section className="space-y-4">
          {heroInsight && <CoachHeroInsight insight={heroInsight} />}

          <CoachSummaryHero summary={summary} />

          {introLoading ? (
            <Skeleton className="h-5 w-3/4" />
          ) : intro ? (
            <p className="enter-fade text-body text-ink">{intro}</p>
          ) : null}

          {insights.length === 0 ? (
            <p className="text-body-sm text-inkSoft">
              Nothing notable to flag right now — training looks steady.
            </p>
          ) : secondaryInsights.length > 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card divide-y divide-border overflow-hidden">
              {secondaryInsights.map((insight) => (
                <CoachInsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          ) : null}
        </section>
      )}

      <section>
        <CoachNutritionCard
          hasBodyStats={hasBodyStats}
          targets={nutritionTargets}
          mealIdeas={mealIdeas}
          mealsLoading={mealsLoading}
        />
      </section>
    </main>
  );
}
