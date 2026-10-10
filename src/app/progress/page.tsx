"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import { LineChart } from "@/components/LineChart";
import { Sparkline } from "@/components/Sparkline";
import { StatSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from "@/domain/taxonomy";
import { useHydrated, useStore } from "@/lib/store";
import { displayWeight, formatWeight, toDisplay } from "@/lib/units";
import type { PersonalRecord, Units } from "@/domain/types";

type Row = {
  exId: string;
  name: string;
  group: MuscleGroup;
  sessions: number;
  series: { label: string; value: number }[];
  headline: string;
  caption: string;
  trendPct: number | null;
};

const PR_LABEL: Record<PersonalRecord["kind"], string> = {
  e1rm: "Est. 1RM",
  max_weight: "Heaviest",
  max_reps: "Most reps",
};

function prValue(p: PersonalRecord, units: Units): string {
  return p.kind === "max_reps" ? `${p.value} reps` : formatWeight(p.value, units);
}

export default function ProgressPage() {
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const bodyLog = useStore((s) => s.bodyLog);
  const exercisesWithHistory = useStore((s) => s.exercisesWithHistory);
  const exerciseHistory = useStore((s) => s.exerciseHistory);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceForExercise = useStore((s) => s.deviceForExercise);
  const bestsFor = useStore((s) => s.bestsFor);
  const [group, setGroup] = useState<MuscleGroup | "all">("all");

  const rows = useMemo<Row[]>(() => {
    if (!hydrated) return [];
    return exercisesWithHistory()
      .map((exId) => {
        const ex = exerciseById(exId);
        const type = exerciseTypeOf(ex, deviceForExercise(exId));
        const hist = exerciseHistory(exId);
        const bests = bestsFor(exId);
        let series: Row["series"];
        let headline: string;
        let caption: string;
        if (type === "duration") {
          series = hist.map((h) => ({ label: h.date, value: h.durationSec }));
          headline = `${Math.max(0, ...series.map((p) => p.value))} s`;
          caption = "longest hold";
        } else if (type === "cardio") {
          const dist = hist.some((h) => h.distance > 0);
          series = hist.map((h) => ({ label: h.date, value: dist ? h.distance : h.durationMin }));
          headline = `${Math.max(0, ...series.map((p) => p.value))} ${dist ? "km" : "min"}`;
          caption = dist ? "longest distance" : "longest session";
        } else if (type === "bodyweight_reps" || bests.maxWeight <= 0) {
          series = hist.map((h) => ({ label: h.date, value: h.maxReps }));
          headline = `${bests.maxReps} reps`;
          caption = "best set";
        } else {
          series = hist.map((h) => ({ label: h.date, value: displayWeight(h.e1rm || h.topWeight, units) }));
          headline = formatWeight(bests.maxWeight, units);
          caption = bests.e1rm ? `heaviest · est. 1RM ${formatWeight(bests.e1rm, units)}` : "heaviest";
        }
        const first = series[0]?.value ?? 0;
        const last = series[series.length - 1]?.value ?? 0;
        return {
          exId,
          name: ex?.name ?? "Exercise",
          group: muscleGroupOf(ex?.primaryMuscle),
          sessions: hist.length,
          series,
          headline,
          caption,
          trendPct: series.length >= 2 && first > 0 ? Math.round(((last - first) / first) * 100) : null,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);
    // Store selectors read live state; recompute when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sets, sessions, units]);

  const groups = MUSCLE_GROUPS.filter((g) => rows.some((r) => r.group === g.key));
  const visible = group === "all" ? rows : rows.filter((r) => r.group === group);

  const completed = sessions.filter((s) => s.status === "completed");
  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonth = completed.filter((s) => s.date.startsWith(monthKey)).length;
  const recentPrs = [...prs].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)).slice(0, 5);

  const body = [...bodyLog].sort((a, b) => a.date.localeCompare(b.date));
  const bodySeries = body.map((b) => ({ label: b.date, value: Math.round(toDisplay(b.weightKg, units) * 10) / 10 }));

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">How your strength is moving, exercise by exercise.</p>
        </div>
        <Link href="/exercises" className="btn-ghost px-4 py-2.5">
          <Dumbbell className="h-4 w-4" aria-hidden /> Exercise library
        </Link>
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-3 gap-3">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No trends yet"
          body="Log a couple of workouts and your progress for every exercise will show up here."
          action={
            <Link href="/templates" className="btn-primary mt-2">
              Start a workout
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Overview" className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Workouts" value={String(completed.length)} />
            <Stat label="This month" value={String(thisMonth)} />
            <Stat label="Records" value={String(prs.length)} />
          </section>

          {recentPrs.length > 0 && (
            <section className="card space-y-3 p-4 sm:p-6">
              <h2 className="flex items-center gap-2 text-h3 text-ink">
                <Trophy className="h-5 w-5 text-gold" aria-hidden /> Latest records
              </h2>
              <ul className="divide-y divide-border">
                {recentPrs.map((p) => (
                  <li key={`${p.exerciseId}-${p.kind}`}>
                    <Link
                      href={`/exercises/${p.exerciseId}`}
                      className="flex items-center gap-3 py-2.5 text-sm hover:text-accent"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {exerciseById(p.exerciseId)?.name ?? "Exercise"}
                      </span>
                      <span className="text-xs text-muted">{PR_LABEL[p.kind]}</span>
                      <span className="w-24 text-right font-semibold tabular-nums text-ink">{prValue(p, units)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {bodySeries.length >= 2 && (
            <section className="card space-y-3 p-4 sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-h3 text-ink">Bodyweight</h2>
                <Link href="/profile#bodyweight" className="text-sm font-semibold text-accent">
                  Log weight
                </Link>
              </div>
              <LineChart data={bodySeries} unit={units} />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-h2 text-ink">Exercises</h2>
            {groups.length > 1 && (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" style={{ scrollbarWidth: "none" }}>
                {[{ key: "all" as const, label: "All" }, ...groups].map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={group === g.key}
                    onClick={() => setGroup(g.key)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      group === g.key
                        ? "border-accentFill bg-accentFill text-onAccent"
                        : "border-border bg-surface text-inkSoft hover:text-ink"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {visible.map((r) => {
                const trend = r.trendPct == null ? "flat" : r.trendPct >= 5 ? "up" : r.trendPct <= -5 ? "down" : "flat";
                return (
                  <li key={r.exId}>
                    <Link
                      href={`/exercises/${r.exId}`}
                      className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface2/60 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{r.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {r.sessions} session{r.sessions === 1 ? "" : "s"} · {r.caption}
                        </p>
                      </div>
                      <div className="hidden w-24 shrink-0 sm:block">
                        <Sparkline data={r.series} trend={trend} height={36} />
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold tabular-nums text-ink">{r.headline}</p>
                        {r.trendPct != null && trend !== "flat" && (
                          <p className={`text-xs font-semibold ${trend === "up" ? "text-green" : "text-amber"}`}>
                            {trend === "up" ? "▲" : "▼"} {Math.abs(r.trendPct)}%
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
