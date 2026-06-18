"use client";

import { useEffect, useRef } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";
import { applySnapshot, pullState, pushState } from "@/lib/sync";
import { fetchLibrary } from "@/lib/library";

/**
 * Keeps data fresh: on open/login it pulls the account copy (if signed in) and
 * then merges the central shared library over the local seed, so admin edits to
 * devices reach everyone. Pushes local changes (debounced) for account users.
 */
export function SyncManager() {
  const hydrated = useHydrated();
  const account = useStore((s) => s.session?.mode === "account");
  const setLibrary = useStore((s) => s.setLibrary);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      if (account && getToken()) {
        const blob = await pullState();
        if (!cancelled) applySnapshot(blob);
      }
      const lib = await fetchLibrary();
      if (!cancelled && lib) setLibrary(lib.devices, lib.exercises);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, account]);

  // Push local changes up, debounced (account only).
  useEffect(() => {
    if (!account) return;
    const unsub = useStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (getToken()) void pushState();
      }, 1500);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [account]);

  return null;
}
