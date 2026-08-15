"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today", icon: "📅" },
  { href: "/templates", label: "Plans", icon: "📋" },
  { href: "/history", label: "History", icon: "🕘" },
  { href: "/progress", label: "Progress", icon: "📈" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-elevated/95 backdrop-blur-xl"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active =
            t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-${t.label.toLowerCase()}`}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
