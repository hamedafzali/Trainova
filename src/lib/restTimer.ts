"use client";

import { create } from "zustand";

/**
 * Rest-timer state. Deliberately NOT persisted — a countdown shouldn't survive a
 * reload. Auto-starts when a set is completed and is shown as a sticky bar.
 */
interface RestState {
  endsAt: number | null; // epoch ms when rest finishes
  duration: number; // seconds, for the progress bar
  start: (seconds: number) => void;
  add: (seconds: number) => void;
  stop: () => void;
}

export const useRestTimer = create<RestState>((set, get) => ({
  endsAt: null,
  duration: 0,
  start: (seconds) => set({ endsAt: Date.now() + seconds * 1000, duration: seconds }),
  add: (seconds) => {
    const cur = get().endsAt ?? Date.now();
    const base = Math.max(cur, Date.now());
    set({ endsAt: base + seconds * 1000, duration: get().duration + seconds });
  },
  stop: () => set({ endsAt: null, duration: 0 }),
}));

/** Default rest for an exercise — compounds need longer. */
export function defaultRest(isCompound: boolean): number {
  return isCompound ? 120 : 90;
}
