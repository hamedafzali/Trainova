"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * The active tab, kept in `?tab=` so a tab can be linked to and survives a
 * reload. The default tab leaves the URL clean. Writes use history.replaceState
 * (Next keeps useSearchParams in sync), so switching tabs adds no history entry
 * and makes no server request.
 */
export function useTabParam<K extends string>(keys: readonly K[], fallback: K): [K, (k: K) => void] {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab = keys.includes(raw as K) ? (raw as K) : fallback;
  const setTab = useCallback(
    (k: K) => {
      const url = new URL(window.location.href);
      if (k === fallback) url.searchParams.delete("tab");
      else url.searchParams.set("tab", k);
      window.history.replaceState(window.history.state, "", url);
    },
    [fallback],
  );
  return [tab, setTab];
}
