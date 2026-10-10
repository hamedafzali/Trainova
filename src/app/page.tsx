"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { CalendarDays, ChevronRight, Clock, Dumbbell, Flame, Layers, Play, Plus, Trophy } from "lucide-react";
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
import { label } from "@/domain/taxonomy";

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

  const nextSets = next ? next.exercises.reduce((n, te) => n + te.sets.length, 0) : 0;
  const activeSets = active ? sets.filter((x) => x.sessionId === active.id) : [];
  const activeDone = activeSets.filter((x) => x.completed).length;
  // Weekly target: the program's days per week, else three sessions.
  const weekGoal = nextProgram?.dayTemplateIds.length || 3;


  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="section-label">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="page-title mt-1.5">
            {greeting(today.getHours())}
            {profile.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""}
          </h1>
        </div>
        {stats.streak > 0 && (
          <span className="badge-flame shrink-0 py-1.5" title="Weeks in a row with a workout">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            <span className="font-display">{stats.streak}</span> wk streak
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {active ? (
            <Link href={`/session/${active.id}`} className="night-card group block p-6 sm:p-7">
              <HeroMark />
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-volt">
                <span className="h-2 w-2 rounded-full bg-volt motion-safe:animate-pulse" aria-hidden /> Workout in progress
              </p>
              <p className="font-display mt-3 text-[1.9rem] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[2.4rem]">
                {active.title}
              </p>
              <p className="mt-2 text-sm text-white/65">
                Started {new Date(active.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                {activeSets.length > 0 && ` · ${activeDone} of ${activeSets.length} sets`}
              </p>
              {activeSets.length > 0 && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div className="h-full rounded-full bg-volt" style={{ width: `${(activeDone / activeSets.length) * 100}%` }} />
                </div>
              )}
              <span className="btn-volt mt-6 w-full py-3.5 text-base sm:w-auto sm:px-10">
                <Play className="h-4 w-4 fill-current" aria-hidden /> Resume workout
              </span>
            </Link>
          ) : next ? (
            <section className="night-card p-6 sm:p-7" aria-labelledby="next-workout">
              <HeroMark />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                {trainedToday ? "Next workout" : "Today's workout"}
                {nextProgram && ` · Day ${nextDayIndex + 1} of ${nextProgram.dayTemplateIds.length}`}
              </p>
              <h2
                id="next-workout"
                className="font-display mt-2 text-[1.9rem] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[2.4rem]"
              >
                {next.name}
              </h2>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <HeroStat icon={Dumbbell}>{next.exercises.length} exercises</HeroStat>
                <HeroStat icon={Layers}>{nextSets} sets</HeroStat>
                <HeroStat icon={Clock}>~{nextMinutes} min</HeroStat>
              </p>
              {targets.size > 0 && (
                <p className="mt-3 text-sm text-white/65">
                  Targets{" "}
                  <span className="font-semibold text-white">
                    {[...targets].slice(0, 4).map(label).join(" · ")}
                  </span>
                </p>
              )}
              {next.exercises.length > 0 && (
                <ol className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                  {next.exercises.slice(0, 5).map((te, i) => (
                    <li key={te.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="font-display w-6 shrink-0 text-xs font-bold text-white/40">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-white/90">
                        {exerciseById(te.exerciseId)?.name ?? "Exercise"}
                      </span>
                      <span className="font-display shrink-0 text-xs font-semibold text-white/60">
                        {te.sets.length} × {te.sets[0]?.targetReps ?? "–"}
                      </span>
                    </li>
                  ))}
                  {next.exercises.length > 5 && (
                    <li className="py-2.5 text-xs text-white/50">+{next.exercises.length - 5} more</li>
                  )}
                </ol>
              )}
              {rec?.mode === "recovery" && (
                <p className="mt-4 rounded-control border-l-2 border-volt bg-white/[0.06] p-3 text-sm text-white/75">
                  <span className="font-semibold text-white">{rec.headline}. </span>
                  {rec.reason}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  className="btn-volt flex-1 py-3.5 text-base"
                  disabled={next.exercises.length === 0}
                  onClick={() => start(next.id)}
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden /> Start workout
                </button>
                <Link href={`/templates/${next.id}`} className="btn bg-white/10 text-white hover:bg-white/15 sm:px-6">
                  Edit plan
                </Link>
              </div>
            </section>
          ) : (
            <section className="night-card space-y-3 p-6 text-center sm:p-8">
              <HeroMark />
              <p className="font-display text-2xl font-extrabold">Pick a program to get started</p>
              <p className="mx-auto max-w-sm text-sm text-white/70">
                Choose a ready-made program from the library or build your own workout.
              </p>
              <Link href="/templates" className="btn-volt mx-auto">
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
              <h2 className="font-display text-h2 font-extrabold text-ink">Recent workouts</h2>
              {recent.length > 0 && (
                <Link href="/history" className="-my-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent">
                  See all
                </Link>
              )}
            </div>
            {recent.length === 0 ? (
              <p className="card p-6 text-center text-sm text-muted">
                Your finished workouts will show up here.
              </p>
            ) : (
              <ul className="space-y-2">
                {recent.map((s) => {
                  const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
                  const vol = totalVolume(mine);
                  const d = new Date(s.startedAt);
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/session/${s.id}`}
                        className="card flex items-center gap-4 p-3 pr-4 transition-colors hover:border-accent/30"
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-accent/[0.08] text-accent" aria-hidden>
                          <span className="text-center leading-none">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide">
                              {d.toLocaleDateString(undefined, { month: "short" })}
                            </span>
                            <span className="font-display block text-lg font-extrabold">{d.getDate()}</span>
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            <span className="truncate">{s.title}</span>
                            {prDays.has(s.startedAt.slice(0, 10)) && (
                              <Trophy className="h-4 w-4 shrink-0 text-gold" aria-label="Personal record" />
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {d.toLocaleDateString(undefined, { weekday: "long" })}
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
          <section className="card space-y-5 p-5" aria-labelledby="this-week">
            <div className="flex items-center justify-between">
              <h2 id="this-week" className="section-label">
                This week
              </h2>
              <Link href="/calendar" className="-my-3 -mr-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-accent">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Calendar
              </Link>
            </div>
            <div className="flex items-center gap-5">
              <GoalRing done={stats.workouts} goal={weekGoal} />
              <dl className="grid flex-1 gap-3">
                <div>
                  <dt className="text-[11px] text-muted">Volume</dt>
                  <dd className="font-display truncate text-xl font-extrabold text-ink">{formatVolume(stats.volume, units)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted">Time trained</dt>
                  <dd className="font-display text-xl font-extrabold text-ink">{stats.minutes} min</dd>
                </div>
              </dl>
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

/** Oversized, faint Trainova mark bleeding off the hero card's corner. */
function HeroMark() {
  return (
    <svg
      viewBox="0 0 512 512"
      className="pointer-events-none absolute -bottom-16 -right-14 -z-10 h-64 w-64 rotate-[-12deg] text-white opacity-[0.05]"
      fill="currentColor"
      aria-hidden
    >
      <rect x="78" y="112" width="44" height="124" rx="14" />
      <rect x="130" y="134" width="30" height="80" rx="10" />
      <rect x="352" y="134" width="30" height="80" rx="10" />
      <rect x="390" y="112" width="44" height="124" rx="14" />
      <rect x="150" y="154" width="212" height="40" rx="10" />
      <rect x="224" y="174" width="64" height="230" rx="32" />
    </svg>
  );
}

function HeroStat({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 ring-1 ring-inset ring-white/10">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

/** Weekly goal ring: workouts done vs the week's target, overflowing in gold. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, done / goal);
  const met = done >= goal;
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${done} of ${goal} workouts this week`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-surface2" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`${met ? "stroke-gold" : "stroke-accent"} transition-[stroke-dashoffset] duration-700 ease-standard`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden>
        <div>
          <p className="font-display text-[1.6rem] font-extrabold leading-none text-ink">
            {done}
            <span className="text-base text-muted">/{goal}</span>
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{met ? "Goal hit" : "Workouts"}</p>
        </div>
      </div>
    </div>
  );
}
