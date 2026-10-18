"use client";

import { useStore } from "./store";
import { apiFetch, handleUnauthorized, isSignedIn } from "./auth";
import { mergeSnapshots } from "@/domain/merge";
import { SCHEMA_VERSION, upgradeWeights } from "@/domain/legacy";

// The slice of store state that syncs to the account (everything persisted
// except the session/auth flag itself).
const SYNC_KEYS = [
  "units",
  "profile",
  "audit",
  "planChanges",
  "devices",
  "exercises",
  "programs",
  "templates",
  "sessions",
  "sets",
  "feedback",
  "prs",
  "bodyLog",
  "tombstones",
] as const;

type Snapshot = Record<string, unknown>;

export function snapshot(): Snapshot {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const out: Snapshot = {};
  for (const k of SYNC_KEYS) out[k] = s[k];
  out.schema = SCHEMA_VERSION;
  return out;
}

/**
 * Fold the account copy into local state. Local-only records (e.g. a workout
 * logged offline) survive; deletions on either side win via tombstones.
 */
export function mergeRemote(remote: Snapshot | null | undefined) {
  if (!remote) return;
  applySnapshot(mergeSnapshots(snapshot(), upgradeWeights(remote)));
}

export function applySnapshot(data: Snapshot | null | undefined) {
  if (!data) return;
  const patch: Snapshot = {};
  for (const k of SYNC_KEYS) if (k in data) patch[k] = data[k];
  useStore.setState(patch as Partial<ReturnType<typeof useStore.getState>>);
}

// The server version the client last saw — the write is a compare-and-set on it.
let baseVersion: number | null = null;
let lastSyncError: string | null = null;

/** Why the last push failed (shown in Profile), or null when healthy. */
export function syncError(): string | null {
  return lastSyncError;
}

export async function pullState(): Promise<Snapshot | null> {
  if (!isSignedIn()) return null;
  try {
    const r = await apiFetch("/api/state");
    if (r.status === 401) {
      handleUnauthorized();
      return null;
    }
    if (!r.ok) return null;
    const j = await r.json();
    baseVersion = typeof j.version === "number" ? j.version : 0;
    return (j.data as Snapshot) ?? null;
  } catch {
    return null; // offline → keep local
  }
}

function put(): Promise<Response> {
  return apiFetch("/api/state", {
    method: "PUT",
    body: JSON.stringify({ data: snapshot(), baseVersion }),
  });
}

export async function pushState(): Promise<void> {
  if (!isSignedIn()) return;
  try {
    // Never pushed or pulled yet: learn the server version first so we merge
    // rather than get a guaranteed conflict.
    if (baseVersion === null) {
      const blob = await pullState();
      if (blob) mergeRemote(blob);
      if (baseVersion === null) return;
    }
    let r = await put();
    if (r.status === 401) {
      handleUnauthorized();
      return;
    }
    // Conflict: another device wrote since our last pull. Merge and retry once.
    if (r.status === 409) {
      const j = await r.json();
      if (j.data) mergeRemote(j.data);
      baseVersion = typeof j.version === "number" ? j.version : null;
      r = await put();
    }
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      if (typeof j.version === "number") baseVersion = j.version;
      lastSyncError = null;
    } else if (r.status === 413 || r.status === 422) {
      const j = await r.json().catch(() => ({}));
      lastSyncError = j.error ?? "Sync rejected";
    }
  } catch {
    /* offline → will resync on next change */
  }
}
