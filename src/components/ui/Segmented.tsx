"use client";

import { useRef, type ReactNode } from "react";

export interface SegmentedOption<K extends string> {
  key: K;
  label: ReactNode;
}

/**
 * The look of each variant. `layout` and `pad` are the defaults that
 * `className` and `itemClassName` replace, so a caller can change the grid or
 * the item padding without fighting the variant's colours.
 */
const VARIANTS = {
  /** Neutral track, the selected item raised: metric and set-type switches. */
  track: {
    box: "rounded-control bg-surface2 p-1",
    layout: "flex gap-1",
    item: "min-h-10 rounded-[8px] text-xs font-semibold transition-colors",
    pad: "px-3 py-1",
    on: "bg-surface text-ink shadow-sm",
    off: "text-muted hover:text-ink",
  },
  /** Pill track, the selected item lime: period switches. */
  accent: {
    box: "rounded-full border border-border bg-surface2 p-0.5",
    layout: "flex",
    item: "min-h-11 rounded-full text-sm font-semibold tabular-nums transition-colors",
    pad: "px-4",
    on: "bg-accentFill text-onAccent",
    off: "text-inkSoft hover:text-ink",
  },
  /** Separate bordered pills, the selected one lime: settings and onboarding choices. */
  choice: {
    box: "",
    layout: "flex flex-wrap gap-2",
    item: "min-h-11 rounded-full border text-sm font-semibold transition-colors",
    pad: "px-4 py-2",
    on: "border-accentFill bg-accentFill text-onAccent",
    off: "border-border bg-surface2 text-inkSoft hover:text-ink",
  },
  /** For a dark media surface (the 3D movement viewer), same in both themes. */
  overlay: {
    box: "rounded-full bg-white/5 p-1",
    layout: "flex gap-1",
    item: "h-11 min-w-11 rounded-full text-xs font-semibold transition-colors",
    pad: "px-3",
    on: "bg-white/15 text-white",
    off: "text-white/70 hover:text-white",
  },
} as const;

/**
 * A single choice from a few options (WAI-ARIA radio group): one tab stop,
 * arrow keys move and select. `value` may be null when nothing is picked yet.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  variant = "track",
  className,
  itemClassName,
}: {
  options: readonly SegmentedOption<K>[];
  value: K | null;
  /** Also called when the selected option is clicked again, so a caller can clear it. */
  onChange: (k: K) => void;
  label: string;
  variant?: keyof typeof VARIANTS;
  /** Replaces the variant's layout (flex/grid and gap). */
  className?: string;
  /** Replaces the variant's item padding. */
  itemClassName?: string;
}) {
  const v = VARIANTS[variant];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.key === value);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    onChange(options[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`${v.box} ${className ?? v.layout}`}>
      {options.map((o, i) => {
        const on = i === selected;
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (selected < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={`${v.item} ${itemClassName ?? v.pad} ${on ? v.on : v.off}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
