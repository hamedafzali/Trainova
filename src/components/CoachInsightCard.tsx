import type { CoachInsight } from "@/domain/coach";

const SEVERITY_STYLES: Record<CoachInsight["severity"], { badge: string; icon: string }> = {
  success: { badge: "badge-success", icon: "✓" },
  warning: { badge: "badge-warning", icon: "!" },
  info: { badge: "badge-accent", icon: "i" },
};

export function CoachInsightCard({ insight }: { insight: CoachInsight }) {
  // A few kinds carry a more specific hue than their generic severity would
  // give them, so the same state reads as the same color everywhere it
  // appears (PR toast/hero chip, streak banner, Coach/Progress/History trend
  // indicators) rather than collapsing onto one blue "info" bucket.
  const KIND_OVERRIDES: Partial<Record<CoachInsight["kind"], { badge: string; icon: string }>> = {
    pr: { badge: "badge-gold", icon: "🏆" },
    streak: { badge: "badge-flame", icon: "🔥" },
    volume_up: { badge: "badge-success", icon: "↑" },
    volume_down: { badge: "badge-warning", icon: "↓" },
  };
  const style = KIND_OVERRIDES[insight.kind] ?? SEVERITY_STYLES[insight.severity];
  // Bare row, not a .card — meant to sit inside a single divided list
  // alongside its siblings rather than stack as its own bordered box. The
  // hero slot above already owns the "dominant card" treatment for Coach.
  return (
    <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
      <span
        className={`${style.badge} h-6 w-6 shrink-0 justify-center rounded-full p-0 text-xs font-bold`}
        aria-hidden
      >
        {style.icon}
      </span>
      <p className="text-body text-ink">{insight.message}</p>
    </div>
  );
}
