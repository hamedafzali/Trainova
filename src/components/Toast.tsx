"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";

const VARIANT_STYLES: Record<ToastMessage["variant"], string> = {
  neutral: "bg-surface border border-border text-ink",
  // PR moment: a gold-to-flame sheen + the existing (previously unused)
  // prRing pulse chained after the entrance pop — the one toast variant
  // that gets extra flourish, since a PR is the rarest, most celebratory
  // state in the app. Combined into one arbitrary-value animation (rather
  // than stacking animate-popIn + animate-prRing classes) because both
  // utilities set the same `animation` property — the second would just
  // silently overwrite the first.
  success:
    "bg-gradient-to-r from-gold to-flame text-onStatus animate-[popIn_180ms_ease-out,prRing_700ms_ease-in-out_2_180ms]",
  error: "bg-danger/90 text-onStatus",
};

export function ToastHost() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
      data-testid="toast-host"
    >
      {items.map((t) => {
        const enterAnim = t.variant === "success" ? "" : "animate-popIn";
        return (
          <div
            key={t.id}
            data-testid="toast"
            className={`w-fit rounded-full px-5 py-2.5 font-semibold shadow-lg transition-opacity duration-150 ${
              t.leaving ? "opacity-0" : `${enterAnim} opacity-100`
            } ${VARIANT_STYLES[t.variant]}`}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
