"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function dayKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Month grid with trained days highlighted + a day streak. Selection is controlled. */
export function MonthCalendar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (key: string) => void;
}) {
  const trainedDays = useStore((s) => s.trainedDays());
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const streak = useMemo(() => {
    let n = 0;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!trainedDays.has(dayKey(d.getFullYear(), d.getMonth(), d.getDate()))) {
      d.setDate(d.getDate() - 1);
    }
    while (trainedDays.has(dayKey(d.getFullYear(), d.getMonth(), d.getDate()))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainedDays]);

  const shift = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="btn-ghost px-3 py-1.5">
          ‹
        </button>
        <p className="font-semibold">
          {MONTHS[view.m]} {view.y}
          {streak > 0 && <span className="ml-2 text-sm text-accent">🔥 {streak}</span>}
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
          const k = dayKey(view.y, view.m, d);
          const trained = trainedDays.has(k);
          const isToday = k === todayKey;
          const isSel = k === selected;
          return (
            <button
              key={i}
              onClick={() => onSelect(k)}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition ${
                trained ? "bg-accent font-bold text-onAccent" : "text-inkSoft hover:bg-surface2"
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
  );
}
