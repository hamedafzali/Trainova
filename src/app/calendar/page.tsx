"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { startOfWeek, weekDays, weekStreak } from "@/domain/streak";
import { useMemo, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { CalendarSkeleton } from "@/components/Skeleton";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function key(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const hydrated = useHydrated();
  const sessions = useStore((s) => s.sessions);
  const trainedDays = useStore((s) => s.trainedDays());
  const templates = useStore((s) => s.templates);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const router = useRouter();
  const [logPlan, setLogPlan] = useState("");

  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(
    key(today.getFullYear(), today.getMonth(), today.getDate())
  );

  // Build the month grid (Monday-first).
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // convert Sun=0 to Mon=0
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  // Weekly streak (strength training isn't daily); days in the current
  // run of trained weeks get the flame dot.
  const { streak, streakKeys } = useMemo(() => {
    const n = weekStreak(trainedDays, today);
    const keys = new Set<string>();
    const cursor = startOfWeek(today);
    for (let w = 0; w <= n; w++) {
      for (const k of weekDays(cursor)) if (trainedDays.has(k)) keys.add(k);
      cursor.setDate(cursor.getDate() - 7);
    }
    return { streak: n, streakKeys: n > 0 ? keys : new Set<string>() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainedDays]);

  const monthCount = useMemo(
    () =>
      [...trainedDays].filter((k) => k.startsWith(`${view.y}-${String(view.m + 1).padStart(2, "0")}`))
        .length,
    [trainedDays, view]
  );

  const selectedSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status !== "archived" && s.date === selected)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions, selected]
  );

  const shift = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="page-title">Calendar</h1>
        <p className="page-subtitle">Every day you trained. Pick a past day to log a workout you forgot.</p>
      </header>

      {!hydrated ? (
        <CalendarSkeleton />
      ) : (
        <>
          {/* Streak leads — the one number this screen exists to reinforce.
              Gradient only appears while the streak is alive: it's the
              banner's job to make "still going" feel different from "reset
              to zero," so a flat neutral card communicates the broken state
              without needing a second color. The flame is a small, designed
              mark beside the number — not scaled up to compete with it — so
              the streak count stays the unambiguously largest thing here. */}
          <div
            className={`rounded-card shadow-elevated p-6 text-center space-y-1.5 ${
              streak > 0
                ? "border border-flame/30 bg-gradient-to-br from-flame/[0.14] via-gold/[0.08] to-transparent"
                : "border border-border bg-surface"
            }`}
          >
            <div className="flex items-center justify-center gap-2.5">
              <Flame
                aria-hidden
                size={30}
                strokeWidth={2.25}
                className={streak > 0 ? "text-flame" : "text-muted"}
                fill={streak > 0 ? "currentColor" : "none"}
                fillOpacity={streak > 0 ? 0.18 : 0}
              />
              <p
                className={`font-display text-hero tabular-nums leading-none ${streak > 0 ? "text-flame" : "text-ink"}`}
              >
                {streak}
              </p>
            </div>
            <p className="text-body-sm text-inkSoft">
              {streak > 0 ? `week${streak === 1 ? "" : "s"} in a row with a workout` : "train this week to start a streak"}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface shadow-card overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => shift(-1)} className="btn-ghost h-11 w-11 p-0" aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-ink">
                    {MONTHS[view.m]} {view.y}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {monthCount} session{monthCount === 1 ? "" : "s"} this month
                  </p>
                </div>
                <button onClick={() => shift(1)} className="btn-ghost h-11 w-11 p-0" aria-label="Next month">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] uppercase text-muted">
                {DOW.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((d, i) => {
                  if (d === null) return <span key={i} />;
                  const k = key(view.y, view.m, d);
                  const trained = trainedDays.has(k);
                  const isToday = k === todayKey;
                  const isSel = k === selected;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(k)}
                      className={`relative flex h-11 items-center sm:h-auto sm:aspect-square justify-center rounded-control text-sm tabular-nums transition-colors ${
                        isSel
                          ? "bg-accentFill font-bold text-onAccent shadow-sm"
                          : isToday
                          ? "text-accent font-semibold hover:bg-accent/10"
                          : "text-inkSoft hover:bg-border/60"
                      }`}
                    >
                      {d}
                      {trained && (
                        <span
                          className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                            isSel
                              ? "bg-onAccent"
                              : streakKeys.has(k)
                              ? "bg-flame"
                              : "bg-green"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected-day detail lives inside the same shelf as the grid, not a floating panel. */}
            <div className="border-t border-border p-4 sm:p-6 space-y-3">
              <h2 className="section-label">
                {new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              {selectedSessions.length === 0 ? (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-body-sm text-muted">No workout on this day.</p>
                  {selected <= todayKey && !getActiveSession() && (
                    <div className="mx-auto flex max-w-sm flex-col gap-2 sm:flex-row">
                      <select
                        aria-label="Plan to log"
                        value={logPlan}
                        onChange={(e) => setLogPlan(e.target.value)}
                        className="input flex-1 py-2.5 text-sm"
                      >
                        <option value="">Empty workout</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-secondary px-4 py-2.5 text-sm"
                        onClick={() => {
                          const { id } = startSession(logPlan || null, selected);
                          if (id) router.push(`/session/${id}`);
                        }}
                      >
                        <Plus className="h-4 w-4" aria-hidden /> Log workout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="-mx-4 sm:-mx-6 divide-y divide-border">
                  {selectedSessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/session/${s.id}`}
                      className="flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-border/60 transition-colors"
                    >
                      <span className="font-semibold text-ink">{s.title}</span>
                      <span className="text-sm text-accent font-semibold">
                        {s.status === "active" ? "Resume →" : "View →"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
