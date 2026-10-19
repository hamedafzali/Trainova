"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Bell, Check, ChevronRight, Dumbbell, Flame, MessageSquareText, Play, Plus, Sparkles } from "lucide-react";
import { Onboarding } from "@/components/Onboarding";
import { Welcome } from "@/components/Welcome";
import { recommendToday } from "@/domain/adaptive";
import { estimateDuration } from "@/domain/duration";
import { sessionMinutes } from "@/domain/periodStats";
import { localDayKey, startOfWeek, weekDays, weekStreak } from "@/domain/streak";
import { label } from "@/domain/taxonomy";
import { calcSetVolume } from "@/domain/volume";
import { useHydrated, useStore } from "@/lib/store";
import { formatWeight, toDisplay } from "@/lib/units";
import type { Units } from "@/domain/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Weeks of volume behind the sparkline, oldest first, this week last. */
const VOLUME_WEEKS = 6;

function greeting(h: number) {
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const shortDate = (k: string) =>
  new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function HomePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const session = useStore((s) => s.session);
  const profile = useStore((s) => s.profile);
  const units = useStore((s) => s.units);
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const feedback = useStore((s) => s.feedback);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);

  const today = new Date();
  const todayKey = localDayKey(today);
  const week = weekDays(today);

  const stats = useMemo(() => {
    const trained = new Set<string>();
    for (const s of sessions) if (s.status !== "archived") trained.add(s.date);
    const completed = sessions.filter((s) => s.status === "completed");
    const weekDone = new Set(completed.filter((s) => week.includes(s.date)).map((s) => s.date));

    // Working-set volume per week, this week last.
    const weekStart = +startOfWeek(today);
    const weekOf = new Map(
      completed.map((s) => [s.id, Math.floor((weekStart - +startOfWeek(new Date(s.date + "T00:00:00"))) / WEEK_MS + 0.5)]),
    );
    const volume = new Array<number>(VOLUME_WEEKS).fill(0);
    const exercisesIn = new Map<string, Set<string>>();
    for (const x of sets) {
      if (!x.completed) continue;
      const ago = weekOf.get(x.sessionId);
      if (ago === undefined) continue;
      if (ago < VOLUME_WEEKS) volume[VOLUME_WEEKS - 1 - ago] += calcSetVolume(x);
      if (!exercisesIn.has(x.sessionId)) exercisesIn.set(x.sessionId, new Set());
      exercisesIn.get(x.sessionId)!.add(x.exerciseId);
    }

    const recent = [...completed]
      .sort((a, b) => (b.completedAt ?? b.date).localeCompare(a.completedAt ?? a.date))
      .slice(0, 3)
      .map((s) => ({ ...s, exerciseCount: exercisesIn.get(s.id)?.size ?? 0, minutes: sessionMinutes(s) }));

    return { trained, weekDone, volume, recent, streak: weekStreak(trained, today) };
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
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const activeSets = active ? sets.filter((x) => x.sessionId === active.id) : [];
  const activeDone = activeSets.filter((x) => x.completed).length;
  const firstName = profile.displayName?.split(" ")[0];
  const muscles = next
    ? [...new Set(next.exercises.map((te) => exerciseById.get(te.exerciseId)?.primaryMuscle).filter(Boolean) as string[])]
        .slice(0, 3)
        .map(label)
    : [];
  const latestPr = [...prs].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))[0];

  return (
    <main className="mx-auto max-w-xl space-y-5 pb-24 md:pb-0">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/profile"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-sm font-semibold text-accent"
            aria-label="Profile"
          >
            {firstName ? firstName.charAt(0).toUpperCase() : <Dumbbell className="h-4 w-4" aria-hidden />}
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
            {greeting(today.getHours())}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <Link
          href="/coach"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-control border border-border bg-surface text-inkSoft transition-colors hover:text-ink active:scale-95"
          aria-label="Coach updates"
        >
          <Bell className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      {/* Today's workout */}
      <section className="hero-card rise group" aria-labelledby="todays-workout">
        <Dumbbell
          className="pointer-events-none absolute -right-6 -top-4 -z-10 h-36 w-36 -rotate-12 text-white/[0.03]"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="eyebrow mb-3 text-white/60">
          {active ? (
            <>
              <span className="h-2 w-2 rounded-full bg-volt motion-safe:animate-pulse" aria-hidden /> In progress
            </>
          ) : (
            <>
              <Dumbbell className="h-3.5 w-3.5" aria-hidden /> {stats.trained.has(todayKey) ? "Up next" : "Today's plan"}
            </>
          )}
        </p>
        {active ? (
          <>
            <h2 id="todays-workout" className="font-display mb-2 text-[2rem] font-bold leading-tight text-white">
              {active.title}
            </h2>
            <p className="mb-6 text-sm text-white/60">
              {activeSets.length > 0 ? `${activeDone} of ${activeSets.length} sets done` : "Started"}
            </p>
            <Link href={`/session/${active.id}`} className="btn-volt-glow">
              <Play className="h-[18px] w-[18px] fill-current" aria-hidden /> Resume workout
            </Link>
          </>
        ) : next ? (
          <>
            <h2 id="todays-workout" className="font-display mb-2 text-[2rem] font-bold leading-tight text-white">
              {next.name}
            </h2>
            <div className="mb-6 space-y-1.5 text-sm text-white/60">
              <p>
                {next.exercises.length} exercise{next.exercises.length === 1 ? "" : "s"} · {estimateDuration(next)} min
              </p>
              {muscles.length > 0 && <p>{muscles.join(" · ")}</p>}
              {rec?.mode === "recovery" && <p className="text-volt">{rec.headline}</p>}
            </div>
            <button type="button" className="btn-volt-glow" disabled={next.exercises.length === 0} onClick={() => start(next.id)}>
              <Play className="h-[18px] w-[18px] fill-current" aria-hidden /> Start workout
            </button>
          </>
        ) : (
          <>
            <h2 id="todays-workout" className="font-display mb-2 text-[1.75rem] font-bold leading-tight text-white">
              Pick a plan to get started
            </h2>
            <p className="mb-6 text-sm text-white/60">Choose a ready-made program or start an empty workout.</p>
            <div className="flex gap-2">
              <Link href="/programs" className="btn-volt-glow flex-1">
                Browse programs
              </Link>
              <button type="button" onClick={() => start(null)} className="btn rounded-2xl bg-white/10 px-5 text-white hover:bg-white/15">
                <Plus className="h-4 w-4" aria-hidden /> Empty
              </button>
            </div>
          </>
        )}
      </section>

      <WeekStrip days={week} trained={stats.weekDone} today={todayKey} />

      {/* Key stats */}
      <section
        className="card rise grid grid-cols-[1.2fr_1fr_1fr] divide-x divide-border p-0 [animation-delay:0.2s]"
        aria-label="Key stats"
      >
        <VolumeStat volume={stats.volume} units={units} />
        <div className="flex flex-col justify-between p-4">
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Streak</h3>
            <p className="flex items-baseline gap-1">
              <span className="font-display text-2xl font-bold text-ink">{stats.streak}</span>
              <span className="text-xs text-muted">{stats.streak === 1 ? "week" : "weeks"}</span>
            </p>
          </div>
          <p className={`mt-3 flex items-center gap-1 text-[10px] font-medium ${stats.streak > 0 ? "text-flame" : "text-muted"}`}>
            <Flame className="h-3 w-3 shrink-0 fill-current" aria-hidden />
            {stats.streak > 0 ? "Keep it going" : "Train this week"}
          </p>
        </div>
        <div className="flex min-w-0 flex-col justify-between p-4">
          <div className="min-w-0">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Recent PR</h3>
            {latestPr ? (
              <>
                <p className="mb-1 truncate text-[11px] leading-tight text-inkSoft">
                  {exerciseById.get(latestPr.exerciseId)?.name ?? "Exercise"}
                </p>
                <p className="flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold text-ink">
                    {latestPr.kind === "max_reps" ? latestPr.value : formatWeight(latestPr.value, units, false)}
                  </span>
                  <span className="text-xs text-muted">{latestPr.kind === "max_reps" ? "reps" : units}</span>
                </p>
              </>
            ) : (
              <p className="font-display text-2xl font-bold text-muted">—</p>
            )}
          </div>
          <p className="mt-3 text-[10px] text-muted">
            {latestPr
              ? new Date(latestPr.achievedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "Log a set"}
          </p>
        </div>
      </section>

      {/* Coach */}
      <section className="ai-card rise [animation-delay:0.3s]" aria-labelledby="coach-tip">
        <Sparkles className="pointer-events-none absolute -bottom-4 -right-4 -z-10 h-24 w-24 text-ai/10" aria-hidden />
        <p id="coach-tip" className="eyebrow mb-3 text-ai">
          <Sparkles className="h-3.5 w-3.5 fill-current" aria-hidden /> Coach
        </p>
        <p className="mb-5 max-w-[90%] text-[15px] font-medium leading-snug text-ink">
          {rec?.reason ?? "Add a program and your coach will plan each session and adapt it to how you train."}
        </p>
        <Link
          href="/coach"
          className="group flex min-h-11 w-full items-center justify-between border-t border-ai/20 pt-3 text-ai transition-colors hover:text-ink"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="h-[18px] w-[18px]" aria-hidden /> Ask coach
          </span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      </section>

      {/* Recent workouts */}
      {stats.recent.length > 0 && (
        <section className="rise [animation-delay:0.4s]" aria-labelledby="recent-workouts">
          <div className="mb-4 flex items-center justify-between px-1">
            <h2 id="recent-workouts" className="text-lg font-semibold tracking-tight text-ink">
              Recent workouts
            </h2>
            <Link href="/history" className="text-sm font-medium text-accent">
              View all
            </Link>
          </div>
          <ul className="card divide-y divide-border p-0">
            {stats.recent.map((s) => (
              <li key={s.id}>
                <Link href="/history" className="group flex items-center gap-4 p-4 transition-colors active:bg-surface2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface2 text-inkSoft transition-colors group-hover:text-ink">
                    <Dumbbell className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{s.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {shortDate(s.date)}
                      {s.exerciseCount > 0 && ` · ${s.exerciseCount} exercise${s.exerciseCount === 1 ? "" : "s"}`}
                      {s.minutes > 0 && ` · ${s.minutes} min`}
                    </span>
                  </span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** This week Mon→Sun: weekday, a ring (ticked when trained), and the date; today underlined. */
function WeekStrip({ days, trained, today }: { days: string[]; trained: Set<string>; today: string }) {
  return (
    <ol className="card rise flex items-center justify-between p-4 [animation-delay:0.1s]" aria-label="This week">
      {days.map((k) => {
        const d = new Date(k + "T00:00:00");
        const done = trained.has(k);
        const isToday = k === today;
        const past = k < today;
        return (
          <li key={k} className={`relative flex flex-col items-center gap-2 ${past && !isToday ? "opacity-60" : ""}`}>
            <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-ink" : "text-muted"}`} aria-hidden>
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span
              className={`grid h-6 w-6 place-items-center rounded-full ${
                done
                  ? "border border-accent/30 bg-accent/10 text-accent"
                  : isToday
                    ? "border-2 border-accent"
                    : "border border-border"
              }`}
            >
              {done ? (
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              ) : (
                isToday && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              )}
              <span className="sr-only">
                {d.toLocaleDateString(undefined, { weekday: "long" })}: {done ? "trained" : "not trained"}
              </span>
            </span>
            <span className={`font-display text-xs ${isToday ? "font-semibold text-accent" : "text-muted"}`} aria-hidden>
              {d.getDate()}
            </span>
            {isToday && <span className="absolute -bottom-3 h-0.5 w-8 rounded-t-full bg-accent" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** This week's working-set volume, a six-week sparkline, and the change against last week. */
function VolumeStat({ volume, units }: { volume: number[]; units: Units }) {
  const now = volume[volume.length - 1];
  const prev = volume[volume.length - 2];
  const max = Math.max(...volume, 1);
  const change = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
  return (
    <div className="p-4 pl-5">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Weekly volume</h3>
      <p className="mb-2 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold text-ink">{fmt(toDisplay(now, units))}</span>
        <span className="text-xs text-muted">{units}</span>
      </p>
      <div className="mb-2 flex h-6 w-full items-end gap-1" aria-hidden>
        {volume.map((v, i) => (
          <span
            key={i}
            className={`w-full rounded-t-[2px] ${i === volume.length - 1 ? "bg-accentFill" : "bg-ink/10"}`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${change == null ? "text-muted" : change >= 0 ? "text-accent" : "text-amber"}`}>
        {change == null ? "First week tracked" : `${change >= 0 ? "+" : ""}${change}% vs last week`}
      </p>
    </div>
  );
}
