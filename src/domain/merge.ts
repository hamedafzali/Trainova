// Pure merge of two synced snapshots. Additive by record id so concurrent edits
// on two devices (e.g. a workout logged on each) are both kept, rather than one
// blob overwriting the other. See PLATFORM.md / sync hardening.

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

const ID_KEYS = [
  "devices",
  "exercises",
  "programs",
  "templates",
  "sessions",
  "sets",
  "audit",
  "feedback",
  "bodyLog",
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

  return applyTombstones({
    ...remote,
    ...local,
    units: local.units ?? remote.units,
    profile: local.profile ?? remote.profile,
    devices: mergeArr(arr(local.devices), arr(remote.devices), (x) => String(x.id), preferLocal),
    exercises: mergeArr(arr(local.exercises), arr(remote.exercises), (x) => String(x.id), preferLocal),
    programs: mergeArr(arr(local.programs), arr(remote.programs), (x) => String(x.id), preferLocal),
    templates: mergeArr(arr(local.templates), arr(remote.templates), (x) => String(x.id), preferLocal),
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
    // PRs are keyed by exercise+kind; keep the higher value.
    prs: mergeArr(arr(local.prs), arr(remote.prs), (x) => `${x.exerciseId}:${x.kind}`, (l, r) =>
      Number(l.value) >= Number(r.value) ? l : r
    ),
    audit: mergeArr(arr(local.audit), arr(remote.audit), (x) => String(x.id), preferLocal),
    feedback: mergeArr(arr(local.feedback), arr(remote.feedback), (x) => String(x.id), preferLocal),
    bodyLog: mergeArr(arr(local.bodyLog), arr(remote.bodyLog), (x) => String(x.id), preferLocal),
    tombstones: mergeArr(arr(local.tombstones), arr(remote.tombstones), (x) => String(x.id), preferLocal),
  });
}
