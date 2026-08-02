"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MonthCalendar, dayKey } from "@/components/MonthCalendar";
import { Onboarding } from "@/components/Onboarding";
import { AiOnboarding } from "@/components/AiOnboarding";
import { Welcome } from "@/components/Welcome";
import { OnlineBadge } from "@/components/OnlineBadge";
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
  const [useAiOnboarding, setUseAiOnboarding] = useState(false);

  const today = new Date();
  const todayKey = dayKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const [selected, setSelected] = useState(todayKey);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!session) return <Welcome />;
  if (!onboarded) {
    if (useAiOnboarding) return <AiOnboarding />;
    return (
      <div className="space-y-4">
        <Onboarding />
        <button
          className="btn-ghost mx-auto block w-full max-w-md py-3 text-sm"
          onClick={() => setUseAiOnboarding(true)}
        >
          ✨ Use AI-Powered Onboarding Instead
        </button>
      </div>
    );
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
    <main className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 p-8 md:p-12 border border-white/10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070')] bg-cover bg-center opacity-20"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Today's Workout
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl">
            Track your progress, crush your goals. Every rep counts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {active && (
            <Link
              href={`/session/${active.id}`}
              className="card block border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-6 hover:from-blue-500/20 hover:to-blue-600/20 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm uppercase tracking-wide text-blue-400 font-semibold">
                  Workout in progress
                </p>
              </div>
              <p className="text-2xl font-bold text-white">{active.title}</p>
              <p className="text-base text-white/60 mt-2">Tap to continue →</p>
            </Link>
          )}

          <div className="card">
            <MonthCalendar selected={selected} onSelect={setSelected} />
          </div>

          {/* Selected-day panel */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-wide text-white/50">
              {isToday
                ? "Today"
                : new Date(selected + "T00:00:00").toLocaleDateString(
                    undefined,
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    },
                  )}
            </h2>

            {daySessions.length > 0 ? (
              daySessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="card flex items-center justify-between p-6 hover:bg-white/10 transition-all duration-300"
                >
                  <span className="font-semibold text-lg text-white">
                    {s.title}
                  </span>
                  <span className="text-lg text-blue-400 font-semibold">
                    {s.status === "active" ? "Resume →" : "View / edit →"}
                  </span>
                </Link>
              ))
            ) : isPastOrToday && !active ? (
              <>
                {!isToday && (
                  <p className="text-sm text-white/50">
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
                      <p className="text-sm uppercase tracking-wide text-white/50 font-semibold">
                        {p.name}
                      </p>
                      {days.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => start(d.id)}
                          className="flex w-full items-center justify-between rounded-xl bg-white/5 px-6 py-4 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]"
                        >
                          <span className="font-semibold text-lg text-white">
                            {d.name}
                          </span>
                          <span className="text-lg text-blue-400 font-semibold">
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
                    className="card flex w-full items-center justify-between p-6 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]"
                  >
                    <span className="font-semibold text-lg text-white">
                      {t.name}
                    </span>
                    <span className="text-lg text-blue-400 font-semibold">
                      Start →
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => start(null)}
                  className="w-full py-4 text-center text-base text-white/50 underline underline-offset-4 hover:text-white/70 transition-colors"
                >
                  or start an empty workout
                </button>
              </>
            ) : (
              <div className="card text-center py-12 text-base text-white/50">
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
            <h3 className="text-xl font-bold mb-6 text-white">Quick Actions</h3>
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

          {/* Motivation Card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070')] bg-cover bg-center opacity-30"></div>
            <div className="relative z-10 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">
                Stay Consistent
              </h3>
              <p className="text-base text-white/70">
                Small progress every day leads to big results. Keep showing up!
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
