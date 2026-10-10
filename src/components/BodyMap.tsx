"use client";

import { BACK, BACK_OFFSET, BODY_VIEWBOX, FRONT, type BodyShape } from "@/lib/bodyShapes";
import type { Muscle } from "@/domain/taxonomy";

/**
 * Front/back body figure. Colour comes from the caller (`fillFor`), so the same
 * figure serves readiness, session coverage, etc. Decorative to assistive tech:
 * callers always pair it with a text summary that carries the same facts.
 */
export function BodyMap({
  fillFor,
  pulse,
  targets,
  selected,
  onSelect,
  className = "",
}: {
  fillFor: (m: Muscle) => string;
  /** Muscles that get a slow heat pulse (motion-safe only). */
  pulse?: (m: Muscle) => boolean;
  /** Muscles outlined in accent, e.g. what today's workout trains. */
  targets?: Set<Muscle>;
  selected?: Muscle | null;
  onSelect?: (m: Muscle) => void;
  className?: string;
}) {
  const shape = (s: BodyShape, i: number, dx: number) => {
    const m = s.m;
    const cls = [
      m ? fillFor(m) : "fill-border/50",
      m && targets?.has(m) ? "stroke-accent stroke-[1.3]" : "stroke-transparent",
      m && selected === m ? "!stroke-ink stroke-[1.6]" : "",
      m && pulse?.(m) ? "motion-safe:animate-breathe" : "",
      m && onSelect ? "cursor-pointer" : "",
      "transition-[fill] duration-300 ease-standard",
    ].join(" ");
    const props = {
      className: cls,
      style: m && pulse?.(m) ? { animationDuration: "3.2s" } : undefined,
      onClick: m && onSelect ? () => onSelect(m) : undefined,
    };
    if (s.t === "e") return <ellipse key={i} {...props} cx={s.cx + dx} cy={s.cy} rx={s.rx} ry={s.ry} />;
    if (s.t === "r") return <rect key={i} {...props} x={s.x + dx} y={s.y} width={s.w} height={s.h} rx={s.r} />;
    return <path key={i} {...props} d={s.d} transform={`translate(${dx} 0)`} />;
  };

  return (
    <svg viewBox={BODY_VIEWBOX} className={className} aria-hidden>
      <g>{FRONT.map((s, i) => shape(s, i, 0))}</g>
      <g>{BACK.map((s, i) => shape(s, i, BACK_OFFSET))}</g>
    </svg>
  );
}
