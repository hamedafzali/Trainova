"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
];

/** Three-way theme switch, used in Profile → Preferences. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPref(getStoredTheme());
  }, []);

  const pick = (next: ThemePreference) => {
    applyTheme(next);
    setPref(next);
  };

  if (pref === null) return null; // avoid a mismatched flash before mount

  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-control border border-border">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => pick(o.key)}
          className={`py-4 text-base font-semibold transition-colors ${
            pref === o.key
              ? "bg-accentFill text-onAccent"
              : "bg-surface2 text-inkSoft hover:bg-border/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
