"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Today", icon: "📅" },
  { href: "/templates", label: "Plans", icon: "📋" },
  { href: "/history", label: "History", icon: "🕘" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function SidebarNav() {
  const path = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:bg-white/[0.02] md:border-r md:border-white/10 md:px-5 md:py-7">
      <div className="mb-8 px-3">
        <h1 className="text-xl font-bold text-white">Trainova</h1>
        <p className="text-xs text-white/40 mt-0.5">Strength Training Tracker</p>
      </div>

      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-5 border-t border-white/10 px-3">
        <p className="text-[11px] text-white/25">© 2024 Trainova</p>
      </div>
    </aside>
  );
}
