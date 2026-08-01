"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { WorkoutAnalysis } from "@/components/WorkoutAnalysis";
import type { WorkoutSet } from "@/domain/types";

export default function HistoryPage() {
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceForExercise = useStore((s) => s.deviceForExercise);
  const [open, setOpen] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => (showArchived ? true : s.status !== "archived"))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((s) => {
          const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
          const volume = mine.reduce(
            (acc, x) => acc + (x.actualWeight ?? 0) * (x.actualReps ?? 0),
            0,
          );
          const byExercise = new Map<string, WorkoutSet[]>();
          for (const x of mine) {
            const list = byExercise.get(x.exerciseId) ?? [];
            list.push(x);
            byExercise.set(x.exerciseId, list);
          }
          const mins = s.completedAt
            ? Math.max(
                1,
                Math.round(
                  (+new Date(s.completedAt) - +new Date(s.startedAt)) / 60000,
                ),
              )
            : null;
          return { session: s, count: mine.length, volume, byExercise, mins };
        }),
    [sessions, sets, showArchived],
  );

  return (
    <main className="space-y-6 p-4 pb-20">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-base text-muted mt-1">
            Tap a workout to see what you lifted.
          </p>
        </div>
        <button
          className="chip mt-1 py-3 px-4 text-base font-semibold"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-muted py-8">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-8 text-base text-muted">
          No workouts logged yet.
        </div>
      ) : (
        <>
          {/* AI Analysis Section */}
          <WorkoutAnalysis />

          {/* Workout History */}
          <ul className="space-y-3">
            {rows.map(({ session, count, volume, byExercise, mins }) => {
              const expanded = open === session.id;
              return (
                <li key={session.id} className="card">
                  <button
                    className="flex w-full items-center justify-between text-left p-4"
                    onClick={() => setOpen(expanded ? null : session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base">
                        {session.title}
                        {session.status === "active" && (
                          <span className="ml-2 text-sm text-accent">
                            ● in progress
                          </span>
                        )}
                        {session.status === "archived" && (
                          <span className="ml-2 text-sm text-muted">
                            archived
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {new Date(session.startedAt).toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                        {mins ? ` · ${mins} min` : ""} · {byExercise.size}{" "}
                        exercises
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-base font-semibold tabular-nums">
                        {Math.round(volume).toLocaleString()}
                        <span className="text-sm text-muted"> {units}·vol</span>
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {expanded ? "▲" : "▼"} {count} sets
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <ul className="mt-3 space-y-3 border-t border-border pt-3 px-4 pb-4">
                      {[...byExercise.entries()].map(([exId, exSets]) => {
                        const ex = exerciseById(exId);
                        const device = deviceForExercise(exId);
                        return (
                          <li key={exId} className="flex items-start gap-3">
                            <DeviceAvatar
                              device={device}
                              className="mt-0.5 h-10 w-10 rounded-md text-sm"
                            />
                            <div className="flex-1">
                              <p className="text-base font-medium leading-tight">
                                {ex?.name ?? "Exercise"}
                              </p>
                              {exSets[0]?.durationSec != null ? (
                                <p className="text-sm text-muted mt-1">
                                  {exSets
                                    .map((s) => `${s.durationSec ?? "–"}s`)
                                    .join(" · ")}{" "}
                                  · {exSets.length}{" "}
                                  {exSets.length === 1 ? "hold" : "holds"}
                                </p>
                              ) : exSets[0]?.durationMin != null ? (
                                <p className="text-sm text-muted mt-1">
                                  {exSets
                                    .map(
                                      (s) =>
                                        `${s.durationMin ?? "–"} min${
                                          s.incline ? ` · ${s.incline}%` : ""
                                        }${s.distance ? ` · ${s.distance}` : ""}`,
                                    )
                                    .join("  ·  ")}
                                </p>
                              ) : (
                                <p className="text-sm text-muted mt-1">
                                  {exSets
                                    .map((s) =>
                                      s.actualReps
                                        ? `${s.actualWeight ?? "–"}×${s.actualReps}`
                                        : `${s.actualWeight ?? "–"}`,
                                    )
                                    .join(" · ")}{" "}
                                  {units} · {exSets.length}{" "}
                                  {exSets.length === 1 ? "round" : "rounds"}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                      {session.status === "active" && (
                        <li>
                          <Link
                            href={`/session/${session.id}`}
                            className="text-base text-accent font-semibold"
                          >
                            Resume workout →
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
