"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Numeric control built for gym hands. Ways to change the value:
 *  - tap − / +            (one step)
 *  - press & hold − / +   (accelerating auto-repeat for big jumps)
 *  - tap the value to type an exact number
 *  - keyboard: focus the value, ↑/↓ (Shift = ×5), Enter to type
 *
 * The value itself never reacts to swipes, so scrolling the page over it is safe.
 *
 * `size="lg"` is the hero treatment for the one number that matters most on
 * screen (the active set's weight) — everything else stays default-sized so
 * the hierarchy reads at a glance. `size="sm"` fits several per row (plan editor).
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit,
  label,
  size = "default",
  decimals,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Accessible name, e.g. "Weight". */
  label?: string;
  size?: "default" | "lg" | "sm";
  /** Precision for typed values; defaults to the step's precision. */
  decimals?: number;
}) {
  const valRef = useRef(value);
  valRef.current = value;
  const timer = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const prevValue = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const places = decimals ?? (String(step).split(".")[1]?.length ?? 0);
  const roundTo = (v: number) => {
    const f = 10 ** Math.max(places, 2);
    return Math.round(v * f) / f;
  };
  const clampStep = (v: number) => Math.min(max, Math.max(min, roundTo(Math.round(v / step) * step)));
  const clampFree = (v: number) => Math.min(max, Math.max(min, roundTo(v)));
  const bump = (dir: number, mult = 1) => onChange(clampStep(valRef.current + dir * step * mult));

  const stop = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

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

  const startEdit = () => {
    setDraft(String(display));
    setEditing(true);
  };
  const commit = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(n)) onChange(clampFree(n));
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const display = Number.isInteger(value) ? value : Math.round(value * 100) / 100;

  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 160);
    return () => clearTimeout(t);
  }, [value]);

  const lg = size === "lg";
  const sm = size === "sm";
  const numberClass = `${lg ? "text-[2.75rem] leading-none sm:text-hero" : sm ? "text-lg font-semibold" : "text-stat"} font-display tabular-nums text-ink`;
  const pad = lg ? "py-5" : sm ? "py-1.5" : "py-2";

  return (
    <div className={`flex items-center ${sm ? "gap-1" : "gap-2.5"}`}>
      <HoldButton dir={-1} label={label} onStart={() => startHold(-1)} onStop={stop} onKey={() => bump(-1)} size={size} />
      {editing ? (
        <div className={`flex min-w-0 flex-1 items-baseline justify-center gap-1.5 rounded-control bg-surface2 ring-2 ring-accent/50 ${pad}`}>
          <input
            ref={inputRef}
            aria-label={label}
            inputMode={places > 0 || step % 1 !== 0 ? "decimal" : "numeric"}
            enterKeyHint="done"
            className={`${numberClass} w-full min-w-0 bg-transparent text-center outline-none`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          {unit && !sm && <span className={`${lg ? "text-sm" : "text-xs"} pr-3 text-muted`}>{unit}</span>}
        </div>
      ) : (
        <div
          role="spinbutton"
          tabIndex={0}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={unit ? `${display} ${unit}` : String(display)}
          title="Tap to type"
          className={`flex min-w-0 flex-1 cursor-text select-none items-baseline justify-center gap-1.5 overflow-hidden rounded-control bg-surface2 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${pad}`}
          onClick={startEdit}
          onKeyDown={(e) => {
            const mult = e.shiftKey ? 5 : 1;
            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              bump(1, mult);
            } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              bump(-1, mult);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startEdit();
            } else if (/^\d$/.test(e.key)) {
              setDraft(e.key);
              setEditing(true);
            }
          }}
        >
          <span
            className={`${numberClass} transition-transform duration-150 ease-out ${pulse ? "scale-110" : "scale-100"}`}
          >
            {display}
          </span>
          {unit && !sm && <span className={`${lg ? "text-sm" : "text-xs"} text-muted`}>{unit}</span>}
        </div>
      )}
      <HoldButton dir={1} label={label} onStart={() => startHold(1)} onStop={stop} onKey={() => bump(1)} size={size} />
    </div>
  );
}

function HoldButton({
  dir,
  label,
  onStart,
  onStop,
  onKey,
  size = "default",
}: {
  dir: 1 | -1;
  label?: string;
  onStart: () => void;
  onStop: () => void;
  onKey: () => void;
  size?: "default" | "lg" | "sm";
}) {
  const lg = size === "lg";
  const dims = lg ? "h-14 w-14 text-3xl" : size === "sm" ? "h-9 w-8 text-lg" : "h-12 w-12 text-2xl";
  const what = label ? ` ${label.toLowerCase()}` : "";
  // A press only counts once it's clearly a tap or a hold: a finger that
  // lands here to scroll the page must not change the number.
  const press = useRef<{ x: number; y: number; holding: boolean; timer: number } | null>(null);
  const cancel = () => {
    if (!press.current) return;
    clearTimeout(press.current.timer);
    if (press.current.holding) onStop();
    press.current = null;
  };
  useEffect(() => cancel, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button
      type="button"
      aria-label={dir > 0 ? `Increase${what}` : `Decrease${what}`}
      className={`flex ${dims} shrink-0 touch-manipulation items-center justify-center rounded-control bg-surface2 font-bold text-ink transition-transform duration-100 active:scale-90 active:bg-border focus-visible:ring-2 focus-visible:ring-accent/50`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        cancel();
        const p = { x: e.clientX, y: e.clientY, holding: false, timer: 0 };
        p.timer = window.setTimeout(() => {
          p.holding = true;
          onStart();
        }, 380);
        press.current = p;
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && !p.holding && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancel();
      }}
      onPointerUp={() => {
        const p = press.current;
        if (!p) return;
        if (!p.holding) onKey(); // a plain tap: one step
        cancel();
      }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      // Pointer presses are handled above; `detail === 0` means keyboard activation.
      onClick={(e) => {
        if (e.detail === 0) onKey();
      }}
    >
      {dir > 0 ? "+" : "−"}
    </button>
  );
}
