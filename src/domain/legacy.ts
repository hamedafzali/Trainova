// Data upgrades shared by the local store migration and incoming sync blobs.
// Before schema 3 the app stored weights in whatever unit was selected; from
// schema 3 everything is kilograms and units are display-only.

export const SCHEMA_VERSION = 3;

type Rec = Record<string, any>;

const LB = 0.45359237;
const kg = (v: unknown): unknown =>
  typeof v === "number" ? Math.round(v * LB * 100) / 100 : v;

/**
 * Convert a pre-schema-3 snapshot whose units were "lb" to kilograms. Returns
 * the input untouched when it's already canonical or was logged in kg.
 */
export function upgradeWeights<T extends Rec>(snap: T): T & { schema: number } {
  if ((snap.schema ?? 0) >= SCHEMA_VERSION || snap.units !== "lb") {
    return { ...snap, schema: SCHEMA_VERSION };
  }
  const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v : []);
  return {
    ...snap,
    schema: SCHEMA_VERSION,
    sets: arr(snap.sets).map((x) => ({
      ...x,
      actualWeight: kg(x.actualWeight),
      targetWeight: kg(x.targetWeight),
    })),
    templates: arr(snap.templates).map((t) => ({
      ...t,
      exercises: arr(t.exercises).map((te) => ({
        ...te,
        sets: arr(te.sets).map((s) => ({ ...s, targetWeight: kg(s.targetWeight) })),
      })),
    })),
    prs: arr(snap.prs).map((p) => (p.kind === "max_reps" ? p : { ...p, value: kg(p.value) })),
    audit: arr(snap.audit).map((a) => ({
      ...a,
      before: a.before ? { ...a.before, actualWeight: kg(a.before.actualWeight) } : a.before,
      after: a.after ? { ...a.after, actualWeight: kg(a.after.actualWeight) } : a.after,
    })),
  };
}
