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
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:left-0 md:bg-surface md:border-r md:border-border md:px-6 md:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Trainova</h1>
        <p className="text-sm text-muted mt-1">Strength Training Tracker</p>
      </div>
      
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                active 
                  ? "bg-accent text-onAccent" 
                  : "text-inkSoft hover:bg-surface2"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-auto pt-6 border-t border-border">
        <p className="text-xs text-muted">© 2024 Trainova</p>
      </div>
    </aside>
  );
}
