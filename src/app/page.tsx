"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MonthCalendar, dayKey } from "@/components/MonthCalendar";
import { Onboarding } from "@/components/Onboarding";
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

  const today = new Date();
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [selected, setSelected] = useState(todayKey);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!session) return <Welcome />;
  if (!onboarded) return <Onboarding />;

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

  const daySessions = sessions
    .filter((s) => s.status !== "archived" && s.date === selected)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const isToday = selected === todayKey;

  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Trainova</h1>
        <div className="flex items-center gap-2">
          <OnlineBadge />
          <Link href="/profile" className="text-xl" aria-label="profile">
            ⚙️
          </Link>
        </div>
      </header>

      {active && (
        <Link href={`/session/${active.id}`} className="card block border-accent/60">
          <p className="text-xs uppercase tracking-wide text-accent">Workout in progress</p>
          <p className="mt-0.5 text-lg font-bold">{active.title}</p>
          <p className="text-sm text-muted">Tap to continue →</p>
        </Link>
      )}

      <MonthCalendar selected={selected} onSelect={setSelected} />

      {/* Selected-day panel */}
      <section className="space-y-2">
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
            <Link key={s.id} href={`/session/${s.id}`} className="card flex items-center justify-between">
              <span className="font-semibold">{s.title}</span>
              <span className="text-sm text-accent">
                {s.status === "active" ? "Resume →" : "View / edit →"}
              </span>
            </Link>
          ))
        ) : isToday && !active ? (
          <>
            {programs.map((p) => {
              const days = daysForProgram(p.id);
              if (days.length === 0) return null;
              return (
                <div key={p.id} className="card space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted">{p.name}</p>
                  {days.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => start(d.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-surface2 px-3 py-3 active:scale-[0.99]"
                    >
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-sm text-accent">{d.exercises.length} ex · Start →</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {standalone.map((t) => (
              <button
                key={t.id}
                onClick={() => start(t.id)}
                className="card flex w-full items-center justify-between active:scale-[0.99]"
              >
                <span className="font-semibold">{t.name}</span>
                <span className="text-sm text-accent">Start →</span>
              </button>
            ))}
            <button
              onClick={() => start(null)}
              className="w-full text-center text-sm text-muted underline underline-offset-4"
            >
              or start an empty workout
            </button>
          </>
        ) : (
          <div className="card text-center text-sm text-muted">
            {isToday ? "Finish your active workout to start another." : "No workout on this day."}
          </div>
        )}
      </section>
    </main>
  );
}
