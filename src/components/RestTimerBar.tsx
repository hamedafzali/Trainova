"use client";

import { useEffect, useRef, useState } from "react";
import { useRestTimer } from "@/lib/restTimer";

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Sticky rest countdown shown above the bottom nav while a timer is running. */
export function RestTimerBar() {
  const { endsAt, duration, add, stop } = useRestTimer();
  const [now, setNow] = useState(Date.now());
  const buzzedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // Buzz once when this timer crosses zero.
  useEffect(() => {
    if (!endsAt) return;
    const remaining = endsAt - now;
    if (remaining <= 0 && buzzedFor.current !== endsAt) {
      buzzedFor.current = endsAt;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([120, 60, 120]);
      }
    }
  }, [now, endsAt]);

  if (!endsAt) return null;

  const remainingSec = (endsAt - now) / 1000;
  const over = remainingSec <= 0;
  const pct = over ? 100 : Math.min(100, ((duration - remainingSec) / duration) * 100);

  return (
    <div className="fixed inset-x-0 bottom-[60px] z-30 mx-auto max-w-md px-3">
      <div
        className={`overflow-hidden rounded-2xl border shadow-lg ${
          over ? "border-green bg-green text-onAccent" : "border-border bg-surface text-ink"
        }`}
      >
        {!over && (
          <div
            className="h-1 bg-accentDim transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        )}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className={`text-sm font-medium ${over ? "" : "text-inkSoft"}`}>
            {over ? "💪 Rest over" : "Resting"}
          </span>
          <span
            className={`flex-1 text-center text-2xl font-bold tabular-nums ${
              over ? "" : "text-accentDim animate-breathe"
            }`}
          >
            {over ? "Go!" : mmss(remainingSec)}
          </span>
          {!over && (
            <>
              <button
                onClick={() => add(-15)}
                className="rounded-lg bg-surface2 px-2.5 py-1 text-xs font-semibold text-ink"
              >
                −15
              </button>
              <button
                onClick={() => add(15)}
                className="rounded-lg bg-surface2 px-2.5 py-1 text-xs font-semibold text-ink"
              >
                +15
              </button>
            </>
          )}
          <button
            onClick={stop}
            className={`rounded-lg px-3 py-1 text-xs font-bold ${
              over ? "bg-black/10" : "bg-accentDim text-onAccent"
            }`}
          >
            {over ? "Dismiss" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
