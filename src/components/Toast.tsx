"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";

const VARIANT_STYLES: Record<ToastMessage["variant"], string> = {
  neutral: "bg-surface border border-border text-ink",
  success: "bg-gold text-onStatus",
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
      {items.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          className={`w-fit rounded-full px-5 py-2.5 font-semibold shadow-lg transition-opacity duration-150 ${
            t.leaving ? "opacity-0" : "animate-popIn opacity-100"
          } ${VARIANT_STYLES[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
