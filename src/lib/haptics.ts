"use client";

// Tactile confirmation. Web Vibration API where supported; silently no-ops
// otherwise (e.g. iOS Safari), so callers never need to guard.
export type Haptic = "tick" | "pr" | "finish" | "restOver";

const PATTERNS: Record<Haptic, number | number[]> = {
  tick: 15,
  pr: [0, 35, 40, 35],
  finish: [0, 30, 30, 30, 30, 60],
  restOver: [120, 60, 120],
};

export function haptic(kind: Haptic): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(PATTERNS[kind]);
    } catch {
      /* ignore */
    }
  }
}
