"use client";

import { useStore } from "./store";
import { clearToken, getToken } from "./auth";

/** Expired/invalid token → drop the session so the user lands back on login. */
function handleAuthError() {
  clearToken();
  useStore.getState().leaveSession();
}

// The slice of store state that syncs to the account (everything persisted
// except the session/auth flag itself).
const SYNC_KEYS = [
  "units",
  "profile",
  "audit",
  "devices",
  "exercises",
  "programs",
  "templates",
  "sessions",
  "sets",
  "prs",
] as const;

type Snapshot = Record<string, unknown>;

export function snapshot(): Snapshot {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const out: Snapshot = {};
  for (const k of SYNC_KEYS) out[k] = s[k];
  return out;
}

export function applySnapshot(data: Snapshot | null | undefined) {
  if (!data) return;
  const patch: Snapshot = {};
  for (const k of SYNC_KEYS) if (k in data) patch[k] = data[k];
  useStore.setState(patch as Partial<ReturnType<typeof useStore.getState>>);
}

export async function pullState(): Promise<Snapshot | null> {
  const t = getToken();
  if (!t) return null;
  try {
    const r = await fetch("/api/state", { headers: { authorization: `Bearer ${t}` } });
    if (r.status === 401) {
      handleAuthError();
      return null;
    }
    if (!r.ok) return null;
    const j = await r.json();
    return (j.data as Snapshot) ?? null;
  } catch {
    return null; // offline → keep local
  }
}

export async function pushState(): Promise<void> {
  const t = getToken();
  if (!t) return;
  try {
    const r = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify({ data: snapshot() }),
    });
    if (r.status === 401) handleAuthError();
  } catch {
    /* offline → will resync on next change */
  }
}
