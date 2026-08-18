"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { VolumeHeatmap } from "@/components/VolumeHeatmap";
import { WorkoutAnalysis } from "@/components/WorkoutAnalysis";
import { ListSkeleton } from "@/components/Skeleton";
import type { WorkoutSet } from "@/domain/types";
import { totalVolume } from "@/domain/volume";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function HistoryPage() {
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
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
          const volume = totalVolume(mine);
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

  const weekRows = useMemo(
    () => rows.filter((r) => Date.now() - +new Date(r.session.startedAt) <= 7 * DAY_MS),
    [rows],
  );
  const prevWeekRows = useMemo(
    () =>
      rows.filter((r) => {
        const age = Date.now() - +new Date(r.session.startedAt);
        return age > 7 * DAY_MS && age <= 14 * DAY_MS;
      }),
    [rows],
  );
  const weekVolume = weekRows.reduce((sum, r) => sum + r.volume, 0);
  const prevWeekVolume = prevWeekRows.reduce((sum, r) => sum + r.volume, 0);
  // Same ±5%-of-baseline classification used on Coach/Progress, so "trending
  // up/down" is one consistent visual language across the app, not a
  // per-screen reinvention.
  const weekTrendPct = prevWeekVolume > 0 ? Math.round(((weekVolume - prevWeekVolume) / prevWeekVolume) * 100) : null;
  const weekTrendUp = weekTrendPct != null && weekTrendPct >= 5;
  const weekTrendDown = weekTrendPct != null && weekTrendPct <= -5;
  const totalVol = rows.reduce((sum, r) => sum + r.volume, 0);
  // `prs` only keeps the current best per exercise+kind (not full PR
  // history), so this flags the session where each still-standing record
  // was set — not every PR ever hit.
  const prDates = useMemo(() => new Set(prs.map((p) => p.achievedAt.slice(0, 10))), [prs]);
  const hasPr = (startedAt: string) => prDates.has(startedAt.slice(0, 10));

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">
            Every workout you've logged, in one place.
          </p>
        </div>
        <label className="flex items-center gap-2 text-body-sm text-muted shrink-0">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-accent"
          />
          Show archived
        </label>
      </header>

      {hydrated && rows.length > 0 && (
        <div className="rounded-card border border-accent/30 bg-accent/[0.06] shadow-elevated p-6 flex items-center justify-between gap-4">
          <div>
            <p className="section-label text-accent">This week</p>
            <p className="text-stat text-ink mt-1 flex items-baseline gap-2">
              {Math.round(weekVolume).toLocaleString()}
              <span className="text-body-sm font-normal text-inkSoft">
                {units}·vol
              </span>
              {weekTrendPct != null && (weekTrendUp || weekTrendDown) && (
                <span className={weekTrendUp ? "badge-success" : "badge-warning"}>
                  {weekTrendUp ? "↑" : "↓"} {Math.abs(weekTrendPct)}%
                </span>
              )}
            </p>
          </div>
          <p className="text-body-sm text-inkSoft text-right">
            {weekRows.length} workout{weekRows.length === 1 ? "" : "s"}
            <br />
            in the last 7 days
          </p>
        </div>
      )}

      {hydrated && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-card border border-border bg-surface shadow-card p-5 flex flex-col gap-1 order-2 sm:order-1">
            <span className="text-caption text-muted">Total workouts</span>
            <span className="text-stat text-ink">{rows.length}</span>
          </div>
          <div className="rounded-card border border-border bg-surface shadow-card p-5 flex flex-col gap-1 order-1 sm:order-2 overflow-hidden">
            <span className="text-caption text-muted">Total volume</span>
            <span className="text-hero text-ink whitespace-nowrap">
              {Math.round(totalVol).toLocaleString()}
              <span className="text-body-sm font-normal text-muted"> {units}·vol</span>
            </span>
          </div>
        </div>
      )}

      {hydrated && rows.length > 0 && (
        <VolumeHeatmap sessions={sessions} sets={sets} units={units} />
      )}

      {!hydrated ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface text-center py-14 px-6 space-y-3">
          <p className="text-3xl" aria-hidden>
            📈
          </p>
          <p className="font-semibold text-lg text-ink">No workouts yet</p>
          <p className="text-body-sm text-inkSoft max-w-xs mx-auto">
            Once you log a workout, it'll show up here with your trends over
            time.
          </p>
          <Link
            href="/templates"
            className="btn-primary inline-flex px-6 py-3 text-base font-semibold mt-2"
          >
            Start a workout
          </Link>
        </div>
      ) : (
        <>
          <WorkoutAnalysis />

          <ul className="space-y-4">
            {rows.map(({ session, count, volume, byExercise, mins }) => {
              const expanded = open === session.id;
              return (
                <li
                  key={session.id}
                  className="rounded-card border border-border bg-surface shadow-card overflow-hidden"
                >
                  <button
                    className="flex w-full items-center justify-between text-left p-6 hover:bg-border/60 transition-colors"
                    onClick={() => setOpen(expanded ? null : session.id)}
                    aria-expanded={expanded}
                    aria-controls={`session-detail-${session.id}`}
                    data-testid="history-session-toggle"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-h3 text-ink">
                        {session.title}
                        {hasPr(session.startedAt) && (
                          <span className="badge-gold ml-2 align-middle">🏆 PR</span>
                        )}
                        {session.status === "active" && (
                          <span className="ml-2 text-body-sm text-accent">
                            ● in progress
                          </span>
                        )}
                        {session.status === "archived" && (
                          <span className="ml-2 text-body-sm text-muted">
                            archived
                          </span>
                        )}
                      </p>
                      <p className="text-body-sm text-muted mt-1.5">
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
                      <p className="text-h3 font-semibold tabular-nums text-ink">
                        {Math.round(volume).toLocaleString()}
                        <span className="text-body-sm font-normal text-muted">
                          {" "}
                          {units}·vol
                        </span>
                      </p>
                      <p className="text-body-sm text-muted mt-1">
                        {expanded ? "▲" : "▼"} {count} sets
                      </p>
                    </div>
                  </button>

                  <div
                    id={`session-detail-${session.id}`}
                    className={`grid transition-[grid-template-rows] duration-200 ease-standard ${
                      expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <ul className="space-y-3 border-t border-border p-6">
                      {[...byExercise.entries()].map(([exId, exSets]) => {
                        const ex = exerciseById(exId);
                        const device = deviceForExercise(exId);
                        return (
                          <li key={exId} className="flex items-start gap-4">
                            <DeviceAvatar
                              device={device}
                              className="mt-0.5 h-10 w-10 rounded-control text-sm"
                            />
                            <div className="flex-1">
                              <p className="text-base font-medium leading-tight text-ink">
                                {ex?.name ?? "Exercise"}
                              </p>
                              {exSets[0]?.durationSec != null ? (
                                <p className="text-body-sm text-inkSoft mt-1">
                                  {exSets
                                    .map((s) => `${s.durationSec ?? "–"}s`)
                                    .join(" · ")}{" "}
                                  · {exSets.length}{" "}
                                  {exSets.length === 1 ? "hold" : "holds"}
                                </p>
                              ) : exSets[0]?.durationMin != null ? (
                                <p className="text-body-sm text-inkSoft mt-1">
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
                                <p className="text-body-sm text-inkSoft mt-1">
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
                            className="text-base text-accent font-semibold hover:text-accentHover transition-colors"
                          >
                            Resume workout →
                          </Link>
                        </li>
                      )}
                    </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
