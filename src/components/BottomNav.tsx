"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/templates", label: "Plans", icon: "📋" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/history", label: "History", icon: "🕘" },
  { href: "/progress", label: "Progress", icon: "📈" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-border bg-bg/95 backdrop-blur">
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
