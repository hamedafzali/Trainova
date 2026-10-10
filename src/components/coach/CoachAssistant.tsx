"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAiStatus } from "@/lib/ai";
import { pageFocus } from "@/lib/pageFocus";
import { useStore } from "@/lib/store";
import { TrainerChat } from "./TrainerChat";

/**
 * The coach on every page: a floating button that opens the chat in a panel
 * (bottom sheet on mobile, side drawer on desktop). It shares the conversation
 * with /coach and tells the coach what the client has open.
 */
export function CoachAssistant() {
  const ai = useAiStatus();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Re-derive the page focus as the workout is logged.
  const sets = useStore((s) => s.sets);
  const focus = useMemo(() => (open ? pageFocus(pathname) : null), [open, pathname, sets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (ai.available !== true || pathname === "/coach") return null;

  // Clear the bottom nav on mobile, and the rest timer bar during a workout.
  const inSession = pathname.startsWith("/session/");
  const fabPos = inSession ? "bottom-24 md:bottom-24" : "bottom-20 md:bottom-6";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-accentFill text-onAccent shadow-lg transition-transform hover:scale-105 active:scale-95 md:right-6 ${fabPos}`}
          aria-label="Ask your coach"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Coach">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close coach"
            tabIndex={-1}
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[85vh] flex-col rounded-t-card border border-border bg-surface shadow-xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[420px] md:rounded-none md:rounded-l-card">
            <TrainerChat variant="panel" focus={focus} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
