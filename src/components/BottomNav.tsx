"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, isActive } from "./nav";

export function BottomNav() {
  const path = usePathname();
  // A live workout owns the whole screen; its own header handles navigation.
  if (path.startsWith("/session/")) return null;
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-elevated/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((t) => {
          const active = isActive(t, path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-${t.label.toLowerCase()}`}
                className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-inkSoft"
                }`}
              >
                <t.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
