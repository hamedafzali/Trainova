"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OnlineBadge } from "@/components/OnlineBadge";
import { useHydrated, useStore } from "@/lib/store";

export default function HomePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const daysForProgram = useStore((s) => s.daysForProgram);
  const sessions = useStore((s) => s.sessions);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);

  const active = getActiveSession();
  const completed = sessions.filter((s) => s.status === "completed");
  const thisWeek = completed.filter(
    (s) => Date.now() - new Date(s.startedAt).getTime() < 7 * 864e5
  ).length;

  const start = (templateId: string | null) => {
    const { id, blocked } = startSession(templateId);
    if (blocked) {
      // Single-active invariant: route to the existing active session instead.
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };

  // Templates not inside a program are surfaced directly; program days are grouped.
  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));

  return (
    <main className="space-y-5 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trainova</h1>
          <p className="text-sm text-muted">Open. Lift. Log. Done.</p>
        </div>
        <OnlineBadge />
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : active ? (
        // Active session exists → the ONLY primary action is to continue it.
        <>
          <Link href={`/session/${active.id}`} className="card block border-accent/60">
            <p className="text-xs uppercase tracking-wide text-accent">Workout in progress</p>
            <p className="mt-1 text-lg font-bold">{active.title}</p>
            <p className="text-sm text-muted">Tap to continue →</p>
          </Link>
          <p className="text-center text-xs text-muted">
            Finish or discard this workout to start another.
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="This week" value={`${thisWeek}`} suffix="sessions" />
            <Stat label="All time" value={`${completed.length}`} suffix="workouts" />
          </div>

          {/* PRIMARY: start from a template */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Start a workout
            </h2>

            {programs.map((p) => {
              const days = daysForProgram(p.id);
              if (days.length === 0) return null;
              return (
                <div key={p.id} className="card space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {p.name}
                    {p.source === "trainer" && <span className="text-accent"> · trainer</span>}
                  </p>
                  {days.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => start(d.id)}
                      className="flex w-full items-center justify-between rounded-xl bg-surface2 px-3 py-3 active:scale-[0.99]"
                    >
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-sm text-accent">
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
                className="card flex w-full items-center justify-between active:scale-[0.99]"
              >
                <span>
                  <span className="block font-semibold">{t.name}</span>
                  <span className="text-xs text-muted">{t.exercises.length} exercises</span>
                </span>
                <span className="text-sm text-accent">Start →</span>
              </button>
            ))}

            {programs.every((p) => daysForProgram(p.id).length === 0) && standalone.length === 0 && (
              <Link href="/templates" className="card block text-center text-muted">
                No plans yet — create your first template →
              </Link>
            )}
          </section>

          {/* SECONDARY: empty workout fallback */}
          <button
            onClick={() => start(null)}
            className="w-full text-center text-sm text-muted underline underline-offset-4"
          >
            or start an empty workout
          </button>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{suffix}</p>
    </div>
  );
}
