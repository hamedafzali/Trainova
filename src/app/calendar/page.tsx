"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";

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
        .filter((s) => {
          const d = new Date(s.startedAt);
          return key(d.getFullYear(), d.getMonth(), d.getDate()) === selected;
        })
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions, selected]
  );

  const shift = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted">Every day you trained.</p>
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-muted">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat value={`🔥 ${streak}`} label={streak === 1 ? "day streak" : "day streak"} />
            <Stat value={`${monthCount}`} label={`in ${MONTHS[view.m]}`} />
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => shift(-1)} className="btn-ghost px-3 py-1.5">
                ‹
              </button>
              <p className="font-semibold">
                {MONTHS[view.m]} {view.y}
              </p>
              <button onClick={() => shift(1)} className="btn-ghost px-3 py-1.5">
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase text-muted">
              {DOW.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
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
                    className={`flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition ${
                      trained ? "bg-accent font-bold text-black" : "text-muted hover:bg-surface2"
                    } ${isSel ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""} ${
                      isToday && !trained ? "border border-accent/60" : ""
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {selectedSessions.length === 0 ? (
              <div className="card text-center text-sm text-muted">No workout on this day.</div>
            ) : (
              selectedSessions.map((s) => (
                <Link key={s.id} href={`/session/${s.id}`} className="card flex items-center justify-between">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-accent">{s.endedAt ? "View →" : "Resume →"}</span>
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
