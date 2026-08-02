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
    <main className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-8 md:p-12 border border-white/10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=2069')] bg-cover bg-center opacity-20"></div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Workout History
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl">
            Track your progress, analyze your performance, and celebrate your
            gains.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {!hydrated ? (
            <div className="card animate-pulse text-white/50 py-12">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="card text-center py-12 text-base text-white/50">
              No workouts logged yet. Start your fitness journey today!
            </div>
          ) : (
            <>
              {/* AI Analysis Section */}
              <WorkoutAnalysis />

              {/* Workout History */}
              <ul className="space-y-4">
                {rows.map(({ session, count, volume, byExercise, mins }) => {
                  const expanded = open === session.id;
                  return (
                    <li key={session.id} className="card">
                      <button
                        className="flex w-full items-center justify-between text-left p-6 hover:bg-white/5 transition-all duration-300"
                        onClick={() => setOpen(expanded ? null : session.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-lg text-white">
                            {session.title}
                            {session.status === "active" && (
                              <span className="ml-2 text-sm text-blue-400">
                                ● in progress
                              </span>
                            )}
                            {session.status === "archived" && (
                              <span className="ml-2 text-sm text-white/50">
                                archived
                              </span>
                            )}
                          </p>
                          <p className="text-base text-white/60 mt-2">
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
                        <div className="text-right ml-4">
                          <p className="text-lg font-semibold tabular-nums text-white">
                            {Math.round(volume).toLocaleString()}
                            <span className="text-sm text-white/50">
                              {" "}
                              {units}·vol
                            </span>
                          </p>
                          <p className="text-sm text-white/50 mt-1">
                            {expanded ? "▲" : "▼"} {count} sets
                          </p>
                        </div>
                      </button>

                      {expanded && (
                        <ul className="mt-4 space-y-3 border-t border-white/10 pt-4 px-6 pb-6">
                          {[...byExercise.entries()].map(([exId, exSets]) => {
                            const ex = exerciseById(exId);
                            const device = deviceForExercise(exId);
                            return (
                              <li key={exId} className="flex items-start gap-4">
                                <DeviceAvatar
                                  device={device}
                                  className="mt-0.5 h-12 w-12 rounded-md text-base"
                                />
                                <div className="flex-1">
                                  <p className="text-lg font-medium leading-tight text-white">
                                    {ex?.name ?? "Exercise"}
                                  </p>
                                  {exSets[0]?.durationSec != null ? (
                                    <p className="text-base text-white/60 mt-2">
                                      {exSets
                                        .map((s) => `${s.durationSec ?? "–"}s`)
                                        .join(" · ")}{" "}
                                      · {exSets.length}{" "}
                                      {exSets.length === 1 ? "hold" : "holds"}
                                    </p>
                                  ) : exSets[0]?.durationMin != null ? (
                                    <p className="text-base text-white/60 mt-2">
                                      {exSets
                                        .map(
                                          (s) =>
                                            `${s.durationMin ?? "–"} min${
                                              s.incline
                                                ? ` · ${s.incline}%`
                                                : ""
                                            }${s.distance ? ` · ${s.distance}` : ""}`,
                                        )
                                        .join("  ·  ")}
                                    </p>
                                  ) : (
                                    <p className="text-base text-white/60 mt-2">
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
                                className="text-lg text-blue-400 font-semibold hover:text-blue-300 transition-colors"
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
        </div>

        <div className="space-y-6">
          {/* Stats Card */}
          <div className="card">
            <h3 className="text-xl font-bold mb-6 text-white">Workout Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                <span className="text-white/60">Total Workouts</span>
                <span className="font-bold text-xl text-white">
                  {rows.length}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                <span className="text-white/60">Total Volume</span>
                <span className="font-bold text-xl text-white">
                  {Math.round(
                    rows.reduce((sum, r) => sum + r.volume, 0),
                  ).toLocaleString()}{" "}
                  {units}
                </span>
              </div>
            </div>
          </div>

          {/* Motivation Card */}
          <div className="card relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070')] bg-cover bg-center opacity-30"></div>
            <div className="relative z-10 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">
                Keep Pushing
              </h3>
              <p className="text-base text-white/70">
                Every workout brings you closer to your goals. Stay consistent!
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
