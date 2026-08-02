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
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur-xl">
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active =
            t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] transition-colors ${
                  active ? "text-blue-400" : "text-white/50"
                }`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
