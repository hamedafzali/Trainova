"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keyboard-free numeric control. Three ways to change the value:
 *  - tap − / +            (one step)
 *  - press & hold − / +   (accelerating auto-repeat for big jumps)
 *  - drag the value field horizontally (continuous ±)
 * Long-press the value opens the OS numeric pad as an opt-in escape hatch.
 *
 * `size="lg"` is the hero treatment for the one number that matters most on
 * screen (the active round's weight) — everything else stays default-sized
 * so the hierarchy reads at a glance.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit,
  size = "default",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  size?: "default" | "lg";
}) {
  const valRef = useRef(value);
  valRef.current = value;
  const timer = useRef<number | null>(null);
  const drag = useRef<{ x: number; base: number } | null>(null);
  const [pulse, setPulse] = useState(false);
  const prevValue = useRef(value);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const bump = (dir: number) => onChange(clamp(valRef.current + dir * step));

  const stop = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const startHold = (dir: number) => {
    bump(dir);
    let delay = 360;
    const run = () => {
      bump(dir);
      delay = Math.max(55, delay * 0.82);
      timer.current = window.setTimeout(run, delay);
    };
    timer.current = window.setTimeout(run, 420);
  };

  const onPointerDownValue = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, base: valRef.current };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMoveValue = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const steps = Math.round((e.clientX - drag.current.x) / 20);
    if (steps !== 0) onChange(clamp(drag.current.base + steps * step));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const display = Number.isInteger(value) ? value : Math.round(value * 100) / 100;

  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 160);
    return () => clearTimeout(t);
  }, [value]);

  const lg = size === "lg";

  return (
    <div className="flex items-center gap-2.5">
      <HoldButton label="−" onStart={() => startHold(-1)} onStop={stop} size={size} />
      <div
        className={`flex min-w-0 flex-1 cursor-ew-resize select-none items-baseline justify-center gap-1.5 overflow-hidden rounded-control bg-surface2 ${lg ? "py-5" : "py-2"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDownValue}
        onPointerMove={onPointerMoveValue}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          className={`${lg ? "text-[2.75rem] sm:text-hero" : "text-stat"} tabular-nums text-ink transition-transform duration-150 ease-out ${pulse ? "scale-110" : "scale-100"}`}
        >
          {display}
        </span>
        {unit && <span className={`${lg ? "text-sm" : "text-xs"} text-muted`}>{unit}</span>}
      </div>
      <HoldButton label="+" onStart={() => startHold(1)} onStop={stop} size={size} />
    </div>
  );
}

function HoldButton({
  label,
  onStart,
  onStop,
  size = "default",
}: {
  label: string;
  onStart: () => void;
  onStop: () => void;
  size?: "default" | "lg";
}) {
  const lg = size === "lg";
  return (
    <button
      aria-label={label === "+" ? "increase" : "decrease"}
      className={`flex ${lg ? "h-14 w-14 text-3xl" : "h-12 w-12 text-2xl"} shrink-0 items-center justify-center rounded-control bg-surface2 font-bold text-ink transition-transform duration-100 active:scale-90 active:bg-border`}
      onPointerDown={(e) => {
        e.preventDefault();
        onStart();
      }}
      onPointerUp={onStop}
      onPointerLeave={onStop}
      onPointerCancel={onStop}
    >
      {label}
    </button>
  );
}
