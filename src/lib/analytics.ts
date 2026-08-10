"use client";

import { getToken } from "@/lib/auth";

/** Best-effort product telemetry; logging must never delay a gym-floor action. */
export function trackEvent(name: string, properties: Record<string, string | number | boolean> = {}) {
  const token = getToken();
  if (!token) return;
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, properties }),
  }).catch(() => undefined);
}
