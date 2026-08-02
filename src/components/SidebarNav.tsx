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
    <aside className="hidden md:flex md:flex-col md:w-72 md:fixed md:inset-y-0 md:left-0 md:bg-black/50 md:backdrop-blur-xl md:border-r md:border-white/10 md:px-6 md:py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Trainova
        </h1>
        <p className="text-sm text-white/50 mt-2">Strength Training Tracker</p>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10">
        <p className="text-xs text-white/30">© 2024 Trainova</p>
      </div>
    </aside>
  );
}
