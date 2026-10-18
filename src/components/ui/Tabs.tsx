"use client";

import { useRef } from "react";

export interface TabItem<K extends string> {
  key: K;
  label: string;
}

/**
 * Underline tabs: equal-width labels over a hairline, the active one lime with
 * a lime bar. Arrow keys move between tabs (WAI-ARIA tabs pattern).
 */
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  className = "",
}: {
  tabs: TabItem<K>[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  /** Tabs get `${idPrefix}-tab-${key}`; panels should use `${idPrefix}-panel-${key}`. */
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`flex border-b border-border ${className}`}>
      {tabs.map((t, i) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.key}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative min-h-12 flex-1 px-2 text-[15px] font-medium transition-colors ${
              active ? "text-accent" : "text-inkSoft hover:text-ink"
            }`}
          >
            {t.label}
            <span
              aria-hidden
              className={`absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-accent transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, tab, children }: { idPrefix: string; tab: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${tab}`} aria-labelledby={`${idPrefix}-tab-${tab}`}>
      {children}
    </div>
  );
}
