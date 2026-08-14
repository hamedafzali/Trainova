"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MonthCalendar, dayKey } from "@/components/MonthCalendar";
import { Onboarding } from "@/components/Onboarding";
import { AiOnboarding } from "@/components/AiOnboarding";
import { Welcome } from "@/components/Welcome";
import { OnlineBadge } from "@/components/OnlineBadge";
import { AdaptiveTodayCard } from "@/components/AdaptiveTodayCard";
import { useHydrated, useStore } from "@/lib/store";

export default function HomePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const session = useStore((s) => s.session);
  const onboarded = useStore((s) => s.profile.onboarded);
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const daysForProgram = useStore((s) => s.daysForProgram);
  const sessions = useStore((s) => s.sessions);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);
  const trainedDays = useStore((s) => s.trainedDays());
  const [useAiOnboarding, setUseAiOnboarding] = useState(false);

  const today = new Date();
  const todayKey = dayKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const [selected, setSelected] = useState(todayKey);

  const weekTrained = useMemo(() => {
    let n = 0;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < 7; i++) {
      const k = dayKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (trainedDays.has(k)) n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainedDays]);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!session) return <Welcome />;
  if (!onboarded) {
    if (useAiOnboarding) return <AiOnboarding />;
    return <Onboarding onUseAiOnboarding={() => setUseAiOnboarding(true)} />;
  }

  const active = getActiveSession();
  const start = (templateId: string | null) => {
    const { id, blocked } = startSession(templateId, selected);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };

  const daySessions = sessions
    .filter((s) => s.status !== "archived" && s.date === selected)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const isToday = selected === todayKey;
  const isPastOrToday = selected <= todayKey; // can log a workout for today or earlier

  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));

  return (
    <main className="space-y-6">
      <header>
        <h1 className="page-title">
          {isToday
            ? "Today"
            : new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
        </h1>
        <p className="page-subtitle">
          {active
            ? "You have a workout in progress."
            : "Pick up where you left off, or start something new."}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {active && (
            <Link
              href={`/session/${active.id}`}
              className="card block border-accent/20 bg-accent/[0.06] p-6 hover:bg-accent/[0.1] transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <p className="section-label text-accent">
                  Workout in progress
                </p>
              </div>
              <p className="text-2xl font-bold text-ink">{active.title}</p>
              <p className="text-base text-inkSoft mt-2">Tap to continue →</p>
            </Link>
          )}

          {!active && <AdaptiveTodayCard onStart={start} />}

          <div className="card">
            <MonthCalendar selected={selected} onSelect={setSelected} />
          </div>

          {/* Selected-day panel */}
          <section className="space-y-4">
            <h2 className="section-label">Workouts</h2>

            {daySessions.length > 0 ? (
              daySessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="card flex items-center justify-between p-6 hover:bg-border/60 transition-colors"
                >
                  <span className="font-semibold text-lg text-ink">
                    {s.title}
                  </span>
                  <span className="text-lg text-accent font-semibold">
                    {s.status === "active" ? "Resume →" : "View / edit →"}
                  </span>
                </Link>
              ))
            ) : isPastOrToday && !active ? (
              <>
                {!isToday && (
                  <p className="text-sm text-muted">
                    Logging a workout for{" "}
                    {new Date(selected + "T00:00:00").toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                    .
                  </p>
                )}
                {programs.map((p) => {
                  const days = daysForProgram(p.id);
                  if (days.length === 0) return null;
                  return (
                    <div key={p.id} className="card space-y-4">
                      <p className="section-label">{p.name}</p>
                      {days.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => start(d.id)}
                          className="flex w-full items-center justify-between rounded-control bg-surface2 px-6 py-4 hover:bg-border/60 transition-colors active:scale-[0.98]"
                        >
                          <span className="font-semibold text-lg text-ink">
                            {d.name}
                          </span>
                          <span className="text-lg text-accent font-semibold">
                            {d.exercises.length} ex · Start →
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {standalone.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => start(t.id)}
                    className="card flex w-full items-center justify-between p-6 hover:bg-border/60 transition-colors active:scale-[0.98]"
                  >
                    <span className="font-semibold text-lg text-ink">
                      {t.name}
                    </span>
                    <span className="text-lg text-accent font-semibold">
                      Start →
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => start(null)}
                  className="w-full py-4 text-center text-base text-muted underline underline-offset-4 hover:text-inkSoft transition-colors"
                >
                  or start an empty workout
                </button>
              </>
            ) : (
              <div className="card text-center py-12 text-base text-muted">
                {active
                  ? "Finish your active workout to start another."
                  : isPastOrToday
                    ? "No workout on this day."
                    : "You can't log a workout for a future date."}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h3 className="section-label mb-4">Quick Actions</h3>
            <div className="space-y-4">
              <button
                onClick={() => start(null)}
                className="w-full btn-primary py-4 text-base font-semibold"
              >
                Start Empty Workout
              </button>
              <Link
                href="/templates"
                className="w-full btn-ghost py-4 text-base font-semibold block text-center"
              >
                Browse Plans →
              </Link>
            </div>
          </div>

          {/* This Week */}
          <div className="card">
            <h3 className="section-label mb-4">This Week</h3>
            <div className="flex items-end gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() - (6 - i));
                const trained = trainedDays.has(
                  dayKey(d.getFullYear(), d.getMonth(), d.getDate()),
                );
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className={`h-8 w-full rounded-md ${trained ? "bg-blue-500" : "bg-white/[0.05]"}`}
                    />
                    <span className="text-[10px] text-white/40">
                      {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-white/60 mt-4">
              {weekTrained === 0
                ? "No workouts yet this week."
                : `${weekTrained} day${weekTrained === 1 ? "" : "s"} trained this week.`}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
