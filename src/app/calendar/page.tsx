"use client";

import Link from "next/link";
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

  // Current streak: consecutive days up to today that were trained.
  const streak = useMemo(() => {
    let n = 0;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // If today not trained, start the count from yesterday.
    if (!trainedDays.has(key(d.getFullYear(), d.getMonth(), d.getDate()))) {
      d.setDate(d.getDate() - 1);
    }
    while (trainedDays.has(key(d.getFullYear(), d.getMonth(), d.getDate()))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
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
        <p className="page-subtitle">Every day you trained.</p>
      </header>

      {!hydrated ? (
        <CalendarSkeleton />
      ) : (
        <>
          {/* Streak leads — the one number this screen exists to reinforce. */}
          <div className="rounded-card border border-accent/30 bg-accent/[0.06] shadow-elevated p-6 text-center space-y-1">
            <p className="text-display tabular-nums text-ink">🔥 {streak}</p>
            <p className="text-body-sm text-inkSoft">day streak</p>
          </div>

          <div className="rounded-card border border-border bg-surface shadow-card overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => shift(-1)} className="btn-ghost px-3 py-1.5">
                  ‹
                </button>
                <div className="text-center">
                  <p className="font-semibold text-ink">
                    {MONTHS[view.m]} {view.y}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {monthCount} session{monthCount === 1 ? "" : "s"} this month
                  </p>
                </div>
                <button onClick={() => shift(1)} className="btn-ghost px-3 py-1.5">
                  ›
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
                      className={`relative flex aspect-square items-center justify-center rounded-control text-sm tabular-nums transition-colors ${
                        isSel
                          ? "bg-accent font-bold text-onAccent shadow-sm"
                          : isToday
                          ? "text-accent font-semibold hover:bg-accent/10"
                          : "text-inkSoft hover:bg-border/60"
                      }`}
                    >
                      {d}
                      {trained && (
                        <span
                          className={`absolute bottom-1.5 h-1 w-1 rounded-full ${
                            isSel ? "bg-onAccent/70" : "bg-accent"
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
                <div className="py-8 text-center text-body-sm text-muted">No workout on this day.</div>
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
