"use client";

import { useRef, useState } from "react";

/**
 * Large thumb-zone primary action. Tap to complete, OR swipe right past the
 * threshold — a green fill tracks the drag for a satisfying, glanceable commit.
 */
export function CompleteButton({ onComplete }: { onComplete: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const start = useRef<number | null>(null);
  const [pct, setPct] = useState(0);

  const width = () => ref.current?.offsetWidth ?? 1;

  return (
    <button
      ref={ref}
      className="relative w-full overflow-hidden rounded-2xl bg-accent py-4 text-base font-bold text-onAccent active:scale-[0.99]"
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        start.current = e.clientX;
        ref.current?.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current == null) return;
        const dx = Math.max(0, e.clientX - start.current);
        setPct(Math.min(1, dx / (width() * 0.6)));
      }}
      onPointerUp={() => {
        const done = pct >= 1;
        start.current = null;
        setPct(0);
        if (done) onComplete();
      }}
      onPointerCancel={() => {
        start.current = null;
        setPct(0);
      }}
      onClick={() => {
        // plain tap (no drag)
        if (start.current == null && pct === 0) onComplete();
      }}
    >
      <span
        className="absolute inset-y-0 left-0 bg-green/70 transition-[width] duration-75"
        style={{ width: `${pct * 100}%` }}
      />
      <span className="relative">{pct > 0 ? "Release to complete ✓" : "✓  Complete set"}</span>
    </button>
  );
}
