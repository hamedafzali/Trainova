"use client";

import { apiFetch, isSignedIn } from "@/lib/auth";

const OPT_OUT_KEY = "trainova-analytics-off";

export function analyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Local mirror of the account setting so nothing is even sent once off. */
export function setAnalyticsOptOut(off: boolean) {
  try {
    if (off) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Best-effort product telemetry; logging must never delay a gym-floor action. */
export function trackEvent(name: string, properties: Record<string, string | number | boolean> = {}) {
  if (!isSignedIn() || analyticsOptedOut()) return;
  void apiFetch("/api/events", { method: "POST", body: JSON.stringify({ name, properties }) }).catch(
    () => undefined
  );
}
