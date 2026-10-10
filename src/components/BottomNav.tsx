"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, isActive } from "./nav";

/**
 * Floating dock (phones): a frosted pill above the home indicator, with an
 * accent capsule that glides to the active tab.
 */
export function BottomNav() {
  const path = usePathname();
  // A live workout owns the whole screen; its own header handles navigation.
  if (path.startsWith("/session/")) return null;
  const activeIdx = MOBILE_TABS.findIndex((t) => isActive(t, path));
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      aria-label="Primary"
    >
      <ul className="pointer-events-auto relative mx-auto grid max-w-md grid-cols-5 rounded-[1.75rem] border border-border/80 bg-elevated/80 p-1.5 shadow-elevated backdrop-blur-2xl backdrop-saturate-150">
        {activeIdx >= 0 && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-1.5 rounded-[1.375rem] bg-accent/[0.12] transition-transform duration-300 ease-standard motion-reduce:transition-none"
            style={{ width: `calc((100% - 0.75rem) / 5)`, transform: `translateX(${activeIdx * 100}%)` }}
          />
        )}
        {MOBILE_TABS.map((t) => {
          const active = isActive(t, path);
          return (
            <li key={t.href} className="relative">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-${t.label.toLowerCase()}`}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-inkSoft"
                }`}
              >
                <t.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
