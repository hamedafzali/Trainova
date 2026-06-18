"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useHydrated, useStore } from "@/lib/store";

export default function HistoryPage() {
  const hydrated = useHydrated();
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);

  const rows = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((s) => {
          const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
          const volume = mine.reduce(
            (acc, x) => acc + (x.actualWeight ?? 0) * (x.actualReps ?? 0),
            0
          );
          return { session: s, count: mine.length, volume };
        }),
    [sessions, sets]
  );

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted">Every session you have logged.</p>
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-center text-muted">No workouts logged yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ session, count, volume }) => (
            <li key={session.id}>
              <Link href={`/session/${session.id}`} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold">{session.name}</p>
                  <p className="text-xs text-muted">
                    {new Date(session.startedAt).toLocaleDateString()} ·{" "}
                    {session.endedAt ? `${count} sets` : "in progress"}
                  </p>
                </div>
                <span className="text-right text-sm tabular-nums text-muted">
                  {Math.round(volume).toLocaleString()}
                  <span className="block text-[10px] uppercase">volume</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
