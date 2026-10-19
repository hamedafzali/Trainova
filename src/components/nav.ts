import {
  Brain,
  ChartColumnIncreasing,
  ClipboardList,
  Dumbbell,
  History,
  Home,
  ListChecks,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other path prefixes that belong to this destination. */
  also?: string[];
}

export const HOME: NavItem = { href: "/", label: "Home", icon: Home, also: ["/coach", "/inbox"] };
/** Plan: the programme you follow and its calendar. */
export const PLAN: NavItem = { href: "/programs", label: "Plan", icon: ClipboardList, also: ["/calendar"] };
/** Workouts: the workouts you can start, live sessions and past workouts. */
export const WORKOUTS: NavItem = {
  href: "/templates",
  label: "Workouts",
  icon: Dumbbell,
  also: ["/session", "/history", "/exercises"],
};
export const EXERCISES: NavItem = { href: "/exercises", label: "Exercises", icon: ListChecks };
export const PROGRESS: NavItem = { href: "/progress", label: "Progress", icon: ChartColumnIncreasing };
export const HISTORY: NavItem = { href: "/history", label: "History", icon: History };
export const COACH: NavItem = { href: "/coach", label: "AI Coach", icon: Brain };
export const PROFILE: NavItem = { href: "/profile", label: "Profile", icon: User };

/** Bottom tab bar (phones): the five top-level destinations. The coach is reached from Home. */
export const MOBILE_TABS: NavItem[] = [HOME, PLAN, WORKOUTS, PROGRESS, PROFILE];

/** Sidebar (tablet/desktop): the same destinations, with their main sub-pages. */
export function sidebarItems(): NavItem[] {
  return [{ ...HOME, also: undefined }, PLAN, WORKOUTS, EXERCISES, HISTORY, PROGRESS, COACH, PROFILE];
}

function matchLength(item: NavItem, path: string): number {
  if (item.href === "/" && path === "/") return 1;
  const prefixes = item.href === "/" ? (item.also ?? []) : [item.href, ...(item.also ?? [])];
  const hit = prefixes.filter((p) => path === p || path.startsWith(p + "/"));
  // The item's own href beats a borrowed prefix of the same length.
  return Math.max(0, ...hit.map((p) => p.length * 2 + (p === item.href ? 1 : 0)));
}

/**
 * href of the item a path belongs to — the most specific match, so only one
 * item is highlighted. On a tie the narrower item (fewer prefixes) wins.
 */
export function activeHref(items: NavItem[], path: string): string | null {
  let best: NavItem | null = null;
  let score = 0;
  for (const it of items) {
    const m = matchLength(it, path);
    if (m > score || (m === score && m > 0 && best && (it.also?.length ?? 0) < (best.also?.length ?? 0))) {
      [best, score] = [it, m];
    }
  }
  return best?.href ?? null;
}
