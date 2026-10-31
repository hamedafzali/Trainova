"use client";

import { useEffect, useState } from "react";

// Installing Trainova to the home screen. Chrome and Edge fire `beforeinstallprompt`
// once, often before the Profile page mounts, so it's caught at startup and kept
// here. iOS Safari has no prompt at all; there it's Share → Add to Home Screen.

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call once on the client, as early as possible. */
export function listenForInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function current(): InstallState {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed || standalone) return "installed";
  if (deferred) return "prompt";
  // iPadOS reports itself as a Mac, so check for touch too.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "unavailable";
}

/** Where installing stands on this device; "unavailable" until mounted. */
export function useInstall(): [InstallState, () => Promise<void>] {
  const [state, setState] = useState<InstallState>("unavailable");
  useEffect(() => {
    const update = () => setState(current());
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const install = async () => {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    await e.prompt();
    // Chrome hands out a new event later if the person dismissed this one.
    if ((await e.userChoice).outcome === "accepted") installed = true;
    emit();
  };
  return [state, install];
}
