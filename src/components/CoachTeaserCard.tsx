"use client";

import Link from "next/link";
import { useCoachData } from "@/lib/useCoachData";
import { Skeleton } from "./Skeleton";

/**
 * Lightweight, single-card pointer to the full Coach screen on Today —
 * intentionally not a second place hints are generated (see /coach page for
 * the real content). Shows the single highest-priority insight, or nothing
 * once there's genuinely nothing to say, so it never becomes a fixture that
 * feels stale.
 */
export function CoachTeaserCard() {
  const { enabled, insights, summary } = useCoachData();

  if (!enabled) return null;

  const loading = summary.exercises.length === 0 && summary.streakDays === 0 && insights.length === 0;
  const top = insights[0];

  if (!loading && !top) return null;

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
        🧠
      </span>
      <div className="flex-1 min-w-0">
        <p className="section-label">Coach</p>
        {top ? (
          <p className="text-body-sm text-ink mt-0.5 truncate">{top.message}</p>
        ) : (
          <Skeleton className="h-3.5 w-2/3 mt-1.5" />
        )}
      </div>
      <span className="text-inkSoft" aria-hidden>
        →
      </span>
    </Link>
  );
}
