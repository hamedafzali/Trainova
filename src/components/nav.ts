import { Brain, ClipboardList, Dumbbell, History, Home, TrendingUp, User, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const HOME: NavItem = { href: "/", label: "Today", icon: Home };
export const PLANS: NavItem = { href: "/templates", label: "Plans", icon: ClipboardList };
export const EXERCISES: NavItem = { href: "/exercises", label: "Exercises", icon: Dumbbell };
export const HISTORY: NavItem = { href: "/history", label: "History", icon: History };
export const PROGRESS: NavItem = { href: "/progress", label: "Progress", icon: TrendingUp };
export const COACH: NavItem = { href: "/coach", label: "Coach", icon: Brain };
export const PROFILE: NavItem = { href: "/profile", label: "Profile", icon: User };

/** Bottom tab bar (phones): five destinations, everything else one tap away. */
export const MOBILE_TABS: NavItem[] = [HOME, PLANS, HISTORY, PROGRESS, PROFILE];

export function sidebarItems(ai: boolean): NavItem[] {
  return [HOME, PLANS, EXERCISES, HISTORY, PROGRESS, ...(ai ? [COACH] : []), PROFILE];
}

/** Which nav item a path belongs to (calendar lives under History, etc.). */
export function isActive(item: NavItem, path: string): boolean {
  if (item.href === "/") return path === "/";
  if (item.href === "/history") return path.startsWith("/history") || path.startsWith("/calendar");
  if (item.href === "/templates") return path.startsWith("/templates") || path.startsWith("/programs");
  return path.startsWith(item.href);
}
