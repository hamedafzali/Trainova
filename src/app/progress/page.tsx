"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Clock, Dumbbell, Flame, Trophy } from "lucide-react";
import { LineChart } from "@/components/LineChart";
import { IconButton, ListCard, ListRow, PageHeader, StatBand } from "@/components/kit";
import { MuscleReadinessCard } from "@/components/MuscleReadinessCard";
import { RecoveryCard } from "@/components/RecoveryCard";
import { Donut, DONUT_COLORS } from "@/components/ui/Donut";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { StrengthChart } from "@/components/ui/StrengthChart";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useTabParam } from "@/lib/useTabParam";
import { formatMinutes, periodFor, summarisePeriod, weeklyBest, type PeriodKind } from "@/domain/periodStats";
import { localDayKey, startOfWeek } from "@/domain/streak";
import { Sparkline } from "@/components/Sparkline";
import { StatSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { TrainingAnalyst } from "@/components/TrainingAnalyst";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from "@/domain/taxonomy";
import { useHydrated, useStore } from "@/lib/store";
import { displayWeight, formatWeight, toDisplay } from "@/lib/units";
import type { PersonalRecord, Units } from "@/domain/types";

type Tab = "overview" | "strength" | "body" | "workouts";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "strength", label: "Strength" },
  { key: "body", label: "Body" },
  { key: "workouts", label: "Workouts" },
];
const TAB_KEYS = TABS.map((t) => t.key);

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
  const [tab, setTab] = useTabParam(TAB_KEYS, "overview");
  const [kind, setKind] = useState<PeriodKind>("week");
  const [offset, setOffset] = useState(0);
  const [liftId, setLiftId] = useState<string | null>(null);
  const exercises = useStore((s) => s.exercises);
  const profileWeight = useStore((s) => s.profile.weightKg ?? null);

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
  const recentPrs = [...prs].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)).slice(0, 5);

  const body = [...bodyLog].sort((a, b) => a.date.localeCompare(b.date));
  const bodySeries = body.map((b) => ({ label: b.date, value: Math.round(toDisplay(b.weightKg, units) * 10) / 10 }));

  const today = new Date();
  const period = periodFor(kind, offset, today);
  const summary = summarisePeriod(
    { sessions, sets, exercises, prs, bodyweightKg: body[body.length - 1]?.weightKg ?? profileWeight },
    period,
  );

  // Strength Progress: weighted lifts only, best est. 1RM per week over five weeks.
  const lifts = rows.filter((r) => r.caption.startsWith("heaviest"));
  const lift = lifts.find((r) => r.exId === liftId) ?? lifts[0];
  const weekly = lift
    ? weeklyBest(
        exerciseHistory(lift.exId).map((h) => ({ date: h.date, value: h.e1rm })),
        5,
        today,
      ).map((w) => ({
        label: new Date(w.week + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        week: w.week,
        value: displayWeight(w.value, units),
      }))
    : [];
  const latest = weekly[weekly.length - 1];
  const prior = weekly.length >= 2 ? weekly[weekly.length - 2] : undefined;
  const change = latest && prior ? Math.round((latest.value - prior.value) * 10) / 10 : null;
  // Weeks with no session are absent, so only say "last week" when it really was.
  const lastWeek = localDayKey(startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)));
  const vsLabel = prior?.week === lastWeek && latest?.week === localDayKey(startOfWeek(today)) ? "vs last week" : "vs previous";

  const recentWorkouts = [...completed].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12);

  return (
    <main className="mx-auto max-w-3xl">
      <div className="mb-4">
        <PageHeader
          title="Progress"
          subtitle="What you've done and how you're getting stronger."
          actions={<IconButton href="/calendar" icon={CalendarDays} label="Calendar" />}
        />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Progress sections" idPrefix="pr" />

      {!hydrated ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <TabPanel idPrefix="pr" tab="overview">
              <div className="mt-4 space-y-3">
                <PeriodPicker
                  kind={kind}
                  offset={offset}
                  period={period}
                  onKind={(k) => {
                    setKind(k);
                    setOffset(0);
                  }}
                  onOffset={setOffset}
                />

                <StatBand
                  label="Workout summary"
                  columns="1.3fr 1fr 1fr 0.8fr"
                  className="rise"
                  stats={[
                    { label: "Workouts", value: summary.workouts },
                    { label: "Time", value: formatMinutes(summary.minutes) },
                    {
                      label: "Kcal*",
                      value: summary.calories.toLocaleString(),
                      title: `Estimated: about 5 MET × ${summary.bodyweightAssumed ? "75 kg (no bodyweight logged)" : "your bodyweight"} × time trained`,
                    },
                    { label: "PRs", value: summary.prs, footClass: "text-gold", foot: summary.prs > 0 ? "New records" : undefined },
                  ]}
                />
                <p className="px-1 text-[11px] text-muted">
                  *Estimated from time trained{summary.bodyweightAssumed ? " and a 75 kg default — log your weight for a closer figure" : " and your bodyweight"}.
                </p>

                <section className="card p-4" aria-labelledby="focus-title">
                  <h2 id="focus-title" className="text-[17px] font-semibold tracking-tight text-ink">
                    Muscle Focus
                  </h2>
                  {summary.muscles.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">No working sets in this period.</p>
                  ) : (
                    <div className="mt-3 flex items-center gap-6">
                      <Donut values={summary.muscles.map((m) => m.pct)} />
                      <ul className="min-w-0 flex-1 space-y-2.5">
                        {summary.muscles.map((m, i) => (
                          <li key={m.group} className="flex items-center gap-3 text-[15px]">
                            <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${DONUT_COLORS[i % DONUT_COLORS.length]}`} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-inkSoft">{m.label}</span>
                            <span className="tabular-nums text-ink">{m.pct}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                <section className="card p-4" aria-labelledby="strength-title">
                  <div className="flex items-center justify-between">
                    <h2 id="strength-title" className="text-[17px] font-semibold tracking-tight text-ink">
                      Strength Progress
                    </h2>
                    <button type="button" onClick={() => setTab("strength")} className="-mr-2 min-h-11 px-2 text-[15px] text-accent">
                      View all
                    </button>
                  </div>
                  {!lift ? (
                    <p className="py-6 text-center text-sm text-muted">Log a weighted lift to see your strength trend.</p>
                  ) : (
                    <>
                      <label className="relative mt-1 inline-block">
                        <span className="sr-only">Exercise</span>
                        <select
                          value={lift.exId}
                          onChange={(e) => setLiftId(e.target.value)}
                          className="min-h-10 max-w-[16rem] appearance-none truncate rounded-control border border-border bg-surface py-1.5 pl-3 pr-9 text-sm text-inkSoft outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                        >
                          {lifts.map((r) => (
                            <option key={r.exId} value={r.exId}>
                              {r.name} (1RM)
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkSoft" aria-hidden />
                      </label>
                      {latest && (
                        <div className="mt-3">
                          <p className="text-ink">
                            <span className="font-display text-[1.75rem] font-semibold tabular-nums">{latest.value}</span>{" "}
                            <span className="text-lg text-inkSoft">{units}</span>
                          </p>
                          {change !== null && (
                            <p className="text-sm text-inkSoft">
                              <span className={change >= 0 ? "text-accent" : "text-amber"}>
                                {change >= 0 ? "+" : ""}
                                {change} {units}
                              </span>{" "}
                              {vsLabel}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-2">
                        <StrengthChart data={weekly} unit={units} />
                      </div>
                      <p className="text-xs text-muted">Best estimated 1RM per week, last 5 weeks.</p>
                    </>
                  )}
                </section>
              </div>
            </TabPanel>
          )}

          {tab === "strength" && (
            <TabPanel idPrefix="pr" tab="strength">
              <div className="mt-4 space-y-6">
                {rows.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
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
                    <TrainingAnalyst />
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
                              className={`min-h-11 shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
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
              </div>
            </TabPanel>
          )}

          {tab === "body" && (
            <TabPanel idPrefix="pr" tab="body">
              <div className="mt-4 space-y-4">
                <section className="card space-y-3 p-4 sm:p-6">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[17px] font-semibold tracking-tight text-ink">Bodyweight</h2>
                    <Link href="/profile#bodyweight" className="text-sm text-accent">
                      Log weight
                    </Link>
                  </div>
                  {bodySeries.length >= 2 ? (
                    <LineChart data={bodySeries} unit={units} />
                  ) : (
                    <p className="py-4 text-center text-sm text-muted">Log your weight twice to see a trend.</p>
                  )}
                </section>
                <RecoveryCard />
                <MuscleReadinessCard targets={new Set()} />
              </div>
            </TabPanel>
          )}

          {tab === "workouts" && (
            <TabPanel idPrefix="pr" tab="workouts">
              <div className="mt-4 space-y-3">
                {recentWorkouts.length === 0 ? (
                  <p className="card p-6 text-center text-sm text-muted">Your finished workouts will show up here.</p>
                ) : (
                  <ListCard>
                    {recentWorkouts.map((w) => {
                      const n = sets.filter((x) => x.sessionId === w.id && x.completed).length;
                      return (
                        <ListRow
                          key={w.id}
                          href={`/session/${w.id}`}
                          icon={Dumbbell}
                          title={w.title}
                          meta={`${new Date(w.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${n} sets`}
                        />
                      );
                    })}
                  </ListCard>
                )}
                <Link href="/history" className="btn-secondary w-full">
                  Full history
                </Link>
              </div>
            </TabPanel>
          )}
        </>
      )}
    </main>
  );
}
