import type { TrainingSummary } from "@/domain/coach";

/**
 * State-at-a-glance strip for the Coach screen. Unlike the single-state
 * Calendar streak banner, this hero blends whichever signals are actually
 * live (streak/volume/PRs) into one soft gradient wash — it's the page
 * where all three informational hues can legitimately appear together, so
 * the gradient reads as "your coaching picture" rather than one specific
 * state.
 */
export function CoachSummaryHero({ summary }: { summary: TrainingSummary }) {
  const trend = summary.volumeTrendPct;
  const trendUp = trend != null && trend >= 5;
  const trendDown = trend != null && trend <= -5;
  const prCount = summary.recentPRs.length;

  return (
    <div className="rounded-card border border-border bg-gradient-to-br from-flame/[0.08] via-gold/[0.06] to-green/[0.08] shadow-card p-5 grid grid-cols-3 gap-3 text-center">
      <div>
        <p
          className={`text-h2 tabular-nums ${summary.streakDays > 0 ? "text-flame" : "text-muted"}`}
        >
          {summary.streakDays > 0 ? `🔥 ${summary.streakDays}` : "—"}
        </p>
        <p className="text-caption text-muted mt-1">Streak</p>
      </div>
      <div>
        <p
          className={`text-h2 tabular-nums ${
            trendUp ? "text-green" : trendDown ? "text-amber" : "text-muted"
          }`}
        >
          {trend == null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}
        </p>
        <p className="text-caption text-muted mt-1">Volume trend</p>
      </div>
      <div>
        <p className={`text-h2 tabular-nums ${prCount > 0 ? "text-gold" : "text-muted"}`}>
          {prCount > 0 ? `🏆 ${prCount}` : "—"}
        </p>
        <p className="text-caption text-muted mt-1">Recent PRs</p>
      </div>
    </div>
  );
}
