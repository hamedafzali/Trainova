"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clock, Dumbbell, Trophy } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { VolumeHeatmap } from "@/components/VolumeHeatmap";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { totalVolume } from "@/domain/volume";
import { formatVolume } from "@/lib/units";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function HistoryPage() {
  const hydrated = useHydrated();
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const exerciseById = useStore((s) => s.exerciseById);
  const [showArchived, setShowArchived] = useState(false);

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => (showArchived ? true : s.status !== "archived"))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((s) => {
          const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
          const exerciseIds = [...new Set(mine.map((x) => x.exerciseId))];
          const mins = s.completedAt
            ? Math.max(1, Math.round((+new Date(s.completedAt) - +new Date(s.startedAt)) / 60000))
            : null;
          return { session: s, count: mine.length, volume: totalVolume(mine), exerciseIds, mins };
        }),
    [sessions, sets, showArchived],
  );

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: typeof rows }[] = [];
    for (const r of rows) {
      const d = new Date(r.session.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), items: [] };
        out.push(g);
      }
      g.items.push(r);
    }
    return out;
  }, [rows]);

  const recent = (from: number, to: number) =>
    rows.filter((r) => {
      const age = Date.now() - +new Date(r.session.startedAt);
      return r.session.status !== "active" && age > from * DAY_MS && age <= to * DAY_MS;
    });
  const week = recent(-1, 7);
  const prevWeek = recent(7, 14);
  const weekVolume = week.reduce((sum, r) => sum + r.volume, 0);
  const prevWeekVolume = prevWeek.reduce((sum, r) => sum + r.volume, 0);
  const trend = prevWeekVolume > 0 ? Math.round(((weekVolume - prevWeekVolume) / prevWeekVolume) * 100) : null;
  const weekMinutes = week.reduce((sum, r) => sum + (r.mins ?? 0), 0);

  // `prs` keeps the current best per exercise+kind, so this flags the
  // session where each still-standing record was set.
  const prDays = useMemo(() => new Set(prs.map((p) => p.achievedAt.slice(0, 10))), [prs]);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">Every workout you&apos;ve logged.</p>
        </div>
        <Link href="/calendar" className="btn-ghost px-4 py-2.5">
          <CalendarDays className="h-4 w-4" aria-hidden /> Calendar
        </Link>
      </header>

      {!hydrated ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No workouts yet"
          body="Finish your first workout and it will show up here with your weekly trends."
          action={
            <Link href="/templates" className="btn-primary mt-2">
              Start a workout
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Last 7 days" className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Workouts" value={String(week.length)} sub="last 7 days" />
            <Stat
              label="Volume"
              value={formatVolume(weekVolume, units)}
              sub={
                trend == null ? (
                  "last 7 days"
                ) : (
                  <span className={trend >= 5 ? "text-green" : trend <= -5 ? "text-amber" : ""}>
                    {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs prior
                  </span>
                )
              }
            />
            <Stat label="Time" value={`${weekMinutes} min`} sub="last 7 days" />
          </section>

          <VolumeHeatmap sessions={sessions} sets={sets} units={units} />

          <div className="flex items-center justify-between">
            <h2 className="text-h2 text-ink">Workouts</h2>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Show archived
            </label>
          </div>

          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <h3 className="section-label">{g.label}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                {g.items.map(({ session, count, volume, exerciseIds, mins }) => {
                  const d = new Date(session.startedAt);
                  const names = exerciseIds.map((id) => exerciseById(id)?.name).filter(Boolean) as string[];
                  return (
                    <li key={session.id}>
                      <Link
                        href={`/session/${session.id}`}
                        className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface2/60 sm:px-5"
                      >
                        <div className="w-11 shrink-0 text-center">
                          <p className="text-[11px] font-semibold uppercase text-muted">
                            {d.toLocaleDateString(undefined, { weekday: "short" })}
                          </p>
                          <p className="text-xl font-bold leading-tight tabular-nums text-ink">{d.getDate()}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            <span className="truncate">{session.title}</span>
                            {prDays.has(session.startedAt.slice(0, 10)) && session.status !== "active" && (
                              <Trophy className="h-4 w-4 shrink-0 text-gold" aria-label="Personal record" />
                            )}
                            {session.status === "active" && <span className="badge-accent shrink-0">In progress</span>}
                            {session.status === "archived" && <span className="badge-neutral shrink-0">Archived</span>}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                            {mins != null && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" aria-hidden /> {mins} min
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Dumbbell className="h-3.5 w-3.5" aria-hidden /> {count} sets
                            </span>
                            {volume > 0 && <span>{formatVolume(volume, units)}</span>}
                          </p>
                          {names.length > 0 && (
                            <p className="mt-1 truncate text-xs text-inkSoft">
                              {names.slice(0, 4).join(" · ")}
                              {names.length > 4 ? ` +${names.length - 4}` : ""}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-3 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate text-lg font-bold tabular-nums text-ink sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted">{sub}</p>
    </div>
  );
}
