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
    <main className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="page-title">Calendar</h1>
        <p className="page-subtitle">Every day you trained.</p>
      </header>

      {!hydrated ? (
        <div className="card animate-pulse text-white/50">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Stat value={`🔥 ${streak}`} label={streak === 1 ? "day streak" : "day streak"} />
            <Stat value={`${monthCount}`} label={`in ${MONTHS[view.m]}`} />
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => shift(-1)} className="btn-ghost px-3 py-1.5">
                ‹
              </button>
              <p className="font-semibold text-white">
                {MONTHS[view.m]} {view.y}
              </p>
              <button onClick={() => shift(1)} className="btn-ghost px-3 py-1.5">
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase text-white/40">
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
                    className={`flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-colors ${
                      trained ? "bg-blue-600 font-bold text-white" : "text-white/60 hover:bg-white/[0.07]"
                    } ${isSel ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0a0a0f]" : ""} ${
                      isToday && !trained ? "border border-blue-500/60" : ""
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="section-label">
              {new Date(selected + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {selectedSessions.length === 0 ? (
              <div className="card text-center py-12 text-base text-white/50">No workout on this day.</div>
            ) : (
              selectedSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="card flex items-center justify-between p-6 hover:bg-white/[0.07] transition-colors"
                >
                  <span className="font-semibold text-white">{s.title}</span>
                  <span className="text-sm text-blue-400 font-semibold">
                    {s.status === "active" ? "Resume →" : "View →"}
                  </span>
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
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="text-xs text-white/50 mt-1">{label}</p>
    </div>
  );
}
