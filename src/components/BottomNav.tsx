"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, activeHref } from "./nav";

/** Tab bar (phones): flat, full width; the active tab's icon and label turn lime. */
export function BottomNav() {
  const path = usePathname();
  // A live workout owns the whole screen; its own header handles navigation.
  if (path.startsWith("/session/")) return null;
  const current = activeHref(MOBILE_TABS, path);
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-sheet border-t border-border bg-elevated/70 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {MOBILE_TABS.map((t) => {
          const active = t.href === current;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1.5 text-[10px] transition-colors ${
                  active ? "font-semibold text-accent" : "font-medium text-muted hover:text-ink"
                }`}
              >
                <t.icon
                  className={`h-6 w-6 ${t.href === "/templates" ? "rotate-45" : ""}`}
                  strokeWidth={active ? 2.2 : 1.6}
                  fill={active && t.href === "/" ? "currentColor" : "none"}
                  aria-hidden
                />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
