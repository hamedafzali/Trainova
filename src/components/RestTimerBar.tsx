"use client";

import { useEffect, useRef, useState } from "react";
import { useRestTimer } from "@/lib/restTimer";

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Rest countdown pinned to the bottom of the workout screen while a timer runs. */
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
    <div
      role="timer"
      aria-live="off"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pl-64 md:max-w-none md:flex md:justify-center"
    >
      <div
        className={`w-full overflow-hidden rounded-card border shadow-elevated transition-colors md:max-w-md ${
          over ? "border-green bg-green text-onStatus" : "border-border bg-surface text-ink"
        }`}
      >
        {!over && (
          <div className="h-1 bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
        )}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1 pl-1">
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${over ? "" : "text-muted"}`}>
              {over ? "Rest over" : "Rest"}
            </p>
            <p
              className={`text-2xl font-bold leading-tight tabular-nums transition-transform duration-200 ease-out ${
                justFlipped ? "scale-110" : "scale-100"
              }`}
            >
              {over ? "Next set" : mmss(remainingSec)}
            </p>
          </div>
          {!over && (
            <>
              <button
                type="button"
                onClick={() => add(-15)}
                aria-label="15 seconds less"
                className="rounded-control bg-surface2 px-3 py-2.5 text-sm font-bold text-ink transition-transform active:scale-95"
              >
                −15
              </button>
              <button
                type="button"
                onClick={() => add(15)}
                aria-label="15 seconds more"
                className="rounded-control bg-surface2 px-3 py-2.5 text-sm font-bold text-ink transition-transform active:scale-95"
              >
                +15
              </button>
            </>
          )}
          <button
            type="button"
            onClick={stop}
            className={`rounded-control px-4 py-2.5 text-sm font-bold transition-transform active:scale-95 ${
              over ? "bg-onStatus/15" : "bg-accentFill text-onAccent"
            }`}
          >
            {over ? "Dismiss" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
