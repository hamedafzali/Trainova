"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useCoachData } from "@/lib/useCoachData";

/**
 * Lightweight pointer to the Coach screen on Today — not a second place
 * hints are generated. Shows the highest-priority insight, or an invitation
 * to ask the coach when there's nothing to flag.
 */
export function CoachTeaserCard() {
  const { insights } = useCoachData();
  const top = insights[0];

  return (
    <Link
      href="/coach"
      data-testid="coach-teaser"
      className="card flex items-center gap-3 py-4 transition-colors duration-150 hover:bg-surface2"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accentFill text-onAccent"
        aria-hidden
      >
        <Sparkles className="h-[18px] w-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="section-label">Coach</p>
        <p className="text-body-sm text-ink mt-0.5 truncate">
          {top ? top.message : "Ask your coach anything"}
        </p>
      </div>
      <span className="text-inkSoft" aria-hidden>
        →
      </span>
    </Link>
  );
}
