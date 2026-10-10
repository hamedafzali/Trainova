"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { isActive, sidebarItems } from "./nav";

export function SidebarNav() {
  const path = usePathname();
  const items = sidebarItems();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:bg-elevated md:border-r md:border-border md:px-5 md:py-7">
      <div className="mb-8 flex items-center gap-3 px-3">
        <LogoMark className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-h3 text-ink">Trainova</h1>
          <p className="text-xs text-muted">Strength training tracker</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5" aria-label="Primary">
        {items.map((item) => {
          const active = isActive(item, path);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-control text-sm font-medium transition-colors ${
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
        <p className="text-[11px] text-muted">© {new Date().getFullYear()} Trainova</p>
      </div>
    </aside>
  );
}
