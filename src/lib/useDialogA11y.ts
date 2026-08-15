"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Standard modal/sheet keyboard behavior: Escape closes, Tab is trapped
 * inside the panel while open, and focus returns to whatever triggered
 * the dialog once it closes. Wire into any `role="dialog"` panel.
 */
export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    if (!open) return;

    const trigger = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const getFocusable = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

    const focusables = getFocusable();
    (focusables[0] ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const f = getFocusable();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
