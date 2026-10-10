"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { CalendarDays, ChevronRight, Clock, Dumbbell, Flame, Play, Plus, Trophy } from "lucide-react";
import { Onboarding } from "@/components/Onboarding";
import { Welcome } from "@/components/Welcome";
import { CoachTeaserCard } from "@/components/CoachTeaserCard";
import { MuscleReadinessCard } from "@/components/MuscleReadinessCard";
import { recommendToday } from "@/domain/adaptive";
import { musclesWorked } from "@/domain/recovery";
import type { Muscle } from "@/domain/taxonomy";
import { localDayKey, weekDays, weekStreak } from "@/domain/streak";
import { totalVolume } from "@/domain/volume";
import { useHydrated, useStore } from "@/lib/store";
import { formatVolume } from "@/lib/units";

function greeting(h: number) {
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const session = useStore((s) => s.session);
  const profile = useStore((s) => s.profile);
  const units = useStore((s) => s.units);
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const feedback = useStore((s) => s.feedback);
  const exerciseById = useStore((s) => s.exerciseById);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);

  const today = new Date();
  const todayKey = localDayKey(today);
  const week = weekDays(today);

  const stats = useMemo(() => {
    const trained = new Set<string>();
    for (const s of sessions) if (s.status !== "archived") trained.add(s.date);
    const weekSessions = sessions.filter((s) => s.status === "completed" && week.includes(s.date));
    const ids = new Set(weekSessions.map((s) => s.id));
    const weekSets = sets.filter((x) => ids.has(x.sessionId) && x.completed);
    const minutes = weekSessions.reduce(
      (n, s) => n + (s.completedAt ? Math.max(1, Math.round((+new Date(s.completedAt) - +new Date(s.startedAt)) / 60000)) : 0),
      0,
    );
    return {
      trained,
      streak: weekStreak(trained, today),
      workouts: weekSessions.length,
      volume: totalVolume(weekSets),
      minutes,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sets, todayKey]);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!session) return <Welcome />;
  if (!profile.onboarded) return <Onboarding />;

  const active = getActiveSession();
  const start = (templateId: string | null) => {
    const { id, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };

  const rec = recommendToday({ templates, programs, sessions, feedback });
  const next = rec ? templates.find((t) => t.id === rec.templateId) : undefined;
  const nextProgram = next ? programs.find((p) => p.dayTemplateIds.includes(next.id)) : undefined;
  const nextDayIndex = next && nextProgram ? nextProgram.dayTemplateIds.indexOf(next.id) : -1;
  const nextMinutes = next
    ? Math.max(5, Math.round(next.exercises.reduce((n, te) => n + te.sets.length * (40 + te.restSeconds), 0) / 60 / 5) * 5)
    : 0;
  const trainedToday = stats.trained.has(todayKey);
  // Muscles the next workout trains as a primary mover, outlined on the readiness map.
  const targets = new Set<Muscle>(
    active || !next
      ? []
      : next.exercises.flatMap((te) =>
          musclesWorked(exerciseById(te.exerciseId))
            .filter((w) => w.share === 1)
            .map((w) => w.muscle),
        ),
  );

  const recent = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 3);
  const prDays = new Set(prs.map((p) => p.achievedAt.slice(0, 10)));

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-medium text-muted">
          {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="page-title">
          {greeting(today.getHours())}
          {profile.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {active ? (
            <Link
              href={`/session/${active.id}`}
              className="card block border-accent/30 bg-accent/[0.06] p-5 transition-colors hover:bg-accent/[0.1] sm:p-6"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden /> Workout in progress
              </p>
              <p className="mt-2 text-2xl font-bold text-ink">{active.title}</p>
              <p className="mt-1 text-sm text-inkSoft">
                Started {new Date(active.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </p>
              <span className="btn-primary mt-4 w-full sm:w-auto sm:px-8">
                <Play className="h-4 w-4" aria-hidden /> Resume workout
              </span>
            </Link>
          ) : next ? (
            <section
              className={`card p-5 sm:p-6 ${rec?.mode === "recovery" ? "border-amber/40" : ""}`}
              aria-labelledby="next-workout"
            >
              <p className="section-label">
                {trainedToday ? "Next workout" : "Today's workout"}
                {nextProgram && ` · ${nextProgram.name} · Day ${nextDayIndex + 1} of ${nextProgram.dayTemplateIds.length}`}
              </p>
              <h2 id="next-workout" className="mt-1 text-2xl font-bold text-ink">
                {next.name}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <Dumbbell className="h-3.5 w-3.5" aria-hidden /> {next.exercises.length} exercises
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> ~{nextMinutes} min
                </span>
              </p>
              {next.exercises.length > 0 && (
                <ol className="mt-4 space-y-1.5">
                  {next.exercises.slice(0, 6).map((te) => (
                    <li key={te.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-inkSoft">{exerciseById(te.exerciseId)?.name ?? "Exercise"}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {te.sets.length} × {te.sets[0]?.targetReps ?? "–"}
                      </span>
                    </li>
                  ))}
                  {next.exercises.length > 6 && (
                    <li className="text-xs text-muted">+{next.exercises.length - 6} more</li>
                  )}
                </ol>
              )}
              {rec?.mode === "recovery" && (
                <p className="mt-4 rounded-control bg-amber/10 p-3 text-sm text-inkSoft">
                  <span className="font-semibold text-ink">{rec.headline}. </span>
                  {rec.reason}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  className="btn-primary flex-1 py-3.5 text-base"
                  disabled={next.exercises.length === 0}
                  onClick={() => start(next.id)}
                >
                  <Play className="h-4 w-4" aria-hidden /> Start workout
                </button>
                <Link href={`/templates/${next.id}`} className="btn-ghost sm:px-6">
                  Edit plan
                </Link>
              </div>
            </section>
          ) : (
            <section className="card space-y-3 p-5 text-center sm:p-8">
              <p className="text-xl font-bold text-ink">Pick a program to get started</p>
              <p className="mx-auto max-w-sm text-sm text-inkSoft">
                Choose a ready-made program from the library or build your own workout.
              </p>
              <Link href="/templates" className="btn-primary mx-auto">
                Browse programs
              </Link>
            </section>
          )}

          {!active && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => start(null)} className="btn-secondary px-4 py-2.5 text-sm">
                <Plus className="h-4 w-4" aria-hidden /> Empty workout
              </button>
              <Link href="/templates" className="btn-ghost px-4 py-2.5 text-sm">
                All plans
              </Link>
            </div>
          )}

          <MuscleReadinessCard targets={targets} workoutName={next && !active ? next.name : undefined} />

          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-h2 text-ink">Recent workouts</h2>
              {recent.length > 0 && (
                <Link href="/history" className="text-sm font-semibold text-accent">
                  See all
                </Link>
              )}
            </div>
            {recent.length === 0 ? (
              <p className="card p-6 text-center text-sm text-muted">
                Your finished workouts will show up here.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                {recent.map((s) => {
                  const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
                  const vol = totalVolume(mine);
                  return (
                    <li key={s.id}>
                      <Link href={`/session/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface2/60 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            <span className="truncate">{s.title}</span>
                            {prDays.has(s.startedAt.slice(0, 10)) && (
                              <Trophy className="h-4 w-4 shrink-0 text-gold" aria-label="Personal record" />
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            {` · ${mine.length} sets`}
                            {vol > 0 && ` · ${formatVolume(vol, units)}`}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-4 p-5" aria-labelledby="this-week">
            <div className="flex items-center justify-between">
              <h2 id="this-week" className="section-label">
                This week
              </h2>
              <Link href="/calendar" className="-my-3 -mr-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-accent">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Calendar
              </Link>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {week.map((k) => {
                const d = new Date(k + "T00:00:00");
                const trained = stats.trained.has(k);
                const isToday = k === todayKey;
                return (
                  <div key={k} className="flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-accent" : "text-muted"}`}>
                      {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                    </span>
                    <span
                      className={`grid aspect-square w-full max-w-[2.25rem] place-items-center rounded-full text-xs font-semibold tabular-nums ${
                        trained
                          ? "bg-green text-onStatus"
                          : isToday
                            ? "border-2 border-accent text-accent"
                            : k > todayKey
                              ? "text-muted"
                              : "bg-surface2 text-muted"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
            <dl className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              <div>
                <dt className="text-[11px] text-muted">Workouts</dt>
                <dd className="text-lg font-bold tabular-nums text-ink">{stats.workouts}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">Volume</dt>
                <dd className="truncate text-lg font-bold tabular-nums text-ink">{formatVolume(stats.volume, units)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">Time</dt>
                <dd className="text-lg font-bold tabular-nums text-ink">{stats.minutes}m</dd>
              </div>
            </dl>
            <p className="flex items-center gap-2 rounded-control bg-surface2 px-3 py-2 text-sm text-inkSoft">
              <Flame className={`h-4 w-4 ${stats.streak > 0 ? "text-flame" : "text-muted"}`} aria-hidden />
              {stats.streak > 0
                ? `${stats.streak}-week streak — keep it going`
                : "Train once this week to start a streak"}
            </p>
          </section>

          <CoachTeaserCard />
        </aside>
      </div>
    </main>
  );
}
