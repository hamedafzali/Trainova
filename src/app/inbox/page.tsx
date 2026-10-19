"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Bell, Brain, ChevronRight, ClipboardCheck, Info, TriangleAlert, Trophy, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { IconButton, PageHeader } from "@/components/kit";
import type { InboxTone } from "@/domain/inbox";
import { useHydrated } from "@/lib/store";
import { useInbox } from "@/lib/useInbox";

const TONE: Record<InboxTone, { icon: LucideIcon; tile: string }> = {
  action: { icon: ClipboardCheck, tile: "bg-accent/15 text-accent" },
  warning: { icon: TriangleAlert, tile: "bg-warningSoft text-amber" },
  success: { icon: Trophy, tile: "bg-successSoft text-green" },
  info: { icon: Info, tile: "bg-surface2 text-inkSoft" },
};

export default function InboxPage() {
  const hydrated = useHydrated();
  const { items, seen, markAllSeen } = useInbox();
  // Items that were new when the page opened keep their "New" tag while it's open.
  const newAtOpen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    if (!newAtOpen.current) newAtOpen.current = new Set(items.filter((i) => !seen.has(i.id)).map((i) => i.id));
    markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        subtitle="What needs your attention, from your plan, trainer and recovery."
        actions={<IconButton href="/coach" icon={Brain} label="AI coach" />}
      />

      {!hydrated ? null : items.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" body="New records, trainer plans and recovery reminders will show up here." />
      ) : (
        <ul className="card divide-y divide-border overflow-hidden p-0">
          {items.map((item) => {
            const tone = TONE[item.tone];
            const isNew = newAtOpen.current?.has(item.id) ?? !seen.has(item.id);
            return (
              <li key={item.id}>
                <Link href={item.href} className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface2">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${tone.tile}`}>
                    <tone.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink">{item.title}</span>
                      {isNew && item.tone !== "info" && <span className="badge-accent">New</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-inkSoft">{item.body}</span>
                  </span>
                  <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-muted group-hover:text-ink" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
