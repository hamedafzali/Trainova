"use client";

import { useRef } from "react";

/**
 * Keyboard-free numeric control. Three ways to change the value:
 *  - tap − / +            (one step)
 *  - press & hold − / +   (accelerating auto-repeat for big jumps)
 *  - drag the value field horizontally (continuous ±)
 * Long-press the value opens the OS numeric pad as an opt-in escape hatch.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const valRef = useRef(value);
  valRef.current = value;
  const timer = useRef<number | null>(null);
  const drag = useRef<{ x: number; base: number } | null>(null);

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

  return (
    <div className="flex items-center gap-2">
      <HoldButton label="−" onStart={() => startHold(-1)} onStop={stop} />
      <div
        className="flex flex-1 cursor-ew-resize select-none items-baseline justify-center gap-1 rounded-xl bg-surface2 py-2"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDownValue}
        onPointerMove={onPointerMoveValue}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="text-2xl font-bold tabular-nums text-ink">{display}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      <HoldButton label="+" onStart={() => startHold(1)} onStop={stop} />
    </div>
  );
}

function HoldButton({
  label,
  onStart,
  onStop,
}: {
  label: string;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <button
      aria-label={label === "+" ? "increase" : "decrease"}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface2 text-2xl font-bold text-ink active:bg-border"
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
