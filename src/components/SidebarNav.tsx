"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAiEnabled } from "@/lib/supabase/client";
import {
  Calendar,
  ClipboardList,
  History,
  TrendingUp,
  Brain,
  User,
  type LucideIcon,
} from "lucide-react";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Today", icon: Calendar },
  { href: "/templates", label: "Plans", icon: ClipboardList },
  { href: "/history", label: "History", icon: History },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: User },
];

export function SidebarNav() {
  const path = usePathname();
  const items = isAiEnabled()
    ? [...navItems.slice(0, 4), { href: "/coach", label: "Coach", icon: Brain }, navItems[4]]
    : navItems;

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:bg-elevated md:border-r md:border-border md:px-5 md:py-7">
      <div className="mb-8 px-3">
        <h1 className="text-h3 text-ink">Trainova</h1>
        <p className="section-label mt-0.5">Strength Training Tracker</p>
      </div>

      <nav className="flex-1 space-y-0.5" aria-label="Primary">
        {items.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-control text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/15 text-ink"
                  : "text-inkSoft hover:bg-surface2 hover:text-ink"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-5 border-t border-border px-3">
        <p className="text-[11px] text-muted">© 2024 Trainova</p>
      </div>
    </aside>
  );
}
