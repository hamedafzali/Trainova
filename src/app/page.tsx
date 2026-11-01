"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Bell, Check, Dumbbell, Flame, Play, Plus } from "lucide-react";
import { CoachCard, HeroCard, IconButton, ListCard, ListRow, SectionHeader, StatBand, type Stat } from "@/components/kit";
import { Landing } from "@/components/Landing";
import { Onboarding } from "@/components/Onboarding";
import { Welcome } from "@/components/Welcome";
import { recommendToday } from "@/domain/adaptive";
import { estimateDuration } from "@/domain/duration";
import { sessionMinutes } from "@/domain/periodStats";
import { localDayKey, startOfWeek, weekDays, weekStreak } from "@/domain/streak";
import { label } from "@/domain/taxonomy";
import { calcSetVolume } from "@/domain/volume";
import { useInstall } from "@/lib/install";
import { useHydrated, useStore } from "@/lib/store";
import { useInbox } from "@/lib/useInbox";
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
  const { fresh } = useInbox();
  const [install] = useInstall();
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
  // Visitors get the introduction; the installed app goes straight to sign-in.
  if (!session) return install === "installed" ? <Welcome /> : <Landing />;
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
        <IconButton href="/inbox" icon={Bell} label={fresh.length ? `Inbox, ${fresh.length} new` : "Inbox"} dot={fresh.length > 0} />
      </header>

      {/* Today's workout */}
      <HeroCard
        titleId="todays-workout"
        photo="/images/home-hero"
        eyebrow={
          active ? (
            <>
              <span className="h-2 w-2 rounded-full bg-volt motion-safe:animate-pulse" aria-hidden /> In progress
            </>
          ) : (
            <>
              <Dumbbell className="h-3.5 w-3.5" aria-hidden /> {stats.trained.has(todayKey) ? "Up next" : "Today's plan"}
            </>
          )
        }
        title={active ? active.title : next ? next.name : "Pick a plan to get started"}
      >
        {active ? (
          <>
            <p className="mb-6 text-sm text-white/60">
              {activeSets.length > 0 ? `${activeDone} of ${activeSets.length} sets done` : "Started"}
            </p>
            <Link href={`/session/${active.id}`} className="btn-volt-glow">
              <Play className="h-[18px] w-[18px] fill-current" aria-hidden /> Resume workout
            </Link>
          </>
        ) : next ? (
          <>
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
      </HeroCard>

      <WeekStrip days={week} trained={stats.weekDone} today={todayKey} />

      {/* Key stats */}
      <StatBand
        label="Key stats"
        columns="1.2fr 1fr 1fr"
        className="rise [animation-delay:0.2s]"
        stats={[
          volumeStat(stats.volume, units),
          {
            label: "Streak",
            value: stats.streak,
            unit: stats.streak === 1 ? "week" : "weeks",
            foot: (
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3 shrink-0 fill-current" aria-hidden />
                {stats.streak > 0 ? "Keep it going" : "Train this week"}
              </span>
            ),
            footClass: stats.streak > 0 ? "text-flame" : "text-muted",
          },
          latestPr
            ? {
                label: "Recent PR",
                value: latestPr.kind === "max_reps" ? latestPr.value : formatWeight(latestPr.value, units, false),
                unit: latestPr.kind === "max_reps" ? "reps" : units,
                kicker: exerciseById.get(latestPr.exerciseId)?.name ?? "Exercise",
                foot: new Date(latestPr.achievedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              }
            : { label: "Recent PR", value: <span className="text-muted">—</span>, foot: "Log a set" },
        ]}
      />

      <CoachCard
        className="[animation-delay:0.3s]"
        text={rec?.reason ?? "Add a program and your coach will plan each session and adapt it to how you train."}
      />

      {/* Recent workouts */}
      {stats.recent.length > 0 && (
        <section className="rise [animation-delay:0.4s]" aria-labelledby="recent-workouts">
          <SectionHeader id="recent-workouts" title="Recent workouts" action={{ label: "View all", href: "/history" }} />
          <ListCard>
            {stats.recent.map((s) => (
              <ListRow
                key={s.id}
                href="/history"
                icon={Dumbbell}
                title={s.title}
                meta={
                  <>
                    {shortDate(s.date)}
                    {s.exerciseCount > 0 && ` · ${s.exerciseCount} exercise${s.exerciseCount === 1 ? "" : "s"}`}
                    {s.minutes > 0 && ` · ${s.minutes} min`}
                  </>
                }
                trailing={
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                }
              />
            ))}
          </ListCard>
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
function volumeStat(volume: number[], units: Units): Stat {
  const now = volume[volume.length - 1];
  const prev = volume[volume.length - 2];
  const max = Math.max(...volume, 1);
  const change = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
  return {
    label: "Weekly volume",
    value: fmt(toDisplay(now, units)),
    unit: units,
    extra: (
      <div className="mt-2 flex h-6 w-full items-end gap-1" aria-hidden>
        {volume.map((v, i) => (
          <span
            key={i}
            className={`w-full rounded-t-[2px] ${i === volume.length - 1 ? "bg-accentFill" : "bg-ink/10"}`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    ),
    foot: change == null ? "First week tracked" : `${change >= 0 ? "+" : ""}${change}% vs last week`,
    footClass: change == null ? "text-muted" : change >= 0 ? "text-accent" : "text-amber",
  };
}
