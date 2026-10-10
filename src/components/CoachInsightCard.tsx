import { ArrowDown, ArrowUp, Check, Flame, Info, Trophy, TriangleAlert, type LucideIcon } from "lucide-react";
import type { CoachInsight } from "@/domain/coach";

const SEVERITY_STYLES: Record<CoachInsight["severity"], { badge: string; icon: LucideIcon }> = {
  success: { badge: "badge-success", icon: Check },
  warning: { badge: "badge-warning", icon: TriangleAlert },
  info: { badge: "badge-accent", icon: Info },
};

export function CoachInsightCard({ insight }: { insight: CoachInsight }) {
  // A few kinds carry a more specific hue than their generic severity would
  // give them, so the same state reads as the same color everywhere it
  // appears (PR toast/hero chip, streak banner, Coach/Progress/History trend
  // indicators) rather than collapsing onto one blue "info" bucket.
  const KIND_OVERRIDES: Partial<Record<CoachInsight["kind"], { badge: string; icon: LucideIcon }>> = {
    pr: { badge: "badge-gold", icon: Trophy },
    streak: { badge: "badge-flame", icon: Flame },
    volume_up: { badge: "badge-success", icon: ArrowUp },
    volume_down: { badge: "badge-warning", icon: ArrowDown },
  };
  const style = KIND_OVERRIDES[insight.kind] ?? SEVERITY_STYLES[insight.severity];
  const Icon = style.icon;
  // Bare row, not a .card — meant to sit inside a single divided list
  // alongside its siblings rather than stack as its own bordered box. The
  // hero slot above already owns the "dominant card" treatment for Coach.
  return (
    <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
      <span
        className={`${style.badge} h-6 w-6 shrink-0 justify-center rounded-full p-0`}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <p className="text-body text-ink">{insight.message}</p>
    </div>
  );
}
