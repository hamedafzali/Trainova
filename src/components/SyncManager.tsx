"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";
import { applySnapshot, pullState, pushState } from "@/lib/sync";

/**
 * Keeps an account's data in sync with the server: pulls on open/login, then
 * pushes local changes (debounced). No-op in guest mode. Mounted once globally.
 */
export function SyncManager() {
  const account = useStore((s) => s.session?.mode === "account");
  const timer = useRef<number | null>(null);

  // Pull the server copy when an account becomes active (login / app open).
  useEffect(() => {
    if (!account || !getToken()) return;
    let cancelled = false;
    pullState().then((d) => {
      if (!cancelled) applySnapshot(d);
    });
    return () => {
      cancelled = true;
    };
  }, [account]);

  // Push local changes up, debounced.
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
