import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Square shortcut tile: lime line icon over a label (Home → Quick Actions). */
export function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex aspect-[0.9] min-w-0 flex-col items-center justify-center gap-2.5 rounded-card bg-surface p-2 text-sm text-ink transition-colors hover:bg-surface2"
    >
      <Icon className="h-8 w-8 text-accent" strokeWidth={1.7} aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
