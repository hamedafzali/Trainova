// The web SyncManager (src/components/SyncManager.tsx) for the app: on open,
// sign-in and return to the foreground it merges the account copy and the
// shared exercise library; local changes are pushed, debounced.
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useStore } from "@/lib/store";
import { fetchMe } from "@/lib/auth";
import { mergeRemote, pullState, pushState } from "@/lib/sync";
import { fetchLibrary } from "@/lib/library";

async function refresh(account: boolean, isCancelled: () => boolean) {
  if (account && (await fetchMe())) {
    const blob = await pullState();
    if (!isCancelled() && blob) mergeRemote(blob);
  }
  const lib = await fetchLibrary();
  if (!isCancelled() && lib) useStore.getState().setLibrary(lib.devices, lib.exercises);
}

export function useSync() {
  const account = useStore((s) => s.session?.mode === "account");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void refresh(account, () => cancelled);
    // Coming back to the app: another device may have logged a workout.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh(account, () => cancelled);
      // Leaving: publish anything still waiting on the debounce.
      if (state === "background" && account && timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void pushState();
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [account]);

  useEffect(() => {
    if (!account) return;
    const unsub = useStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void pushState();
      }, 1500);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [account]);
}
