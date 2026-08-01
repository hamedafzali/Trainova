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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-7xl border-t border-border bg-bg/95 backdrop-blur md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <ul className="grid grid-cols-4 md:grid-cols-4 md:max-w-2xl md:mx-auto">
        {tabs.map((t) => {
          const active =
            t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] md:py-3 md:text-sm ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-lg leading-none md:text-xl">
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
