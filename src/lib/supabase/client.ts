"use client";

// Backend availability flag. The auth/sync API is same-origin (built into this
// app), so the client only needs to know whether the server has a database
// configured — surfaced at build time via NEXT_PUBLIC_AUTH_ENABLED.
export function isCloudEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === "1";
}
