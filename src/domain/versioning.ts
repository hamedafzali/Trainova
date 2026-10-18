// Edit stamps for definition records (templates, programs, custom exercises
// and devices, the profile). Sync uses them to keep the most recent edit of a
// record instead of letting whichever device synced last win.

type Stampable = { id: string; updatedAt?: string | null; owner?: string | null };

/**
 * Stamp `updatedAt` on every record that a state update replaced. The store is
 * immutable, so an edited record is a new object at the same id; unchanged
 * records keep their identity and their stamp. Shared library items
 * (owner === null) are the server's, never stamped locally.
 */
export function stampList<T extends Stampable>(prev: T[] | undefined, next: T[], at: string): T[] {
  if (!prev || prev === next) return next;
  const before = new Map(prev.map((x) => [x.id, x]));
  let changed = false;
  const out = next.map((x) => {
    if (x.owner === null) return x;
    const old = before.get(x.id);
    if (old === x) return x;
    if (old && x.updatedAt && old.updatedAt !== x.updatedAt) return x; // already stamped
    changed = true;
    return { ...x, updatedAt: at };
  });
  return changed ? out : next;
}

const STAMPED = ["templates", "programs", "exercises", "devices"] as const;

/** Apply edit stamps to a store update, given the state it is applied to. */
export function stampChanges<S extends Record<string, unknown>>(
  prev: S,
  next: Partial<S>,
  at = new Date().toISOString()
): Partial<S> {
  let out = next;
  for (const key of STAMPED) {
    const list = next[key];
    if (!Array.isArray(list)) continue;
    const stamped = stampList(prev[key] as Stampable[] | undefined, list as Stampable[], at);
    if (stamped !== list) out = { ...out, [key]: stamped };
  }
  const profile = next.profile as Record<string, unknown> | undefined;
  if (profile && profile !== prev.profile) out = { ...out, profile: { ...profile, updatedAt: at } };
  return out;
}

/** The more recently edited of two copies of a record; ties keep `a`. */
export function newer<T extends { updatedAt?: unknown }>(a: T, b: T): T {
  const ta = typeof a.updatedAt === "string" ? a.updatedAt : "";
  const tb = typeof b.updatedAt === "string" ? b.updatedAt : "";
  return tb > ta ? b : a;
}
