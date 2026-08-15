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
  const [justFlipped, setJustFlipped] = useState(false);
  const wasOver = useRef(false);

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

  const remainingSec = endsAt ? (endsAt - now) / 1000 : 0;
  const over = !!endsAt && remainingSec <= 0;

  useEffect(() => {
    if (over && !wasOver.current) {
      setJustFlipped(true);
      const t = setTimeout(() => setJustFlipped(false), 220);
      wasOver.current = true;
      return () => clearTimeout(t);
    }
    if (!over) wasOver.current = false;
  }, [over]);

  if (!endsAt) return null;

  const pct = over
    ? 100
    : Math.min(100, ((duration - remainingSec) / duration) * 100);

  return (
    <div className="fixed inset-x-0 bottom-[60px] z-30 mx-auto max-w-md px-3">
      <div
        className={`overflow-hidden rounded-card border shadow-elevated transition-colors ${
          over
            ? "border-green bg-green text-onStatus"
            : "border-border bg-surface text-ink"
        }`}
      >
        {!over && (
          <div
            className="h-1 bg-accentDim transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        )}
        <div className="flex items-center gap-4 px-5 py-4">
          <span
            className={`text-base font-semibold ${over ? "" : "text-inkSoft"}`}
          >
            {over ? "💪 Rest over" : "Resting"}
          </span>
          <span
            className={`flex-1 text-center text-display tabular-nums transition-transform duration-200 ease-out ${
              over ? (justFlipped ? "scale-110" : "scale-100") : "text-accentDim animate-breathe"
            }`}
          >
            {over ? "Go!" : mmss(remainingSec)}
          </span>
          {!over && (
            <>
              <button
                onClick={() => add(-15)}
                className="rounded-control bg-surface2 px-5 py-3 text-base font-bold text-ink transition-transform active:scale-95"
              >
                −15
              </button>
              <button
                onClick={() => add(15)}
                className="rounded-control bg-surface2 px-5 py-3 text-base font-bold text-ink transition-transform active:scale-95"
              >
                +15
              </button>
            </>
          )}
          <button
            onClick={stop}
            className={`rounded-control px-4 py-2 text-sm font-bold transition-transform active:scale-95 ${
              over ? "bg-onAccent/10" : "bg-accentDim text-onAccent"
            }`}
          >
            {over ? "Dismiss" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
