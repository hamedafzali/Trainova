"use client";

import { Check } from "lucide-react";

/** Large thumb-zone primary action for logging the current set. */
export function CompleteButton({
  onComplete,
  label = "Complete set",
}: {
  onComplete: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-2 rounded-card bg-accentFill py-4 text-base font-bold text-onAccent shadow-elevated transition-transform hover:bg-accentFillHover active:scale-[0.99]"
      onClick={onComplete}
    >
      <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      {label}
    </button>
  );
}
