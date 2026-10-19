// Pure merge of two synced snapshots. Additive by record id so concurrent edits
// on two devices (e.g. a workout logged on each) are both kept, rather than one
// blob overwriting the other. See PLATFORM.md / sync hardening.
//
// Conflict policy (deterministic, per record):
// - definitions (templates, programs, custom exercises/devices, feedback,
//   bodyweight entries) keep the copy with the newer `updatedAt` edit stamp;
//   unstamped legacy copies tie and keep the local one;
// - sessions keep the newer `updatedAt`; sets keep the newer edit/completion;
// - deletions win via tombstones;
// - personal records are derived: rebuilt from the merged sets.

import type { Device, Exercise, PersonalRecord, WorkoutSet } from "./types";
import { rebuildAllPrs } from "./records";
import { newer } from "./versioning";
import { MAX_PLAN_CHANGES } from "./planChanges";

type Rec = Record<string, unknown>;
export type Snapshot = Record<string, unknown>;

function mergeArr(
  a: Rec[],
  b: Rec[],
  keyOf: (x: Rec) => string,
  pick: (local: Rec, remote: Rec) => Rec
): Rec[] {
  const map = new Map<string, Rec>();
  for (const x of b) map.set(keyOf(x), x); // start from remote
  for (const x of a) {
    const k = keyOf(x);
    const existing = map.get(k);
    map.set(k, existing ? pick(x, existing) : x); // local wins or merges
  }
  return [...map.values()];
}

const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const t = (v: unknown): string => (typeof v === "string" ? v : "");

function pickProfile(local: unknown, remote: unknown): unknown {
  const onboarded = (p: unknown) => Boolean(p && (p as Rec).onboarded);
  // A fresh device has an un-onboarded profile; never let it overwrite the account's.
  if (onboarded(remote) && !onboarded(local)) return remote;
  if (onboarded(local) && !onboarded(remote)) return local;
  if (!local || !remote) return local ?? remote;
  return newer(local as Rec, remote as Rec);
}

const ID_KEYS = [
  "devices",
  "exercises",
  "programs",
  "templates",
  "sessions",
  "sets",
  "audit",
  "planChanges",
  "feedback",
  "bodyLog",
  "checkIns",
] as const;

/** Drop every record whose id has a deletion marker (tombstone). */
export function applyTombstones(snap: Snapshot): Snapshot {
  const dead = new Set(arr(snap.tombstones).map((x) => String(x.id)));
  if (dead.size === 0) return snap;
  const out: Snapshot = { ...snap };
  for (const k of ID_KEYS) {
    if (Array.isArray(snap[k])) out[k] = arr(snap[k]).filter((x) => !dead.has(String(x.id)));
  }
  return out;
}

/** Merge local over remote, keeping both sides' distinct records. */
export function mergeSnapshots(local: Snapshot, remote: Snapshot | null): Snapshot {
  if (!remote) return applyTombstones(local);
  const preferLocal = (l: Rec) => l;
  const byId = (x: Rec) => String(x.id);

  const profile = pickProfile(local.profile, remote.profile);
  const merged = applyTombstones({
    ...remote,
    ...local,
    // Units follow whichever profile copy won.
    units: profile === remote.profile ? remote.units ?? local.units : local.units ?? remote.units,
    profile,
    devices: mergeArr(arr(local.devices), arr(remote.devices), byId, newer),
    exercises: mergeArr(arr(local.exercises), arr(remote.exercises), byId, newer),
    programs: mergeArr(arr(local.programs), arr(remote.programs), byId, newer),
    templates: mergeArr(arr(local.templates), arr(remote.templates), byId, newer),
    // Sessions carry updatedAt — keep the more recently touched one.
    sessions: mergeArr(arr(local.sessions), arr(remote.sessions), (x) => String(x.id), (l, r) =>
      t(l.updatedAt) >= t(r.updatedAt) ? l : r
    ),
    // Sets: keep the more recently edited/completed copy of the same id.
    sets: mergeArr(arr(local.sets), arr(remote.sets), (x) => String(x.id), (l, r) => {
      const lt = t(l.editedAt) || t(l.completedAt);
      const rt = t(r.editedAt) || t(r.completedAt);
      return lt >= rt ? l : r;
    }),
    // Legacy PRs without any backing sets survive as the higher value; all
    // others are rebuilt from the merged sets below.
    prs: mergeArr(arr(local.prs), arr(remote.prs), (x) => `${x.exerciseId}:${x.kind}`, (l, r) =>
      Number(l.value) >= Number(r.value) ? l : r
    ),
    audit: mergeArr(arr(local.audit), arr(remote.audit), byId, preferLocal),
    // An undo stamps the change, so the undone copy wins.
    planChanges: mergeArr(arr(local.planChanges), arr(remote.planChanges), byId, newer)
      .sort((a, b) => t(b.at).localeCompare(t(a.at)))
      .slice(0, MAX_PLAN_CHANGES),
    feedback: mergeArr(arr(local.feedback), arr(remote.feedback), byId, newer),
    bodyLog: mergeArr(arr(local.bodyLog), arr(remote.bodyLog), byId, newer),
    checkIns: mergeArr(arr(local.checkIns), arr(remote.checkIns), byId, newer),
    // Keep the earliest marker per id (dedupe only).
    tombstones: mergeArr(arr(local.tombstones), arr(remote.tombstones), byId, preferLocal),
  });

  merged.prs = rebuildAllPrs({
    prs: arr(merged.prs) as unknown as PersonalRecord[],
    sets: arr(merged.sets) as unknown as WorkoutSet[],
    exercises: arr(merged.exercises) as unknown as Exercise[],
    devices: arr(merged.devices) as unknown as Device[],
  });
  return merged;
}
