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
      <div className="space-y-4 p-5">
        <Onboarding />
        <button
          className="btn-primary w-full py-4 text-base"
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
    <main className="space-y-6 p-4 md:p-6 lg:p-8 pb-24 md:pb-28">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Today
          </h1>
          <p className="text-base text-muted mt-1 md:text-lg">
            Tap a workout to see what you lifted.
          </p>
        </div>
      </header>

      <MonthCalendar selected={selected} onSelect={setSelected} />

      {active && (
        <Link
          href={`/session/${active.id}`}
          className="card block border-accent/60 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-accent font-semibold">
            Workout in progress
          </p>
          <p className="mt-1 text-xl font-bold">{active.title}</p>
          <p className="text-base text-muted mt-1">Tap to continue →</p>
        </Link>
      )}

      <MonthCalendar selected={selected} onSelect={setSelected} />

      {/* Selected-day panel */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {isToday
            ? "Today"
            : new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
        </h2>

        {daySessions.length > 0 ? (
          daySessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="card flex items-center justify-between p-4"
            >
              <span className="font-semibold text-base">{s.title}</span>
              <span className="text-base text-accent font-semibold">
                {s.status === "active" ? "Resume →" : "View / edit →"}
              </span>
            </Link>
          ))
        ) : isPastOrToday && !active ? (
          <>
            {!isToday && (
              <p className="text-xs text-muted">
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
                <div key={p.id} className="card space-y-3">
                  <p className="text-sm uppercase tracking-wide text-muted font-semibold">
                    {p.name}
                  </p>
                  {days.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => start(d.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-surface2 px-4 py-4 active:scale-[0.99]"
                    >
                      <span className="font-semibold text-base">{d.name}</span>
                      <span className="text-base text-accent font-semibold">
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
                className="card flex w-full items-center justify-between p-4 active:scale-[0.99]"
              >
                <span className="font-semibold text-base">{t.name}</span>
                <span className="text-base text-accent font-semibold">
                  Start →
                </span>
              </button>
            ))}
            <button
              onClick={() => start(null)}
              className="w-full py-4 text-center text-base text-muted underline underline-offset-4"
            >
              or start an empty workout
            </button>
          </>
        ) : (
          <div className="card text-center py-8 text-base text-muted">
            {active
              ? "Finish your active workout to start another."
              : isPastOrToday
                ? "No workout on this day."
                : "You can't log a workout for a future date."}
          </div>
        )}
      </section>
    </main>
  );
}
