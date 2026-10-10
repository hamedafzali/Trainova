"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAiStatus } from "@/lib/ai";
import { useAssistant } from "@/lib/assistant";
import { pageFocus } from "@/lib/pageFocus";
import { useStore } from "@/lib/store";
import { TrainerChat } from "./TrainerChat";

const PANEL_ID = "coach-assistant";

/** True while a modal other than the coach panel is open (its buttons sit where the coach button would). */
function useOtherModalOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () =>
      setOpen(!!document.querySelector(`[aria-modal="true"]:not(#${PANEL_ID}), [role="alertdialog"]`));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return open;
}

/** False while the page scrolls down (content passes under the button), true on scroll up or at either end. */
function useShowOnScrollUp(): boolean {
  const [show, setShow] = useState(true);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atEnd = y < 40 || window.innerHeight + y >= document.documentElement.scrollHeight - 40;
      if (atEnd || y < lastY - 4) setShow(true);
      else if (y > lastY + 4) setShow(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return show;
}

/** Opens the coach panel; for page headers that host the coach instead of the floating button. */
export function CoachHeaderButton() {
  const ai = useAiStatus();
  const setOpen = useAssistant((s) => s.setOpen);
  if (ai.available !== true) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Ask your coach"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-control text-accent hover:bg-surface2"
    >
      <Sparkles className="h-5 w-5" aria-hidden />
    </button>
  );
}

/**
 * The coach on every page: a floating button on the top layer (above nav and
 * toasts) that opens the chat in a panel (bottom sheet on mobile, side drawer
 * on desktop). Mounted in the root layout, outside AppShell. It shares the
 * conversation with /coach and tells the coach what the client has open.
 *
 * The floating button steps aside so it never covers controls: while the page
 * scrolls down, while another dialog is open, and during a workout, where the
 * session header hosts the coach button instead.
 */
export function CoachAssistant() {
  const ai = useAiStatus();
  const pathname = usePathname();
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const otherModal = useOtherModalOpen();
  const scrolledIn = useShowOnScrollUp();
  // Re-derive the page focus as the workout is logged.
  const sets = useStore((s) => s.sets);
  const focus = useMemo(() => (open ? pageFocus(pathname) : null), [open, pathname, sets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (ai.available !== true) return null;

  const inSession = pathname.startsWith("/session/");
  const showFab = !open && !otherModal && !inSession;

  return (
    <>
      {showFab && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          tabIndex={scrolledIn ? 0 : -1}
          aria-hidden={!scrolledIn}
          className={`fixed bottom-20 right-4 z-[60] group grid h-12 w-12 animate-popIn place-items-center rounded-full bg-accentFill text-onAccent shadow-lg transition-all duration-250 ease-standard hover:scale-105 active:scale-95 md:bottom-6 md:right-6 ${
            scrolledIn ? "" : "pointer-events-none translate-y-24 opacity-0"
          }`}
          aria-label="Ask your coach"
        >
          <span className="absolute inset-0 animate-coachGlow rounded-full" aria-hidden />
          <Sparkles className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" aria-hidden />
        </button>
      )}
      {open && (
        <div id={PANEL_ID} className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Coach">
          <button
            type="button"
            className="absolute inset-0 animate-fadeIn bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Close coach"
            tabIndex={-1}
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[85dvh] animate-sheetUp flex-col rounded-t-card border border-border bg-surface shadow-xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[420px] md:animate-drawerIn md:rounded-none md:rounded-l-card">
            <TrainerChat variant="panel" focus={focus} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
