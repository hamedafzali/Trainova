"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Bell,
  BicepsFlexed,
  ChartNoAxesColumnIncreasing,
  Clock,
  Dumbbell,
  FileText,
  Flame,
  Play,
  Plus,
  Salad,
  Sparkles,
} from "lucide-react";
import { Onboarding } from "@/components/Onboarding";
import { Welcome } from "@/components/Welcome";
import { DayDots } from "@/components/ui/DayDots";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { QuickAction } from "@/components/ui/QuickAction";
import { WorkoutArt } from "@/components/ui/WorkoutArt";
import { recommendToday } from "@/domain/adaptive";
import { estimateDuration } from "@/domain/duration";
import { localDayKey, weekDays, weekStreak } from "@/domain/streak";
import { label } from "@/domain/taxonomy";
import { useHydrated, useStore } from "@/lib/store";

function greeting(h: number) {
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const session = useStore((s) => s.session);
  const profile = useStore((s) => s.profile);
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const feedback = useStore((s) => s.feedback);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);

  const today = new Date();
  const todayKey = localDayKey(today);
  const week = weekDays(today);

  const stats = useMemo(() => {
    const trained = new Set<string>();
    for (const s of sessions) if (s.status !== "archived") trained.add(s.date);
    const weekSessions = sessions.filter((s) => s.status === "completed" && week.includes(s.date));
    return {
      trained,
      weekDone: new Set(weekSessions.map((s) => s.date)),
      workouts: weekSessions.length,
      streak: weekStreak(trained, today),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, todayKey]);

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
  const trainedToday = stats.trained.has(todayKey);
  const activeSets = active ? sets.filter((x) => x.sessionId === active.id) : [];
  const activeDone = activeSets.filter((x) => x.completed).length;
  // Weekly goal: the coaching schedule, else the program's days, else three.
  const weekGoal = profile.coaching?.daysPerWeek || nextProgram?.dayTemplateIds.length || 3;
  const level = profile.experience ? label(profile.experience) : null;
  const firstName = profile.displayName?.split(" ")[0];

  return (
    <main className="mx-auto max-w-xl space-y-5 pb-20 md:pb-0">
      <header className="flex items-center justify-between">
        <LogoGlyph />
        <Link
          href="/coach"
          className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-surface"
          aria-label="Coach updates"
        >
          <Bell className="h-6 w-6" strokeWidth={1.7} aria-hidden />
        </Link>
      </header>

      <section className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] text-inkSoft">
            {greeting(today.getHours())}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="font-display mt-1 text-[1.75rem] font-bold leading-[1.15] min-[400px]:text-[2rem] tracking-[-0.02em] text-ink">
            {trainedToday ? (
              <>
                Great work <span className="text-accent">today</span>.
              </>
            ) : (
              <>
                <span className="whitespace-nowrap">
                  Ready to <span className="text-accent">forge</span>
                </span>
                <br />
                greatness.
              </>
            )}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-card bg-surface px-3.5 py-3" title="Weeks in a row with a workout">
          <Flame className={`h-7 w-7 ${stats.streak > 0 ? "fill-flame/30 text-flame" : "text-muted"}`} aria-hidden />
          <div className="leading-tight">
            <p className="text-xs text-ink">Streak</p>
            <p className="text-base font-semibold tabular-nums text-accent">
              {stats.streak} {stats.streak === 1 ? "week" : "weeks"}
            </p>
          </div>
        </div>
      </section>

      <section className="card flex items-center justify-between gap-4 p-5" aria-labelledby="weekly-progress">
        <div className="min-w-0 space-y-3">
          <div>
            <h2 id="weekly-progress" className="text-[15px] text-ink">
              Weekly Progress
            </h2>
            <p className="font-display mt-2 text-[2rem] font-bold leading-none tabular-nums text-ink">
              {stats.workouts} / {weekGoal}
            </p>
            <p className="mt-1.5 text-sm text-inkSoft">Workouts completed</p>
          </div>
          <DayDots days={week} trained={stats.weekDone} today={todayKey} />
        </div>
        <ProgressRing value={stats.workouts / weekGoal} label={`${stats.workouts} of ${weekGoal} workouts this week`} />
      </section>

      <section aria-labelledby="todays-workout" className="space-y-3">
        <h2 id="todays-workout" className="text-[17px] font-medium text-ink">
          {active ? "Workout in Progress" : trainedToday ? "Next Workout" : "Today's Workout"}
        </h2>
        {active ? (
          <WorkoutCard title={active.title}>
            <p className="flex items-center gap-2 text-sm text-white/80">
              <span className="h-2 w-2 rounded-full bg-volt motion-safe:animate-pulse" aria-hidden />
              {activeSets.length > 0 ? `${activeDone} of ${activeSets.length} sets done` : "Started"}
            </p>
            <Link href={`/session/${active.id}`} className="btn-volt mt-5 px-5 py-3 text-[15px]">
              Resume Workout <Play className="h-4 w-4 fill-current" aria-hidden />
            </Link>
          </WorkoutCard>
        ) : next ? (
          <WorkoutCard title={next.name}>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden /> {estimateDuration(next)} min
              </span>
              {level && (
                <span className="inline-flex items-center gap-1.5">
                  <ChartNoAxesColumnIncreasing className="h-4 w-4" aria-hidden /> {level}
                </span>
              )}
            </p>
            {rec?.mode === "recovery" && <p className="mt-2 max-w-[15rem] text-xs text-white/70">{rec.headline}</p>}
            <button
              type="button"
              className="btn-volt mt-5 px-5 py-3 text-[15px]"
              disabled={next.exercises.length === 0}
              onClick={() => start(next.id)}
            >
              Start Workout <Play className="h-4 w-4 fill-current" aria-hidden />
            </button>
          </WorkoutCard>
        ) : (
          <WorkoutCard title="Pick a plan to get started">
            <p className="max-w-[15rem] text-sm text-white/75">Choose a ready-made program or start an empty workout.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/programs" className="btn-volt px-5 py-3 text-[15px]">
                Browse Programs
              </Link>
              <button type="button" onClick={() => start(null)} className="btn bg-white/10 px-4 text-white hover:bg-white/15">
                <Plus className="h-4 w-4" aria-hidden /> Empty
              </button>
            </div>
          </WorkoutCard>
        )}
      </section>

      <section aria-labelledby="quick-actions" className="space-y-3">
        <h2 id="quick-actions" className="text-[17px] font-medium text-ink">
          Quick Actions
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction href="/templates" icon={Dumbbell} label="Workouts" />
          <QuickAction href="/exercises" icon={BicepsFlexed} label="Exercises" />
          <QuickAction href="/programs" icon={FileText} label="Programs" />
          <QuickAction href="/coach#nutrition" icon={Salad} label="Nutrition" />
        </div>
      </section>

      <Link
        href="/coach"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-accentFill text-onAccent shadow-elevated transition-transform active:scale-95 md:bottom-8 md:right-8"
        aria-label="Ask your AI coach"
        data-testid="coach-fab"
      >
        <Sparkles className="h-6 w-6" aria-hidden />
      </Link>
    </main>
  );
}

function WorkoutCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="night-card min-h-[15rem]">
      <WorkoutArt className="absolute inset-0 -z-10 h-full w-full" />
      <div className="flex min-h-[15rem] flex-col justify-end p-5">
        <p className="font-display max-w-[13rem] text-[1.6rem] font-bold leading-[1.15] tracking-[-0.01em] text-white">{title}</p>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/** The Trainova mark as a bare lime glyph (Home header). */
function LogoGlyph() {
  return (
    <svg viewBox="70 104 372 308" className="h-8 w-9 text-accent" fill="currentColor" role="img" aria-label="Trainova">
      <rect x="78" y="112" width="44" height="124" rx="14" />
      <rect x="130" y="134" width="30" height="80" rx="10" />
      <rect x="352" y="134" width="30" height="80" rx="10" />
      <rect x="390" y="112" width="44" height="124" rx="14" />
      <rect x="150" y="154" width="212" height="40" rx="10" />
      <rect x="224" y="174" width="64" height="230" rx="32" />
    </svg>
  );
}
