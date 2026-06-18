"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { OnlineBadge } from "@/components/OnlineBadge";
import { useHydrated, useStore } from "@/lib/store";

export default function HomePage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const startSession = useStore((s) => s.startSession);

  const completed = sessions.filter((s) => s.endedAt);
  const thisWeek = completed.filter(
    (s) => Date.now() - new Date(s.startedAt).getTime() < 7 * 864e5
  ).length;

  const quickStart = () => {
    const id = startSession(null, "Quick workout");
    router.push(`/session/${id}`);
  };

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
      ) : (
        <>
          {activeSessionId && (
            <Link href={`/session/${activeSessionId}`} className="card block border-accent/60">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-accent">Workout in progress</span>
                <span className="text-sm text-muted">Tap to resume →</span>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Stat label="This week" value={`${thisWeek}`} suffix="sessions" />
            <Stat label="All time" value={`${completed.length}`} suffix="workouts" />
          </div>

          <button onClick={quickStart} className="btn-primary w-full py-4 text-base">
            ⚡ Start an empty workout
          </button>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Your plans
              </h2>
              <Link href="/templates" className="text-sm text-accent">
                Manage
              </Link>
            </div>

            {templates.length === 0 ? (
              <Link href="/templates" className="card block text-center text-muted">
                No plans yet — create your first workout template →
              </Link>
            ) : (
              <ul className="space-y-2">
                {templates.map((t) => (
                  <li key={t.id} className="card flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-muted">{t.exercises.length} exercises</p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const id = startSession(t.id);
                        router.push(`/session/${id}`);
                      }}
                    >
                      Start
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
