import {
  AlertTriangle,
  CalendarClock,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { CoachInsight } from "@/domain/coach";

// Attention order, most urgent first — this is what decides which single
// insight earns the hero slot. Same "needs a look" > "worth celebrating" >
// "fyi" instinct as a notifications tray, not just insertion order.
const PRIORITY: CoachInsight["kind"][] = [
  "missed",
  "stall",
  "volume_down",
  "pr",
  "streak",
  "volume_up",
];

export function pickHeroInsight(insights: CoachInsight[]): CoachInsight | null {
  if (insights.length === 0) return null;
  return [...insights].sort(
    (a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)
  )[0];
}

type HeroStyle = {
  eyebrow: string;
  icon: LucideIcon;
  wash: string;
  iconWrap: string;
  iconColor: string;
  eyebrowColor: string;
};

// Kind-specific styling carries the real urgency signal (a stall reads as
// amber "needs attention" even though its domain severity is just
// "warning" like a missed session); severity is the fallback for anything
// not called out by name.
const KIND_STYLES: Partial<Record<CoachInsight["kind"], HeroStyle>> = {
  missed: {
    eyebrow: "Needs attention",
    icon: CalendarClock,
    wash: "bg-gradient-to-br from-amber/[0.20] via-amber/[0.06] to-transparent",
    iconWrap: "bg-amber/15",
    iconColor: "text-amber",
    eyebrowColor: "text-amber",
  },
  stall: {
    eyebrow: "Needs attention",
    icon: AlertTriangle,
    wash: "bg-gradient-to-br from-amber/[0.20] via-amber/[0.06] to-transparent",
    iconWrap: "bg-amber/15",
    iconColor: "text-amber",
    eyebrowColor: "text-amber",
  },
  volume_down: {
    eyebrow: "Trending down",
    icon: TrendingDown,
    wash: "bg-gradient-to-br from-amber/[0.16] via-amber/[0.05] to-transparent",
    iconWrap: "bg-amber/15",
    iconColor: "text-amber",
    eyebrowColor: "text-amber",
  },
  volume_up: {
    eyebrow: "Trending up",
    icon: TrendingUp,
    wash: "bg-gradient-to-br from-green/[0.16] via-green/[0.05] to-transparent",
    iconWrap: "bg-green/15",
    iconColor: "text-green",
    eyebrowColor: "text-green",
  },
  pr: {
    eyebrow: "Personal record",
    icon: Trophy,
    wash: "bg-gradient-to-br from-gold/[0.20] via-gold/[0.06] to-transparent",
    iconWrap: "bg-gold/15",
    iconColor: "text-gold",
    eyebrowColor: "text-gold",
  },
  streak: {
    eyebrow: "Streak momentum",
    icon: Flame,
    wash: "bg-gradient-to-br from-flame/[0.20] via-flame/[0.06] to-transparent",
    iconWrap: "bg-flame/15",
    iconColor: "text-flame",
    eyebrowColor: "text-flame",
  },
};

const FALLBACK_STYLE: HeroStyle = {
  eyebrow: "Coach note",
  icon: Sparkles,
  wash: "bg-gradient-to-br from-accent/[0.14] via-accent/[0.05] to-transparent",
  iconWrap: "bg-accent/15",
  iconColor: "text-accent",
  eyebrowColor: "text-accent",
};

/**
 * The one thing Coach exists to surface, given real visual weight instead of
 * routing through the same bordered .card every other screen uses. No
 * border, a saturated hue wash instead — the color itself carries urgency
 * (amber = needs a look, gold/flame = celebrate, accent = fyi), and the
 * message runs at heading scale instead of body text.
 */
export function CoachHeroInsight({ insight }: { insight: CoachInsight }) {
  const style = KIND_STYLES[insight.kind] ?? FALLBACK_STYLE;
  const Icon = style.icon;
  return (
    <div className={`rounded-card ${style.wash} p-6 sm:p-8 flex items-start gap-4 sm:gap-5`}>
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}
      >
        <Icon aria-hidden size={24} strokeWidth={2.25} className={style.iconColor} />
      </div>
      <div className="min-w-0 space-y-1.5 pt-0.5">
        <p className={`text-caption uppercase font-semibold ${style.eyebrowColor}`}>
          {style.eyebrow}
        </p>
        <p className="text-h2 leading-snug text-ink">{insight.message}</p>
      </div>
    </div>
  );
}
