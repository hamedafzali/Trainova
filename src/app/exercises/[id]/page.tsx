"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Info, SearchX, Trophy } from "lucide-react";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { EmptyState } from "@/components/EmptyState";
import { LineChart } from "@/components/LineChart";
import { ListSkeleton } from "@/components/Skeleton";
import { describeSet } from "@/components/SessionExercise";
import { equipmentOf, exerciseTypeLabel } from "@/components/ExerciseBrowser";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { EQUIPMENT, label } from "@/domain/taxonomy";
import { useHydrated, useStore } from "@/lib/store";
import { displayWeight, formatVolume, formatWeight } from "@/lib/units";

type Metric = { key: string; label: string; unit: string; pick: (h: History) => number };
type History = ReturnType<ReturnType<typeof useStore.getState>["exerciseHistory"]>[number];

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const exercise = useStore((s) => s.exercises.find((e) => e.id === id));
  const device = useStore((s) => s.deviceForExercise(id));
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const exerciseHistory = useStore((s) => s.exerciseHistory);
  const bestsFor = useStore((s) => s.bestsFor);
  const type = exerciseTypeOf(exercise, device);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => (hydrated ? exerciseHistory(id) : []), [hydrated, id, sessions, sets]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bests = useMemo(() => bestsFor(id), [id, sets]);

  const metrics = useMemo<Metric[]>(() => {
    if (type === "duration") return [{ key: "hold", label: "Longest hold", unit: "s", pick: (h) => h.durationSec }];
    if (type === "cardio")
      return [
        { key: "min", label: "Minutes", unit: "min", pick: (h) => h.durationMin },
        ...(history.some((h) => h.distance > 0)
          ? [{ key: "km", label: "Distance", unit: "km", pick: (h: History) => h.distance }]
          : []),
      ];
    const reps: Metric = { key: "reps", label: "Best set reps", unit: "reps", pick: (h) => h.maxReps };
    if (type === "bodyweight_reps" || bests.maxWeight <= 0)
      return [reps, { key: "total", label: "Total reps", unit: "reps", pick: (h) => h.totalReps }];
    return [
      { key: "e1rm", label: "Est. 1RM", unit: units, pick: (h) => displayWeight(h.e1rm, units) },
      { key: "top", label: "Top weight", unit: units, pick: (h) => displayWeight(h.topWeight, units) },
      { key: "vol", label: "Volume", unit: units, pick: (h) => displayWeight(h.volume, units) },
    ];
  }, [type, history, bests.maxWeight, units]);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const recent = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const groups = new Map<string, typeof sets>();
    for (const x of sets) {
      if (x.exerciseId !== id || !x.completed) continue;
      const s = byId.get(x.sessionId);
      if (!s || s.status === "archived") continue;
      groups.set(x.sessionId, [...(groups.get(x.sessionId) ?? []), x]);
    }
    return [...groups.entries()]
      .map(([sid, xs]) => ({ session: byId.get(sid)!, sets: xs.sort((a, b) => a.setIndex - b.setIndex) }))
      .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))
      .slice(0, 8);
  }, [sessions, sets, id]);

  if (!hydrated) return <ListSkeleton />;
  if (!exercise)
    return (
      <EmptyState
        icon={SearchX}
        title="Exercise not found"
        body="It may have been removed from your library."
        action={
          <Link href="/exercises" className="btn-primary mt-2">
            Browse exercises
          </Link>
        }
      />
    );

  const myPrs = prs.filter((p) => p.exerciseId === id);
  const eq = EQUIPMENT.find((x) => x.key === equipmentOf(exercise, device))?.label;
  const series = history.map((h) => ({ label: h.date, value: metric.pick(h) }));
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const trend = series.length < 2 ? "accent" : last > first ? "up" : last < first ? "down" : "flat";
  const weighted = metrics[0]?.key === "e1rm";

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <Link href="/exercises" className="-my-3 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Exercises
      </Link>

      <header className="flex items-start gap-4">
        <DeviceAvatar device={device} className="h-16 w-16 rounded-card text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{exercise.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exercise.primaryMuscle && <span className="badge-accent">{label(exercise.primaryMuscle)}</span>}
            {(exercise.secondaryMuscles ?? []).map((m) => (
              <span key={m} className="badge-neutral">
                {label(m)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            {[eq, exerciseTypeLabel(exercise, device), exercise.isCompound ? "Compound" : "Isolation", exercise.level && label(exercise.level)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {(exercise.instructions?.length || device?.guidance) && (
        <section className="card space-y-3 p-4 sm:p-6">
          <h2 className="text-h3 text-ink">How to</h2>
          {exercise.instructions?.length ? (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-inkSoft">
              {exercise.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : null}
          {device?.guidance && (
            <p className="flex gap-2 rounded-control bg-surface2 p-3 text-sm text-inkSoft">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold text-ink">
                  {device.name}
                  {device.machineNumber ? ` (No. ${device.machineNumber})` : ""}:
                </span>{" "}
                {device.guidance}
              </span>
            </p>
          )}
        </section>
      )}

      {history.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          You haven&apos;t logged this exercise yet. Add it to a plan or a workout and your progress will show up here.
        </div>
      ) : (
        <>
          <section aria-label="Personal bests" className="grid grid-cols-3 gap-2 sm:gap-3">
            {weighted ? (
              <>
                <Stat label="Est. 1RM" value={formatWeight(bests.e1rm, units)} />
                <Stat label="Heaviest" value={formatWeight(bests.maxWeight, units)} />
                <Stat label="Most reps" value={String(bests.maxReps)} />
              </>
            ) : (
              <>
                <Stat label="Sessions" value={String(history.length)} />
                <Stat
                  label={metrics[0].label}
                  value={`${Math.max(0, ...history.map(metrics[0].pick))} ${metrics[0].unit}`}
                />
                <Stat label="Last" value={`${last} ${metric.unit}`} />
              </>
            )}
          </section>

          <section className="card space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-h3 text-ink">Trend</h2>
              {metrics.length > 1 && (
                <div role="radiogroup" aria-label="Metric" className="flex gap-1 rounded-control bg-surface2 p-1">
                  {metrics.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={metric.key === m.key}
                      onClick={() => setMetricKey(m.key)}
                      className={`min-h-9 rounded-[8px] px-3 py-1 text-xs font-semibold transition-colors ${
                        metric.key === m.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <LineChart data={series} unit={metric.unit} trend={trend} />
          </section>

          {myPrs.length > 0 && (
            <section className="card space-y-2 p-4 sm:p-6">
              <h2 className="flex items-center gap-2 text-h3 text-ink">
                <Trophy className="h-5 w-5 text-gold" aria-hidden /> Records
              </h2>
              <ul className="divide-y divide-border text-sm">
                {myPrs.map((p) => (
                  <li key={p.kind} className="flex items-center justify-between py-2">
                    <span className="text-inkSoft">
                      {p.kind === "e1rm" ? "Est. 1RM" : p.kind === "max_weight" ? "Heaviest" : "Most reps"}
                    </span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums text-ink">
                        {p.kind === "max_reps" ? `${p.value} reps` : formatWeight(p.value, units)}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {new Date(p.achievedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-h2 text-ink">Recent sessions</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {recent.map(({ session, sets: xs }) => {
                const vol = history.find((h) => h.date === session.date)?.volume ?? 0;
                return (
                  <li key={session.id}>
                    <Link href={`/session/${session.id}`} className="block px-4 py-3 hover:bg-surface2/60 sm:px-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-semibold text-ink">{session.title}</p>
                        <p className="shrink-0 text-xs text-muted">
                          {new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums text-inkSoft">
                        {xs.map((x) => (
                          <span key={x.id} className={x.kind === "warmup" ? "text-muted" : ""}>
                            {x.kind && x.kind !== "normal" ? `${x.kind === "warmup" ? "W" : x.kind === "drop" ? "D" : "F"} ` : ""}
                            {describeSet(x, type, units)}
                          </span>
                        ))}
                      </p>
                      {weighted && vol > 0 && <p className="mt-1 text-xs text-muted">{formatVolume(vol, units)} volume</p>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-3 sm:p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate text-lg font-bold tabular-nums text-ink sm:text-2xl">{value}</p>
    </div>
  );
}
